#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-pd18-web-ptc/run-boot.mjs — the LIVE Member
 * driver for PD-18: the governed preset's two HOST-EXECUTED executors
 * (`web_fetch`/`web_search`, `workflow`) are fail-closed.
 *
 * WHY THIS FILE EXISTS. The recon round measured (a5sf-recon-review §2.2 and
 * a5sf-recon-external) that a governed Member could call `web_fetch` and
 * `workflow` on the SHIPPED preset: `web_fetch` ran on the inherited host
 * `ctx.web` provider (refused by that provider's SSRF policy, ZERO a5sf guard
 * facts) and `workflow` ran model-written JavaScript in a real PTC child under
 * the HOST sandbox policy (again ZERO a5sf facts; the Member's
 * `confinedTurnLaunchers` count was unchanged). PD-18's ruling is fail-closed:
 * the governed preset no longer carries those rows. This driver measures the
 * resulting surface and both directions:
 *
 *   POSITIVE  the same Host tree, on the standard BOOT_ROOT preset, still runs
 *             `workflow` and returns its deterministic `42` (the capability is
 *             removed from the GOVERNED preset, not broken in the tree);
 *   POSITIVE  the governed Member's `bash` still takes a real confined turn
 *             (in-lane bytes, out-of-lane `IO_READ_DENIED`, guard facts);
 *   NEGATIVE  the governed Member surface names no `workflow`, `web_fetch`,
 *             `web_search` or `run_code`;
 *   NEGATIVE  dispatching `workflow` and `web_fetch` from the governed Member
 *             returns the host router's typed `UNKNOWN_TOOL`, executes
 *             nothing, creates no PTC child and sends ZERO requests to a
 *             controlled loopback endpoint.
 *
 * ONE COMMAND, TWO BOOTS (the agreeing pair):
 *
 *   node tests/world-factory/drivers/a5sf-pd18-web-ptc/run-boot.mjs
 *
 * `--plan` is host-free (row/blueprint validation, zero boots). `--boots 1`
 * is a development iteration. Artefacts: `dev/agent-workflow/evidence/
 * a5sf-pd18-web-ptc/runs/boot0N/`, the append-only DEV-LIVE ledger beside them.
 *
 * WHAT IS FIXTURE (disclosed): the model is the shared scripted mock
 * (`packages/tools/harness/mock-deepseek.mjs`); the /proc watcher, the
 * controlled loopback endpoint and the mock-request log are test
 * instrumentation. The product path is NOT a fixture: the preset row, the
 * realm provider, the compiler, the guard, the confined terminal face and the
 * confined process provider are the shipped modules the Host loads.
 *
 * CORE PATCH BUDGET = 0.
 *
 * @module tests/world-factory/drivers/a5sf-pd18-web-ptc/run-boot
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync,
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
import { settleDevLiveLease } from '../../lib/dev-live-slots.mjs'
import { preRegisterDevLiveBudget, resolveHeadCommit } from '../../suites/150-a5sf-read.mjs'
import {
  lastUserTextOfStatic, messagesOf, remoteCall, surfaceNamesOf, textOf,
} from '../../lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd18-web-ptc')
const RUNS = join(EVIDENCE, 'runs')
const ARCHIVE = join(EVIDENCE, 'archive')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')
const GRANT_PATH = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'dev-live-grant.json')

const LINE = 'u5a5sfsub1'
const BOOT_ROOT = 'session-a5sf-lm-boot'
const ACCEPTANCE_ROOT = 'session-a5sf-lm-team'
const BP_ANCHOR_ID = 'team.a5sf.pd18.anchor'
const BP_MAIN_ID = 'team.a5sf.pd18.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'A5SF_PD18_DISC'
const MK_L1 = 'A5SF_PD18_L1_DRIVE'
const TOK_MEMBER = 'a5sf-pd18-turn'
const CALL_ADMIT = 'call-a5sfpd18-admit'
const CALL_DENY = 'call-a5sfpd18-deny'
const CALL_WORKFLOW_MEMBER = 'call-a5sfpd18-workflow-member'
const CALL_WEB_MEMBER = 'call-a5sfpd18-web-member'
const CALL_WORKFLOW_LEADER = 'call-a5sfpd18-workflow-leader'
const DONE_MEMBER = 'A5SF_PD18_MEMBER_DONE'
const DONE_L1 = 'A5SF_PD18_L1_DONE'
const DONE_DISC = 'A5SF_PD18_DISC_DONE'
const WF_RETURN = 42
const WF_SCRIPT = `return ${String(WF_RETURN)}`
const WEB_ENDPOINT_TEXT = 'A5SF_PD18_WEB_ENDPOINT_BYTES'
const WEB_ENDPOINT_PATH = '/pd18-web'
const CLOSED_TOOL_NAMES = Object.freeze(['web_fetch', 'web_search', 'workflow', 'run_code'])
const IN_LANE_TEXT = 'A5SF_PD18_IN_LANE_BYTES'
const SECRET_TEXT = 'A5SF_PD18_OUT_OF_LANE_SECRET'
const IN_LANE_FILE = 'in-lane.txt'
const SECRET_FILE = 'secret-out-of-lane.txt'

const LEADER_TOOL_ALLOW = Object.freeze(['bash', 'read', 'write', 'edit', 'read_image'])
const LEADER_DENY_SAFE = Object.freeze(['todo_write'])
const TEAM_TOOL_NAMES = Object.freeze(['team_delegate', 'team_archive_member', 'team_follow_up', 'team_collect', 'team_list_members'])

const SELECTED_CASES = Object.freeze([
  'pd18:member-bash-admitted',
  'pd18:member-bash-denied',
  'pd18:member-surface-closed',
  'pd18:member-workflow-typed-refusal',
  'pd18:member-web-typed-refusal',
  'pd18:leader-workflow-allowed',
  'pd18:guard-facts-shell-only',
  'pd18:no-member-code-exec',
])

const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
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

/** The pristine pinned host tree. This driver never writes it. A worktree may
 *  carry a symlink; a symlink would resolve OUTSIDE the runtime tree for the
 *  native-asset preflight, so the shared read-only checkout is used directly. */
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
  const raw = readFileSync(join(REPO_ROOT, 'cordis.patch.yml'), 'utf8')
  const jsSubstitutions = []
  const evaluated = raw.replace(/!!js[ \t]+([^\n]+)/gu, (_m, expr) => {
    const source = expr.trim()
    // The only expression in the shipped layer is a platform predicate. It is
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

// ─────────────────────────────────────────────────────────────────────────────
// blueprints
// ─────────────────────────────────────────────────────────────────────────────
function anchorBlueprintYaml() {
  const doc = {
    schemaVersion: 3,
    blueprintId: BP_ANCHOR_ID,
    revision: '1',
    leader: { templateId: 'leader', persona: `You lead the a5sf PD-18 anchor team. ${MK_DISC} is the discovery marker.` },
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
 * The v4 design of the team whose Member turn is measured. Its ONLY permission
 * statement is the `memberIoCeilings` family: read/write are the World
 * workspace, and `secret-out-of-lane.txt` lives one directory ABOVE it.
 */
function mainBlueprintYaml({ denyList, workspace }) {
  const doc = {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the a5sf PD-18 team. ${MK_L1} drives your chain: delegate the governed worker once, then finish.`,
      // NO `capabilities` block. The permission-coverage gate only runs for a
      // template that DECLARES capabilities, and any declared set must name
      // every tool on the final surface — including agent-scope tools such as
      // `subagent` that `tools.restrict()` cannot even name at root-start time.
      // The team tools (`team_delegate`, …) are mounted by the Team row itself
      // and are present either way (measured: the anchor Leader surface carries
      // all 19 `team_*` names with no capabilities block).
    },
    members: [{
      templateId: 'worker',
      displayName: 'Governed Worker',
      persona: 'You are the governed worker. Run the two read probes exactly once each, one tool call at a time.',
    }],
    requirements: [],
    teamEnvelope: {
      allow: ['create-member', 'assign-task', 'send-message', 'report-progress', 'archive-member'],
      deny: [],
    },
    memberEnvelopes: [{ templateId: 'worker', envelope: { allow: ['send-message', 'report-progress'], deny: [] } }],
    policyStates: [{ id: 'default', description: 'Default state.' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [{
      templateId: 'worker',
      io: {
        read: lane([workspace]),
        write: lane([workspace]),
        network: { mode: 'allow' },
      },
    }],
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
    throw new Error(`${label} rejected by the host validator: ${String(error?.message ?? error)}`)
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
    // THE OPT-IN (both keys are explicit; a v3 design or a missing ceiling
    // family would refuse at Member attach, never silently grant a default).
    memberPresetId: PRESET_ID,
    a5sfGovernedRealm: true,
    // The product guard-consult sink: the ONLY channel the guard facts reach.
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
function userTextOf(req) {
  return messagesOf(req).filter((m) => m?.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))).join('\n')
}
/** A MEMBER request is identified STRUCTURALLY: its FIRST user message is the
 *  delegated `[team-work …]` envelope carrying our token. The Leader's own
 *  post-delegate request also contains the token (it appears inside the
 *  delegate tool RESULT JSON), so a substring test anywhere in the request
 *  would replay the Member script on the Leader — measured. */
function isMemberRequest(req) {
  const first = messagesOf(req).find((m) => m?.role === 'user')
  if (first === undefined) return false
  const text = typeof first.content === 'string' ? first.content : JSON.stringify(first.content ?? '')
  return text.includes('[team-work ') && text.includes(TOK_MEMBER)
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

/**
 * The scripted model. The MEMBER branch is selected STRUCTURALLY by the token
 * that only our delegated prompt carries (a title/compaction call never does).
 */
function makeDecide({ inLanePath, secretPath, workspaceDir, webUrl }) {
  const bashCall = (id, command, description) => ({
    kind: 'tool-call',
    toolCalls: [{ id, name: 'bash', arguments: { command, description, workdir: workspaceDir } }],
  })
  const workflowCall = (id) => ({
    kind: 'tool-call',
    toolCalls: [{
      id,
      name: 'workflow',
      arguments: { script: WF_SCRIPT, meta: { name: 'pd18-return-42', description: 'Return the deterministic value 42.' } },
    }],
  })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf pd18 session' }

    // ── THE MEMBER TURN: admitted read, ceiling-denied read, then the TWO
    // closed executors (workflow + web) that MUST be typed refusals ────────
    if (isMemberRequest(req)) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_ADMIT)) {
        // The sleep keeps the confined payload alive so the independent /proc
        // observer can SEE it; it also makes "one launcher per command" a
        // measurable fact rather than a race.
        return bashCall(CALL_ADMIT, `cat '${inLanePath}'; sleep 1.5`, 'Read the in-lane fixture')
      }
      if (!seen.has(CALL_DENY)) {
        return bashCall(CALL_DENY, `cat '${secretPath}'; sleep 1.5`, 'Read the out-of-lane fixture')
      }
      // PD-18: the pre-fix Member executed this script in a real PTC child.
      if (!seen.has(CALL_WORKFLOW_MEMBER)) return workflowCall(CALL_WORKFLOW_MEMBER)
      // PD-18: the pre-fix Member reached the host web provider with this URL.
      if (!seen.has(CALL_WEB_MEMBER)) {
        return {
          kind: 'tool-call',
          toolCalls: [{ id: CALL_WEB_MEMBER, name: 'web_fetch', arguments: { url: webUrl } }],
        }
      }
      return { kind: 'text', content: `${DONE_MEMBER} ${lastToolResultText(req).slice(0, 200)}` }
    }

    // ── DISCOVERY TURN (BOOT_ROOT, standard preset): the POSITIVE control for
    // the executor the governed preset now removes. `workflow` must still
    // execute outside the governed preset and return its deterministic value.
    if (lastUser.includes(MK_DISC)) {
      if (!resultIdsOf(req).has(CALL_WORKFLOW_LEADER)) return workflowCall(CALL_WORKFLOW_LEADER)
      return { kind: 'text', content: DONE_DISC }
    }

    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1)
    if (isLeader) {
      const seen = resultIdsOf(req)
      if (!seen.has('call-a5sfpd18-delegate')) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: 'call-a5sfpd18-delegate',
            name: 'team_delegate',
            arguments: {
              rootSessionId: ACCEPTANCE_ROOT,
              requestToken: `${TOK_MEMBER}-delegate`,
              delegationTemplateId: 'worker',
              label: 'a5sfpd18-worker',
              workspace: workspaceDir,
              prompt: `${TOK_MEMBER}: run the two read probes exactly once each, one tool call at a time, then report. Probe A: the in-lane fixture. Probe B: the out-of-lane fixture.`,
              async: false,
            },
          }],
        }
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_PD18_NOOP' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// the controlled local web endpoint (the zero-request witness)
// ─────────────────────────────────────────────────────────────────────────────
async function startEndpoint() {
  const hits = []
  const server = createServer((req, res) => {
    hits.push({ at: new Date().toISOString(), method: String(req.method ?? ''), url: String(req.url ?? '') })
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(`${WEB_ENDPOINT_TEXT}\n`)
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  return {
    url: `http://127.0.0.1:${String(port)}${WEB_ENDPOINT_PATH}`,
    hits,
    close: () => new Promise((resolve) => server.close(() => resolve())),
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
    // PD-18: a PTC child (workflow) is a real node/landlock process. The
    // independent witness that no GOVERNED Member turn started one.
    if (cmdline.includes('ptc-runtime')) hits.push({ marker: 'ptc-runtime', cmdline: cmdline.slice(0, 400), ...base })
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
  // The durable session artefact is under <DSH_HOME>/sessions on this host
  // generation, but the driver searches the WHOLE home: the layout is a host
  // fact, not a driver assumption, and a displaced artefact must still be
  // found (and disclosed) rather than reported as "no transcript".
  if (!existsSync(dshHome)) return null
  for (const entry of walkFiles(dshHome)) {
    // MEASURED name on this host generation: `session.v4.jsonl.zstd` (the
    // bare `session.jsonl.zstd` is the older one). Match both, by header id.
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
/**
 * Normalise the durable session log into the Member-VISIBLE turn: the user
 * prompt, every `bash` tool call and its tool result (in order), and the final
 * assistant text. Nothing here is read from our instrumentation.
 */
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
    sessionId,
    file: found.file,
    header: found.header,
    lineCount: lines.length,
    user,
    calls: paired,
    assistant,
    finalAssistant: assistant.at(-1) ?? null,
  }
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

function judgeAdmitted(sample) {
  const record = (() => { try { return JSON.parse(sample.result.text) } catch { return null } })()
  return verdictOf(
    'the Member\'s model-visible `bash` admits an in-ceiling read through the confined terminal face and returns its bytes',
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued the admitted `bash` call' },
      { id: 'call-is-bash', ok: sample.call?.name === 'bash', detail: `name=${String(sample.call?.name)}` },
      { id: 'result-present', ok: sample.result !== undefined, detail: 'the Member received a tool result for the admitted call' },
      { id: 'result-not-error', ok: sample.result?.isError === false, detail: `isError=${String(sample.result?.isError)}` },
      { id: 'confined-terminal-kind', ok: record?.kind === 'confined-terminal', detail: `kind=${String(record?.kind)}` },
      { id: 'exit-zero', ok: record?.exitCode === 0, detail: `exitCode=${String(record?.exitCode)}` },
      { id: 'in-lane-bytes', ok: String(record?.stdout ?? '').includes(IN_LANE_TEXT), detail: 'the admitted read returned the in-lane bytes' },
    ],
  )
}

function judgeDenied(sample) {
  const text = String(sample.result?.text ?? '')
  return verdictOf(
    'the Member\'s model-visible `bash` REFUSES an out-of-ceiling read before it runs: a typed IO_READ_DENIED tool error and zero secret bytes',
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued the denied `bash` call' },
      { id: 'result-present', ok: sample.result !== undefined, detail: 'the Member received a tool result for the denied call' },
      { id: 'result-is-error', ok: sample.result?.isError === true, detail: `isError=${String(sample.result?.isError)}` },
      { id: 'typed-denial', ok: text.includes('IO_READ_DENIED'), detail: 'the tool result names the typed refusal code' },
      { id: 'zero-secret-bytes', ok: text.includes(SECRET_TEXT) === false, detail: 'NO secret bytes reached the Member transcript' },
    ],
  )
}

function judgeSurfaceClosed(surface, endpoint) {
  const names = surface.map((s) => s.name)
  return verdictOf(
    'the governed Member surface does NOT name the two executors PD-18 fail-closed (workflow, web_fetch/web_search) nor run_code, while `bash` stays present',
    [
      { id: 'workflow-absent', ok: names.includes('workflow') === false, detail: `workflow on surface=${String(names.includes('workflow'))}` },
      { id: 'web_fetch-absent', ok: names.includes('web_fetch') === false, detail: `web_fetch on surface=${String(names.includes('web_fetch'))}` },
      { id: 'web_search-absent', ok: names.includes('web_search') === false, detail: `web_search on surface=${String(names.includes('web_search'))}` },
      { id: 'run_code-absent', ok: names.includes('run_code') === false, detail: `run_code on surface=${String(names.includes('run_code'))}` },
      { id: 'bash-still-present', ok: names.includes('bash') === true, detail: 'the governed shell is still on the surface (this is not a blanket strip)' },
      { id: 'closed-set', ok: CLOSED_TOOL_NAMES.every((name) => names.includes(name) === false), detail: `closed names=${CLOSED_TOOL_NAMES.join(',')}` },
      { id: 'endpoint-untouched', ok: endpoint.hits.length === 0, detail: `the controlled endpoint saw ${String(endpoint.hits.length)} request(s) during the whole boot` },
    ],
  )
}

function unknownToolOf(sample, toolName) {
  const text = String(sample?.result?.text ?? '')
  return {
    text,
    unknown: /unknown tool/iu.test(text) && text.includes(toolName),
    isError: sample?.result?.isError === true,
    issued: sample?.call?.name === toolName,
  }
}

function judgeMemberWorkflow(sample) {
  const u = unknownToolOf(sample, 'workflow')
  return verdictOf(
    'the governed Member `workflow` call is a typed host-router refusal (UNKNOWN_TOOL) and returns NO workflow value — zero execution',
    [
      { id: 'call-issued', ok: u.issued, detail: `name=${String(sample?.call?.name)}` },
      { id: 'result-is-error', ok: u.isError, detail: `isError=${String(sample?.result?.isError)}` },
      { id: 'typed-unknown-tool', ok: u.unknown, detail: `text=${JSON.stringify(u.text.slice(0, 160))}` },
      { id: 'no-workflow-value', ok: u.text.includes(String(WF_RETURN)) === false, detail: 'the deterministic 42 never came back (the PTC body never ran)' },
      { id: 'not-host-ssrf-path', ok: /non-public IP/iu.test(u.text) === false, detail: 'the refusal is not the web provider SSRF path (this arm is the executor)' },
    ],
  )
}

function judgeMemberWeb(sample, endpoint) {
  const u = unknownToolOf(sample, 'web_fetch')
  const hits = endpoint.hits
  return verdictOf(
    'the governed Member `web_fetch` call is a typed host-router refusal (UNKNOWN_TOOL): ZERO provider calls, ZERO endpoint requests, ZERO bytes',
    [
      { id: 'call-issued', ok: u.issued, detail: `name=${String(sample?.call?.name)}` },
      { id: 'result-is-error', ok: u.isError, detail: `isError=${String(sample?.result?.isError)}` },
      { id: 'typed-unknown-tool', ok: u.unknown, detail: `text=${JSON.stringify(u.text.slice(0, 160))}` },
      { id: 'not-host-ssrf-refusal', ok: /non-public IP/iu.test(u.text) === false, detail: 'pre-fix the refusal was the BASE provider SSRF policy; now the tool is not dispatchable at all' },
      { id: 'endpoint-zero-requests', ok: hits.length === 0, detail: `controlled endpoint requests=${String(hits.length)}` },
      { id: 'zero-endpoint-bytes', ok: u.text.includes(WEB_ENDPOINT_TEXT) === false, detail: 'no endpoint bytes reached the Member' },
    ],
  )
}

function judgeLeaderWorkflow(sample) {
  const text = String(sample?.result?.text ?? '')
  return verdictOf(
    'OUTSIDE the governed preset the SAME tree still executes `workflow` and returns its deterministic value (capability positive control)',
    [
      { id: 'call-issued', ok: sample?.call?.name === 'workflow', detail: `name=${String(sample?.call?.name)}` },
      { id: 'result-present', ok: sample?.result !== undefined, detail: 'the Leader received a workflow tool result' },
      { id: 'result-not-error', ok: sample?.result?.isError === false, detail: `isError=${String(sample?.result?.isError)}` },
      { id: 'deterministic-value', ok: text.includes(String(WF_RETURN)), detail: `text=${JSON.stringify(text.slice(0, 200))}` },
    ],
  )
}

function judgeFacts(facts) {
  const allow = facts.filter((f) => f.decision === 'allow')
  const deny = facts.filter((f) => f.decision === 'deny')
  return verdictOf(
    'the guard ADMITTED the in-lane locator and DENIED the out-of-lane locator, as shellRead facts from the product sink',
    [
      { id: 'one-allow', ok: allow.length === 1, detail: `allow=${String(allow.length)}` },
      { id: 'allow-identity', ok: typeof allow[0]?.memberIdentity === 'string' && allow[0].memberIdentity !== '', detail: 'the ALLOW fact names the real Member identity' },
      { id: 'allow-decidedBy', ok: allow[0]?.decidedBy === 'ALLOW', detail: `decidedBy=${String(allow[0]?.decidedBy)}` },
      { id: 'one-deny', ok: deny.length === 1, detail: `deny=${String(deny.length)}` },
      { id: 'deny-code', ok: deny[0]?.decidedBy === 'IO_READ_DENIED', detail: `decidedBy=${String(deny[0]?.decidedBy)}` },
      { id: 'deny-locator', ok: String(deny[0]?.locator ?? '').endsWith(SECRET_FILE), detail: `locator=${String(deny[0]?.locator ?? '')}` },
      { id: 'shellRead-method', ok: allow.concat(deny).every((f) => f.method === 'shellRead'), detail: 'both decisions came from the shellRead lane' },
    ],
  )
}

function judgeSpawns(counters) {
  return verdictOf(
    'the Member turn ran exactly ONE confined-provider child for its TWO commands (the denied one spawned nothing), and ZERO base `bwrap` children ran the Member tool',
    [
      {
        id: 'one-confined-launcher',
        ok: counters.confinedTurnLaunchers === 1,
        detail: `--confined-exec-stream launchers under the World scratch=${String(counters.confinedTurnLaunchers)} for TWO commands; the guard recorded ${String(counters.guardFacts?.deny)} DENY and the refused call returned no confined-terminal record, so the single spawn is the admitted command`,
      },
      {
        id: 'denied-spawn-absent',
        ok: counters.confinedTurnLaunchers === 1 && counters.procSecretCommandSightings === 0,
        detail: `no second launcher and no process argv carrying the secret locator (sightings=${String(counters.procSecretCommandSightings)})`,
      },
      {
        id: 'zero-base-spawn',
        ok: counters.baseBwrapWithMarkers === 0,
        detail: `base bwrap argv carrying the Member markers=${String(counters.baseBwrapWithMarkers)}`,
      },
      {
        id: 'no-ptc-child-in-member-window',
        ok: counters.ptcRuntimeInMemberWindow === 0,
        detail: `ptc-runtime processes observed after the discovery (positive) turn=${String(counters.ptcRuntimeInMemberWindow)}; the Leader's allowed run happened BEFORE this window`,
      },
      {
        id: 'preflight-excluded',
        ok: counters.preflightLaunchers >= 0,
        detail: `${String(counters.preflightLaunchers)} pre-attach probe launcher(s) were observed and are EXCLUDED from the turn count (their scratch path names probe-*)`,
      },
    ],
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// plan (host-free)
// ─────────────────────────────────────────────────────────────────────────────
function planOnly() {
  const layer = shippedLayer()
  log(`PLAN repo=${REPO_ROOT} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA}`)
  log(`shipped !!js substitutions: ${JSON.stringify(layer.jsSubstitutions)}`)
  const anchor = anchorBlueprintYaml()
  const main = mainBlueprintYaml({ denyList: ['u5_canary'], workspace: join(EVIDENCE, 'plan-workspace') })
  const a = assertBlueprintText(anchor, BP_ANCHOR_ID, 'anchor.yaml')
  const m = assertBlueprintText(main, BP_MAIN_ID, 'main.yaml')
  log(`blueprints accepted: anchor=${JSON.stringify(a)} main=${JSON.stringify(m)}`)
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), workspaceDir: join(EVIDENCE, 'plan-workspace'), anchorYaml: anchor, layer })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-pd18-web-ptc plan (no World)'], rows) + '\n')
  log(`rows: ${JSON.stringify(rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 80) })))}`)
  const preset = layer.rows.find((r) => r?.config?.id === PRESET_ID)
  const plugins = (preset?.config?.plugins ?? []).map((p) => p.id)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-fs-search']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  if (plugins.includes('tool-pwsh')) throw new Error('the shipped governed preset unexpectedly carries tool-pwsh')
  // PD-18 fail-closed surface: these rows MUST be gone from the governed preset.
  for (const closed of ['tool-web', 'tool-workflow', 'workflow-ptc']) {
    if (plugins.includes(closed)) throw new Error(`the shipped governed preset unexpectedly carries '${closed}' (PD-18 fail-closed)`)
  }
  log('PD-18: governed preset carries none of tool-web / tool-workflow / workflow-ptc')
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// one boot
// ─────────────────────────────────────────────────────────────────────────────
async function bootOnce({ index, head, grant, layer, baseDir }) {
  const bootDir = join(RUNS, `boot${String(index).padStart(2, '0')}`)
  mkdirSync(bootDir, { recursive: true })
  const phase = `a5sf-pd18-web-ptc-boot${String(index)}`
  const runId = `a5sf-pd18-web-ptc-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-pd18-web-ptc', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, grant), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-pd18-web-ptc', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const lease = await preRegisterDevLiveBudget({
    grantPath: GRANT_PATH, headCommit: head, runRecord: record,
    face: 'Subprocess', world: LINE, leaseRoot: factory.leaseRoot, requiredBoots: 1,
  })
  log(`[boot${String(index)}] dev-live lease grant=${lease.grant.grantId} world=${LINE} head=${head}`)

  let world = null
  let bootInfo = null
  let endpoint = null
  let teardown = null
  let failure = null
  let hostReached = false
  let abortStage = 'pre-boot'
  let paths = null
  let collectDiagnostics = () => ({})
  const counters = {}
  let result = null
  try {
    bootInfo = await lease.boot(async () => {
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      log(`[boot${String(index)}] world=${world.id} home=${world.home}`)
      mkdirSync(join(world.home, 'blueprints'), { recursive: true })
      const workspace = world.workspaceDir
      const inLanePath = join(workspace, IN_LANE_FILE)
      // The out-of-lane fixture sits OUTSIDE the compiled read ceiling.
      const outsideDir = join(world.home, 'out-of-lane')
      mkdirSync(outsideDir, { recursive: true })
      const secretPath = join(outsideDir, SECRET_FILE)
      writeFileSync(inLanePath, `${IN_LANE_TEXT}\n`, 'utf8')
      writeFileSync(secretPath, `${SECRET_TEXT}\n`, 'utf8')
      writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2) + '\n')

      const anchor = anchorBlueprintYaml()
      writeFileSync(join(world.home, 'blueprints', 'anchor.yaml'), anchor)
      // main.yaml is written AFTER the discovery turn (the Leader's deny list
      // is measured, not guessed), exactly like the proven live lanes.
      const rows = composedRows({ home: world.home, workspaceDir: workspace, anchorYaml: anchor, layer })
      world.u6Fs.rows.push(...rows)
      log(`[boot${String(index)}] rows: ${rows.map((r) => r.id).join(',')}`)

      // PD-18 POSITIVE/NEGATIVE WITNESS: a controlled local HTTP endpoint. A
      // governed Member's `web_fetch` must never reach it; the pre-fix path
      // never did either (the HOST provider's SSRF policy refused loopback
      // first), so the discriminating assertion is the TYPED refusal, and the
      // endpoint counter is the zero-byte/zero-side-effect witness.
      endpoint = await startEndpoint()
      const decide = makeDecide({ inLanePath, secretPath, workspaceDir: workspace, webUrl: endpoint.url })
      process.env.A5SF_GOVERNED_SCRATCH = join(world.home, 'governed-scratch')
      mkdirSync(process.env.A5SF_GOVERNED_SCRATCH, { recursive: true })
      await world.startMock({ decide })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)} endpoint=${endpoint.url}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })
    hostReached = true
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

    // ── discovery turn: the REAL Leader surface (to compute the deny list) ──
    abortStage = 'discovery'
    await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfpd18')
    await waitFor(() => (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith('A5SF_PD18_DISC_DONE')), 60_000)
    const discRequests = world.mock?.requests ?? []
    const byMarker = discRequests.filter((r) => messagesOf(r).some((m) => textOf(m).includes(MK_DISC)) && surfaceNamesOf(r).length > 0).at(-1) ?? null
    const byTools = discRequests.filter((r) => surfaceNamesOf(r).length > 0).at(-1) ?? null
    const discRequest = byMarker ?? byTools ?? null
    const leaderSurface = discRequest === null ? [] : [...new Set(surfaceNamesOf(discRequest))].sort()
    // The Leader declares NO capabilities (see mainBlueprintYaml): its surface
    // is the deployment default, which the coverage gate does not police. The
    // discovery turn is still recorded as the composition fact it is.
    const denyList = []
    log(`[boot${String(index)}] leader surface (${String(leaderSurface.length)}): ${leaderSurface.join(',')}`)
    log(`[boot${String(index)}] leader builtinToolDeny: ${denyList.join(',')}`)
    if (!leaderSurface.includes('team_delegate') && !leaderSurface.some((n) => n.startsWith('team_'))) {
      throw new Error(`the Leader surface carries no team tools (${leaderSurface.join(',')}) — the composition did not register them`)
    }
    writeFileSync(join(bootDir, 'leader-surface.json'), JSON.stringify({ at: new Date().toISOString(), tools: leaderSurface, denyList }, null, 2) + '\n')

    // PD-18 POSITIVE CONTROL (before the /proc window): the SAME Host tree
    // executed `workflow` on the standard BOOT_ROOT preset (the governed
    // preset no longer carries it). This happens BEFORE the observer starts so
    // the Member window below cannot be contaminated by the Leader's PTC child.
    const leaderWorkflow = {
      call: toolCallFor(discRequests, CALL_WORKFLOW_LEADER),
      result: toolResultFor(discRequests, CALL_WORKFLOW_LEADER) ?? null,
    }
    writeFileSync(join(bootDir, 'leader-workflow.json'), JSON.stringify({
      at: new Date().toISOString(),
      note: 'the BOOT_ROOT (standard preset) workflow turn: the executor is NOT broken by the governed-preset removal',
      call: leaderWorkflow.call,
      result: leaderWorkflow.result,
    }, null, 2) + '\n')
    log(`[boot${String(index)}] leader workflow result=${redact(String(leaderWorkflow.result?.text ?? '<missing>')).slice(0, 240)}`)

    // The /proc observer is INDEPENDENT of the product and of our counters. It
    // starts AFTER the positive workflow control and BEFORE `team.create`: the
    // Member's whole chain (and therefore its tool calls) runs inside that
    // synchronous call — measured. A watcher started afterwards sees an empty
    // window and reads as "no spawn".
    const procLog = []
    const otherBwrapPids = new Set()
    const memberPromptAt = new Date().toISOString()
    const watcher = setInterval(() => {
      try {
        const hits = scanProc({ inLanePath: paths.inLane, secretPath: paths.secret })
        const kept = []
        for (const hit of hits) {
          // The gateway itself runs this whole session under `bwrap`; those
          // wrappers are NOT the Member's tool path. Only a base `bwrap` whose
          // argv NAMES one of our fixtures is evidence, so the rest is counted
          // (a disclosure) and never stored.
          if (hit.marker === 'base-bwrap' && hit.inLane !== true && hit.secret !== true) { otherBwrapPids.add(hit.pid); continue }
          kept.push(hit)
        }
        if (kept.length > 0) procLog.push({ at: new Date().toISOString(), hits: kept })
      } catch { /* observation must never break the run */ }
    }, 40)

    const mainText = mainBlueprintYaml({ denyList, workspace: paths.workspace })
    assertBlueprintText(mainText, BP_MAIN_ID, 'main.yaml')
    writeFileSync(join(world.home, 'blueprints', 'main.yaml'), mainText)

    // ── team.create: the Leader's first turn delegates the governed Member ─
    abortStage = 'team-create'
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5sfpd18')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`[boot${String(index)}] team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)

    abortStage = 'member-turn'
    // A turn that never settles must still leave a diagnosable trail: the
    // member's session artefact, the delegate result, the provider's request
    // log and the host log tail are copied BEFORE the World home is deleted.
    collectDiagnostics = (label) => {
      const out = {}
      const requestsNow = world?.mock?.requests ?? []
      out.mockRequests = requestsNow.map((r, i) => ({
        seq: i,
        lastUser: lastUserTextOfStatic(r).slice(0, 600),
        isMemberRequest: isMemberRequest(r),
        tools: surfaceNamesOf(r).length,
        reply: typeof r.reply === 'object' ? JSON.stringify(r.reply).slice(0, 400) : String(r.reply ?? '').slice(0, 400),
      }))
      out.delegateCall = toolCallFor(requestsNow, 'call-a5sfpd18-delegate')
      out.delegateResult = toolResultFor(requestsNow, 'call-a5sfpd18-delegate') ?? null
      try { out.hostLogTail = redact(readFileSync(bootInfo.logPath, 'utf8').split('\n').slice(-80).join('\n')) } catch { out.hostLogTail = '<absent>' }
      try {
        const sessions = []
        const all = walkFiles(join(world.home, 'sessions'))
        for (const entry of all) {
          // MEASURED name on this host generation: `session.v4.jsonl.zstd` (the
    // bare `session.jsonl.zstd` is the older one). Match both, by header id.
    if (!/^session(\..+)?\.jsonl\.zstd$/u.test(entry.name)) continue
          const header = parseFirstJsonLine(readFileSync(entry.path))
          sessions.push({ file: entry.path, bytes: readFileSync(entry.path).length, id: header?.id ?? null, kind: header?.kind ?? null })
        }
        out.sessions = sessions
        out.sessionFiles = all.map((e) => e.path)
        out.homeListing = (() => { try { return readdirSync(world.home) } catch { return [] } })()
        out.sessionsExists = (() => { try { return existsSync(join(world.home, 'sessions')) } catch { return false } })()
        // Copy the raw artefacts: a chain that never settles still leaves the
        // Member's own turn on disk, and the home is deleted at teardown.
        out.sessionCopy = label !== 'final'
        const copyRoot = join(bootDir, `sessions-${label}`)
        for (const entry of label === 'final' ? [] : all) {
          const rel = entry.path.slice(join(world.home, 'sessions').length + 1)
          const target = join(copyRoot, rel)
          mkdirSync(dirname(target), { recursive: true })
          writeFileSync(target, readFileSync(entry.path))
        }
      } catch (error) { out.sessions = []; out.sessionError = String(error?.message ?? error) }
      try { out.guardFacts = parseJsonl(paths.sink) } catch { out.guardFacts = [] }
      out.counters = { ...counters, procBatches: procLog.length }
      writeFileSync(join(bootDir, `diagnostics-${label}.json`), JSON.stringify(out, null, 2) + '\n')
      try { writeFileSync(join(bootDir, `host-log-${label}.log`), out.hostLogTail + '\n') } catch { /* best effort */ }
      log(`[boot${String(index)}] diagnostics(${label}): mockRequests=${String(out.mockRequests.length)} delegateResult=${redact(String(out.delegateResult?.text ?? '<none>')).slice(0, 300)} sessions=${JSON.stringify(out.sessions.map((x) => x.id))}`)
      return out
    }
    let chainOk = false
    const chainTimeoutMs = Number(process.env.A5SF_PD18_CHAIN_TIMEOUT_MS ?? 300_000)
    const chainDeadline = Date.now() + (Number.isFinite(chainTimeoutMs) && chainTimeoutMs > 0 ? chainTimeoutMs : 300_000)
    for (;;) {
      chainOk = (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith(DONE_L1))
      if (chainOk || Date.now() > chainDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    const memberDoneAt = new Date().toISOString()
    clearInterval(watcher)
    await new Promise((r) => setTimeout(r, 1200))
    log(`[boot${String(index)}] leader chain closed (${DONE_L1})=${String(chainOk)}`)
    abortStage = 'evidence-collection'
    if (!chainOk) {
      collectDiagnostics('chain-timeout')
      throw new Error('the Leader chain never closed: no Member turn settled')
    }

    // The Leader's delegate RESULT is the only place a Member-attach refusal
    // is visible, and the World home is deleted at teardown: persist it first.
    const requests0 = world.mock?.requests ?? []
    const delegateCall = toolCallFor(requests0, 'call-a5sfpd18-delegate')
    const delegateResult = toolResultFor(requests0, 'call-a5sfpd18-delegate')
    writeFileSync(join(bootDir, 'leader-delegate.json'), JSON.stringify({
      call: delegateCall, result: delegateResult === undefined ? null : delegateResult,
    }, null, 2) + '\n')
    log(`[boot${String(index)}] delegate call=${String(delegateCall !== null)} result=${redact(String(delegateResult?.text ?? '<missing>')).slice(0, 500)}`)

    const state = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const members = Array.isArray(state?.body?.members) ? state.body.members : []
    const member = members.find((m) => String(m?.templateId ?? '') === 'worker') ?? members[0] ?? null
    const instanceId = member?.instanceId ?? null
    const childSessionId = member?.childSessionId ?? member?.row?.childSessionId
      ?? (instanceId === null ? null : `session-team-child-${createHash('sha256').update(`${ACCEPTANCE_ROOT}\u0000${instanceId}`).digest('hex').slice(0, 32)}`)
    log(`[boot${String(index)}] members=${JSON.stringify(members.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle })))} childSessionId=${String(childSessionId)}`)

    const transcript = childSessionId === null ? null : readMemberTranscript(world.home, childSessionId)
    if (transcript !== null) {
      writeFileSync(join(bootDir, 'member-transcript.json'), JSON.stringify(transcript, null, 2) + '\n')
      // The raw durable artefact of the Member's OWN session, kept byte-for-byte
      // so a reader can re-decode it without trusting this driver's normaliser.
      try {
        writeFileSync(join(bootDir, 'member-session.v4.jsonl.zstd'), readFileSync(transcript.file))
      } catch { /* the normalised transcript is still evidence */ }
    }
    // The bulk copy exists only as a failure fallback; once the Member's own
    // artefact is extracted it is not needed (and would bloat the evidence).
    try { rmSync(join(bootDir, 'sessions-final'), { recursive: true, force: true }) } catch { /* absent */ }
    writeFileSync(join(bootDir, 'member-transcript.txt'), renderTranscript(transcript) + '\n')

    const requests = world.mock?.requests ?? []
    const callOf = (id) => toolCallFor(requests, id)
    const resultOf = (id) => toolResultFor(requests, id)
    // Prefer the Member's OWN transcript result; fall back to the provider
    // transcript ONLY to report a missing session log explicitly.
    const own = (id) => transcript?.calls.find((c) => String(c.callId) === String(id)) ?? null
    const admitted = { call: callOf(CALL_ADMIT), result: own(CALL_ADMIT)?.result ?? resultOf(CALL_ADMIT) }
    const denied = { call: callOf(CALL_DENY), result: own(CALL_DENY)?.result ?? resultOf(CALL_DENY) }
    const memberWorkflow = { call: callOf(CALL_WORKFLOW_MEMBER), result: own(CALL_WORKFLOW_MEMBER)?.result ?? resultOf(CALL_WORKFLOW_MEMBER) }
    const memberWeb = { call: callOf(CALL_WEB_MEMBER), result: own(CALL_WEB_MEMBER)?.result ?? resultOf(CALL_WEB_MEMBER) }
    // Member surface: the agent request that carries OUR member token.
    const memberRequest = requests.filter((r) => isMemberRequest(r) && surfaceNamesOf(r).length > 0).at(-1) ?? null
    const memberSurface = memberRequest === null ? [] : surfaceNamesOf(memberRequest).map((name) => {
      const schema = (memberRequest.body?.tools ?? []).find((t) => String(t?.name ?? t?.function?.name ?? '') === name)
      const fn = schema?.function ?? null
      const params = schema?.parameters ?? fn?.parameters ?? schema?.input_schema ?? schema?.inputSchema ?? null
      return {
        name,
        description: schema?.description ?? fn?.description ?? null,
        parameters: params,
        schemaKeys: schema === null || schema === undefined ? [] : Object.keys(schema),
      }
    })
    const bashEntry = memberSurface.find((s) => s.name === 'bash') ?? null
    writeFileSync(join(bootDir, 'member-surface.json'), JSON.stringify({
      at: new Date().toISOString(),
      tools: memberSurface.map((s) => s.name),
      bash: bashEntry,
      closedNames: CLOSED_TOOL_NAMES,
      note: 'the FULL model-visible tool name list of the governed Member request, unfiltered',
    }, null, 2) + '\n')

    writeFileSync(join(bootDir, 'web-endpoint-observations.json'), JSON.stringify({
      at: new Date().toISOString(),
      schema: 'a5sf-pd18-web-ptc/endpoint-observations/1',
      url: endpoint.url,
      hits: endpoint.hits,
      note: 'server-side observation of a controlled 127.0.0.1 endpoint; the governed Member must never reach it',
    }, null, 2) + '\n')

    const factsAll = parseJsonl(paths.sink).filter((f) => f?.schema === 'a5sf-guard-consult/1' || f?.method === 'shellRead')
    const facts = factsAll.filter((f) => f?.method === 'shellRead')
    writeFileSync(join(bootDir, 'guard-facts.json'), JSON.stringify(factsAll, null, 2) + '\n')

    // Independent /proc counters (deduped by pid inside the Member-turn window).
    const sightingPids = (marker, filter = () => true) => {
      const pids = new Set()
      for (const batch of procLog) {
        for (const hit of batch.hits) {
          if (hit.marker !== marker) continue
          if (filter(hit) === false) continue
          pids.add(hit.pid)
        }
      }
      return pids
    }
    // Attribution rule (MEASURED; corrected 2026-11-13 — the earlier text of this
    // comment asserted the opposite and was WRONG): the confined terminal does
    // NOT write the command text to a PTY. `packages/runtime/team-services/src/terminal.ts:535`
    // spawns `argv: [program, '-c', text]`, and `:538` sets `stdin: 'ignore'` —
    // there is no stdin/PTY to write to. The command body therefore IS in the
    // shell child's `/proc/<pid>/cmdline`, readable by any same-machine process:
    // a process-list leak surface, not a lane-isolation defect.
    // `payloadInLaneSightings` is a POSITIVE visibility witness when non-zero; a
    // ZERO means the ~240 ms sampler missed the short-lived child, never that
    // argv is clean (Face C recon, PR #660, measured 3 sightings boot01 / 2
    // boot02 on this same face while these two boots recorded 0). The independent
    // witness for "the command RAN" is still the PROVIDER's launcher process:
    //   - `--confined-exec-stream` under THIS World's scratch `plans/` dir is a
    //     Member tool execution; exactly one for the whole turn;
    //   - `probe-*` / `--enforce-leg` / `--net-leg` launchers are the realm's
    //     own attach-time probes and are excluded by name;
    //   - a base `bwrap` whose argv carries one of our fixture paths would be
    //     the ungoverned path (expected zero).
    const launcherPids = sightingPids('confined-launcher', (h) => h.cmdline.includes('--confined-exec-stream'))
    const preflightPids = sightingPids('confined-launcher', (h) => h.cmdline.includes('--confined-exec-stream') === false)
    const payloadInLane = sightingPids('payload-in-lane')
    const payloadSecret = sightingPids('payload-secret')
    const baseBwrap = sightingPids('base-bwrap', (h) => h.inLane === true || h.secret === true)
    const ptcPids = sightingPids('ptc-runtime')
    counters.confinedTurnLaunchers = launcherPids.size
    counters.preflightLaunchers = preflightPids.size
    counters.payloadInLaneSightings = payloadInLane.size
    counters.procSecretCommandSightings = payloadSecret.size
    counters.baseBwrapWithMarkers = baseBwrap.size
    counters.ptcRuntimeInMemberWindow = ptcPids.size
    counters.endpointRequests = endpoint.hits.length
    counters.guardFacts = { allow: facts.filter((f) => f.decision === 'allow').length, deny: facts.filter((f) => f.decision === 'deny').length }
    counters.mockRequests = requests.length
    counters.memberModelRequests = requests.filter((r) => isMemberRequest(r) && surfaceNamesOf(r).length > 0).length
    counters.procBatches = procLog.length
    counters.otherBwrapPids = otherBwrapPids.size
    counters.memberWindow = { from: memberPromptAt, to: memberDoneAt }
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')
    writeFileSync(join(bootDir, 'proc-observations.json'), JSON.stringify({
      schema: 'a5sf-pd18-web-ptc/proc-observations/1', at: new Date().toISOString(),
      note: 'independent /proc/<pid>/cmdline scan; a sighting is an OS-level fact, not a product counter',
      sightings: procLog,
    }, null, 2) + '\n')

    // ── judges ─────────────────────────────────────────────────────────────
    const verdicts = {
      admitted: judgeAdmitted(admitted),
      denied: judgeDenied(denied),
      surface: judgeSurfaceClosed(memberSurface, endpoint),
      workflow: judgeMemberWorkflow(memberWorkflow),
      web: judgeMemberWeb(memberWeb, endpoint),
      leaderWorkflow: judgeLeaderWorkflow(leaderWorkflow),
      facts: judgeFacts(facts),
      spawns: judgeSpawns(counters),
    }
    // NOTE: `detail` must NOT carry a `verdict` key — the record spreads it
    // AFTER the passed verdict and would silently overwrite it.
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}`)
    }
    add('pd18:member-bash-admitted', verdicts.admitted.verdict, verdicts.admitted)
    add('pd18:member-bash-denied', verdicts.denied.verdict, verdicts.denied)
    add('pd18:member-surface-closed', verdicts.surface.verdict, verdicts.surface)
    add('pd18:member-workflow-typed-refusal', verdicts.workflow.verdict, verdicts.workflow)
    add('pd18:member-web-typed-refusal', verdicts.web.verdict, verdicts.web)
    add('pd18:leader-workflow-allowed', verdicts.leaderWorkflow.verdict, verdicts.leaderWorkflow)
    add('pd18:guard-facts-shell-only', verdicts.facts.verdict, verdicts.facts)
    add('pd18:no-member-code-exec', verdicts.spawns.verdict, verdicts.spawns)

    collectDiagnostics('final')
    const final = record.finalize()
    const summary = formatSummary(final)
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), summary + '\n')
    log(`[boot${String(index)}] ${summary}`)

    result = {
      boot: index, worldId: world.id, port: bootInfo.port, hostLog: bootInfo.logPath,
      runId, summary, overall: final.overall,
      childSessionId, instanceId,
      transcript: transcript === null ? null : {
        file: transcript.file, sessionId: transcript.sessionId, lineCount: transcript.lineCount,
        user: transcript.user, finalAssistant: transcript.finalAssistant,
        calls: transcript.calls,
      },
      counters, facts, verdicts,
      locus: buildLocus({ world, bootInfo, transcript, facts, paths, bootDir }),
      paths,
      memberPromptAt, memberDoneAt,
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
    if (endpoint !== null) {
      try { await endpoint.close() } catch (error) { log(`[boot${String(index)}] endpoint close failed: ${String(error?.message ?? error)}`) }
    }
    // The slot represents a LIVE Host, so it is released AFTER teardown, and
    // through the lease's REAL API (`releaseSlot`), never a guessed method: the
    // historical `lease.release?.()` was a silent no-op and leaked one machine
    // slot per boot (fixed 2026-11-13; dev/agent-workflow/evidence/recon-infra
    // and evidence/a5sf-recon-external D1).
    // `settleDevLiveLease` throws when the API is absent or the lease still
    // reports a held slot, so a leak can no longer be silent.
    try {
      const settled = settleDevLiveLease(lease)
      log(`[boot${String(index)}] dev-live slot released (released=${String(settled.released)} held=${String(settled.held)})`)
    } catch (error) {
      log(`[boot${String(index)}] SLOT RELEASE FAILED: ${String(error?.stack ?? error)}`)
      if (failure === null) {
        failure = error
        abortStage = 'slot-release'
      }
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

/**
 * LOCUS — the exact anchors a reader follows to check the claim without
 * re-running anything. Every entry is a real file with a real line.
 */
function buildLocus({ world, bootInfo, transcript, facts, paths, bootDir }) {
  const lineOf = (file, needle) => {
    try {
      const lines = readFileSync(file, 'utf8').split('\n')
      const i = lines.findIndex((l) => l.includes(needle))
      return i === -1 ? null : i + 1
    } catch { return null }
  }
  const sinkLines = { allow: null, deny: null }
  try {
    const lines = readFileSync(paths.sink, 'utf8').split('\n').filter((l) => l.trim() !== '')
    lines.forEach((l, i) => {
      try {
        const f = JSON.parse(l)
        if (f.decision === 'allow' && sinkLines.allow === null) sinkLines.allow = i + 1
        if (f.decision === 'deny' && sinkLines.deny === null) sinkLines.deny = i + 1
      } catch { /* skip */ }
    })
  } catch { /* absent */ }
  const transcriptText = join(bootDir, 'member-transcript.txt')
  return {
    composition: {
      rowConfig: 'dev/agent-workflow/evidence/a5sf-pd18-web-ptc/plan-patch.yml (regenerated by --plan; boot copies live in the World home)',
      shippedPreset: { file: 'cordis.patch.yml', line: lineOf(join(REPO_ROOT, 'cordis.patch.yml'), 'id: "preset-a5sf-governed-member"') },
      realmProvider: { file: 'packages/runtime/src/plugin/live/a5sf-governed-realm.mjs', line: 1 },
      memberMount: { file: 'packages/runtime/src/plugin/live/agent-bindings.mjs', line: lineOf(join(REPO_ROOT, 'packages/runtime/src/plugin/live/agent-bindings.mjs'), 'a5sfRealm = await mountMemberA5sfRealm') },
      confinedBashTool: { file: 'packages/runtime/src/plugin/live/confined-terminal-tool.mjs', line: lineOf(join(REPO_ROOT, 'packages/runtime/src/plugin/live/confined-terminal-tool.mjs'), 'name: \'bash\'') },
    },
    member: {
      sessionId: transcript?.sessionId ?? null,
      sessionLog: transcript?.file ?? null,
      transcriptCopy: transcriptText,
      toolCallLines: transcriptText,
      note: 'the tool call/result rows are the Member\'s OWN durable session log, copied here before teardown',
    },
    guardSink: { file: join(bootDir, 'guard-facts.json'), source: paths.sink, allowLine: sinkLines.allow, denyLine: sinkLines.deny, facts: facts.length },
    host: { log: bootInfo?.logPath ?? null, worldId: world?.id ?? null, port: bootInfo?.port ?? null },
    counts: { file: join(bootDir, 'counters.json'), proc: join(bootDir, 'proc-observations.json') },
  }
}

function renderTranscript(transcript) {
  if (transcript === null) return 'NO MEMBER TRANSCRIPT (the Member session log was not found before teardown)'
  const out = []
  out.push(`# Member transcript — ${transcript.sessionId}`)
  out.push(`# durable log: ${transcript.file}`)
  out.push('')
  for (const u of transcript.user) {
    const text = u.trim()
    out.push('USER:', text.length <= 900 ? text : `${text.slice(0, 900)}\n… [rendered truncated at 900 chars; the full text is in member-transcript.json]`, '')
  }
  for (const call of transcript.calls) {
    const args = call.arguments ?? {}
    out.push(`TOOL CALL [${call.name}] ${String(call.callId)}`)
    if (args.command !== undefined) {
      out.push(`  command: ${String(args.command ?? '')}`)
      out.push(`  workdir: ${String(args.workdir ?? '')}`)
    } else {
      out.push(`  arguments: ${JSON.stringify(args).slice(0, 900)}`)
    }
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

function runBindings(head, grant) {
  return {
    authority: readAuthorityBinding(REPO_ROOT),
    candidate: { head, hostSha: TEST_USE_BASELINE_SHA, baseline: TEST_USE_BASELINE_SHA },
    grant: { grantId: grant.grantId, scope: 'DEV-LIVE', face: grant.face, world: grant.world },
    recordClass: 'DEV-LIVE',
    teamSha: head,
    hostSha: TEST_USE_BASELINE_SHA,
    note: 'DEV-LIVE: development evidence, never a candidate claim; candidateClaimEligibility is false by construction',
  }
}

/** Archive-before-start: a previous `runs/` is moved aside, never overwritten. */
function archivePriorRuns() {
  if (!existsSync(RUNS)) return null
  const entries = readdirSync(RUNS)
  if (entries.length === 0) return null
  mkdirSync(ARCHIVE, { recursive: true })
  const target = join(ARCHIVE, utcStamp())
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
  const grant = readJson(GRANT_PATH)
  if (grant === null) throw new Error(`no dev-live grant at ${GRANT_PATH}`)
  const archived = archivePriorRuns()
  log(`ARCHIVE: ${archived === null ? '(nothing to archive)' : archived}`)
  writeFileSync(join(EVIDENCE, 'driver-digest.json'), JSON.stringify({
    at: startedAt, head, hostTree: HOST_TREE, hostSha: hostDigest(), pin: TEST_USE_BASELINE_SHA,
    driverSha256: sha256(fileURLToPath(import.meta.url)), jsSubstitutions: layer.jsSubstitutions,
    command: `node tests/world-factory/drivers/a5sf-pd18-web-ptc/run-boot.mjs${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
  }, null, 2) + '\n')
  log(`START head=${head} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA} boots=${String(BOOTS_WANTED)}`)
  log(`host porcelain before: ${JSON.stringify(hostPorcelain())}`)
  if (hostPorcelain().length !== 0) throw new Error('the pinned host tree is not clean (porcelain non-empty): refusing to boot')

  const results = []
  for (let i = 1; i <= BOOTS_WANTED; i += 1) {
    const r = await bootOnce({ index: i, head, grant, layer, baseDir: EVIDENCE })
    results.push(r)
    if (r?.failed === true) {
      log(`boot ${String(i)} failed at ${String(r.stage)}; continuing is pointless (no agreeing pair)`)
      break
    }
  }

  const agreement = buildAgreement(results)
  writeFileSync(join(EVIDENCE, 'agreement.json'), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(EVIDENCE, 'agreement.txt'), agreement.table + '\n')
  log(agreement.table)
  const porcelain = hostPorcelain()
  writeFileSync(join(EVIDENCE, 'host-tree-porcelain.txt'), porcelain.length === 0 ? 'empty\n' : porcelain.join('\n') + '\n')
  log(`host porcelain after: ${JSON.stringify(porcelain)}`)
  if (porcelain.length !== 0) process.exitCode = 1
  const allOk = results.length === BOOTS_WANTED && results.every((r) => r?.failed !== true && r?.overall === 'PASS')
  // A pair is required only when two or more boots were asked for; a single
  // `--boots 1` development iteration is judged on its own record.
  const pairOk = BOOTS_WANTED < 2 || agreement.agreeing === true
  log(`RESULT ${allOk ? 'PASS' : 'FAIL'} (${String(results.length)}/${String(BOOTS_WANTED)} boots; agreeing pair=${String(agreement.agreeing)})`)
  if (!allOk || !pairOk) process.exitCode = 1
}

function hostDigest() {
  try { return execFileSync('git', ['-C', HOST_TREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { return null }
}

/** The two-run agreement table: the facts that must be IDENTICAL. */
function buildAgreement(results) {
  const ok = results.filter((r) => r?.failed !== true)
  const pick = (r) => ({
    overall: r?.overall ?? null,
    admittedVerdict: r?.verdicts?.admitted?.verdict ?? null,
    deniedVerdict: r?.verdicts?.denied?.verdict ?? null,
    surfaceVerdict: r?.verdicts?.surface?.verdict ?? null,
    workflowRefusalVerdict: r?.verdicts?.workflow?.verdict ?? null,
    webRefusalVerdict: r?.verdicts?.web?.verdict ?? null,
    leaderWorkflowVerdict: r?.verdicts?.leaderWorkflow?.verdict ?? null,
    factsVerdict: r?.verdicts?.facts?.verdict ?? null,
    spawnsVerdict: r?.verdicts?.spawns?.verdict ?? null,
    allowFacts: r?.counters?.guardFacts?.allow ?? null,
    denyFacts: r?.counters?.guardFacts?.deny ?? null,
    confinedTurnLaunchers: r?.counters?.confinedTurnLaunchers ?? null,
    ptcRuntimeInMemberWindow: r?.counters?.ptcRuntimeInMemberWindow ?? null,
    endpointRequests: r?.counters?.endpointRequests ?? null,
    preflightLaunchers: r?.counters?.preflightLaunchers ?? null,
    payloadInLane: r?.counters?.payloadInLaneSightings ?? null,
    procSecretCommandSightings: r?.counters?.procSecretCommandSightings ?? null,
    baseBwrapWithMarkers: r?.counters?.baseBwrapWithMarkers ?? null,
    governedSurface: r?.verdicts?.surface?.verdict === 'PROVEN',
    admittedBytes: (() => {
      const c = r?.transcript?.calls?.find((x) => String(x.callId) === CALL_ADMIT)
      try { return JSON.parse(c?.result?.text ?? '{}')?.stdout?.includes(IN_LANE_TEXT) === true } catch { return false }
    })(),
    deniedSecretAbsent: (() => {
      const c = r?.transcript?.calls?.find((x) => String(x.callId) === CALL_DENY)
      return c?.result !== null && String(c?.result?.text ?? '').includes(SECRET_TEXT) === false && String(c?.result?.text ?? '').includes('IO_READ_DENIED')
    })(),
    transcriptSourceCount: r?.transcript?.calls?.length ?? null,
  })
  const rows = ok.map((r) => ({ boot: r.boot, ...pick(r) }))
  const keys = [
    'overall', 'admittedVerdict', 'deniedVerdict', 'surfaceVerdict',
    'workflowRefusalVerdict', 'webRefusalVerdict', 'leaderWorkflowVerdict', 'factsVerdict', 'spawnsVerdict',
    // NOT included: `preflightLaunchers` (the realm's attach-time probe count is
    // environmental — measured 3 vs 4 across two otherwise identical boots).
    // NOT included: `payloadInLane` — the 40 ms /proc sampler races the
    // transient `cat` process inside `cat; sleep 1.5` (measured 0 vs 1 across
    // otherwise identical boots). The INVARIANT that matters is that no
    // out-of-lane payload appears (`procSecretCommandSightings`) and that the
    // admitted read returned its bytes (`admittedBytes`); both are stable.
    'allowFacts', 'denyFacts', 'confinedTurnLaunchers', 'ptcRuntimeInMemberWindow', 'endpointRequests',
    'procSecretCommandSightings', 'baseBwrapWithMarkers', 'governedSurface', 'admittedBytes',
    'deniedSecretAbsent', 'transcriptSourceCount',
  ]
  const differing = keys.filter((k) => new Set(rows.map((r) => JSON.stringify(r[k]))).size > 1)
  const agreeing = rows.length >= 2 && differing.length === 0
  const header = ['fact', ...rows.map((r) => `boot${String(r.boot)}`)]
  const body = keys.map((k) => [k, ...rows.map((r) => String(r[k]))])
  const width = Math.max(28, ...header.map((h) => h.length)) + 2
  const cell = (v) => String(v).padEnd(width)
  const table = [
    'TWO-RUN AGREEMENT (the same command, two boots; every row must be identical)',
    header.map(cell).join('').replace(/ +$/u, ''),
    ...body.map(([k, ...vals]) => `${cell(k)}${vals.map(cell).join('')}`.replace(/ +$/u, '')),
    '',
    `agreeing=${String(agreeing)} differing=${JSON.stringify(differing)}`,
  ].join('\n')
  return { schema: 'a5sf-pd18-web-ptc/agreement/1', at: new Date().toISOString(), boots: results.length, agreeing, differing, rows, table }
}

main().catch((error) => {
  log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
