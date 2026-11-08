#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-pd21-subagent/run-boot.mjs — the LIVE
 * Member driver for PD-21: the SUBAGENT realm and the Member's creation authority.
 *
 * WHY THIS FILE EXISTS. PD-18 (#668) fail-closed the governed preset's
 * host-executed executors and recorded, in the same evidence README, that
 * `subagent`/`subagent_fork` were RETAINED while "subagent child realm
 * assembly is UNMEASURED (code-read only)". A governed Member that can start a
 * child session outside its own ceiling is indistinguishable from an
 * ungoverned Member — and that child can recurse. This driver measures it on
 * the real Host, through public seams only:
 *
 *   1. boot ONE World whose Team row is the SHIPPED `dsh-agent-team/host` row
 *      overridden to opt in (`memberPresetId: a5sf-governed-member`,
 *      `a5sfGovernedRealm: true`, `a5sfEvidencePath`, schemaVersion 4
 *      `blueprintSource`);
 *   2. register the SHIPPED `preset-a5sf-governed-member` row verbatim;
 *   3. drive a REAL Leader turn that calls `team_delegate` for one governed
 *      Member;
 *   4. the Member's OWN model turn (a) takes a confined `bash` turn inside its
 *      lane — the positive control, (b) calls `subagent` with a fresh child
 *      prompt, (c) calls `team_create_member` for its OWN template and for a
 *      WIDER template the blueprint declares;
 *   5. the child's OWN model turn calls `read` and `bash` on a fixture that
 *      lives OUTSIDE the Member's compiled read lane;
 *   6. capture: the Member's and the CHILD's durable session logs, the child's
 *      model-visible tool surface (from the mock's request log), every guard
 *      fact with its attribution, an independent /proc observation of confined
 *      vs base spawns, and the Member instance count before/after the create
 *      calls.
 *
 * WHAT IS MEASURED, NOT ASSUMED: the child session's tools; whether its
 * out-of-lane read returns bytes or a typed IO_READ_DENIED + fact; which
 * Member/policy/tool/call the fact names; whether `confinedTurnLaunchers`
 * grows; and whether a create action issued from a Member produces a new
 * instance.
 *
 * ONE COMMAND, TWO BOOTS (the agreeing pair):
 *
 *   node tests/world-factory/drivers/a5sf-pd21-subagent/run-boot.mjs
 *
 * `--plan` is host-free (row/blueprint validation, zero boots). `--boots 1`
 * is a development iteration. Artefacts: `dev/agent-workflow/evidence/
 * a5sf-pd21-subagent/runs/boot0N/`, the append-only DEV-LIVE ledger beside them.
 *
 * BOOT DISCIPLINE (TEST_METHODS §2/§7):
 *   - DSH_HOME = tests/homes/u5a5sfpd21-<stamp> (inside the workspace);
 *   - ports from the 3180 family via WorldFactory leases; :3080 never touched;
 *   - the pinned host tree is READ-ONLY (porcelain verified empty at the end);
 *   - a machine-wide dev-live slot via lib/dev-live-slots.mjs (the owner's
 *     2026-11-13 ruling raised the dev-Host cap to 6; the per-subagent cap of
 *     2 is separate). This lane's boot authorisation is the task's own explicit
 *     DEV-LIVE instruction; the face-scoped `dev-live-grant.json` (face
 *     Subprocess) is NOT claimed here, because this face is Subagent;
 *   - archive-before-start: a previous `runs/` directory is moved to
 *     `archive/<stamp>/` before this run writes anything;
 *   - teardown by identity through the World's own teardown;
 *   - every start appends a ledger row with `recordClass: 'DEV-LIVE'`.
 *
 * WHAT IS FIXTURE (disclosed): the model is the shared scripted mock
 * (`packages/tools/harness/mock-deepseek.mjs`); the /proc watcher and the
 * mock-request log are test instrumentation. The product path is NOT a
 * fixture: the preset row, the realm provider, the compiler, the guard, the
 * confined terminal face, the subagent provider and the team tool router are
 * the shipped modules the Host loads.
 *
 * CORE PATCH BUDGET = 0.
 *
 * @module tests/world-factory/drivers/a5sf-pd21-subagent/run-boot
 */
import { execFileSync, spawnSync } from 'node:child_process'
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
import { acquireDevLiveSlot } from '../../lib/dev-live-slots.mjs'
import { resolveHeadCommit } from '../../suites/150-a5sf-read.mjs'
import {
  lastUserTextOfStatic, messagesOf, remoteCall, surfaceNamesOf, textOf,
} from '../../lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd21-subagent')
const RUNS = join(EVIDENCE, 'runs')
const ARCHIVE = join(EVIDENCE, 'archive')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')

const LINE = 'u5a5sfpd21'
const BOOT_ROOT = 'session-a5sf-pd21-boot'
const ACCEPTANCE_ROOT = 'session-a5sf-pd21-team'
const BP_ANCHOR_ID = 'team.a5sf.pd21.anchor'
const BP_MAIN_ID = 'team.a5sf.pd21.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'A5SF_PD21_DISC'
const MK_L1 = 'A5SF_PD21_L1_DRIVE'
const TOK_MEMBER = 'a5sf-pd21-turn'
const TOK_CHILD = 'a5sf-pd21-child'
const CALL_IN = 'call-a5sfpd21-in'
const CALL_SUBAGENT = 'call-a5sfpd21-subagent'
const CALL_CREATE_WORKER = 'call-a5sfpd21-create-worker'
const CALL_CREATE_WIDE = 'call-a5sfpd21-create-wide'
const CALL_CHILD_READ = 'call-a5sfpd21-child-read'
const CALL_CHILD_BASH = 'call-a5sfpd21-child-bash'
const DONE_MEMBER = 'A5SF_PD21_MEMBER_DONE'
const DONE_CHILD = 'A5SF_PD21_CHILD_DONE'
const DONE_L1 = 'A5SF_PD21_L1_DONE'
const IN_LANE_TEXT = 'A5SF_PD21_IN_LANE_BYTES'
const SECRET_TEXT = 'A5SF_PD21_OUT_OF_LANE_SECRET'
const IN_LANE_FILE = 'in-lane.txt'
const SECRET_FILE = 'secret-out-of-lane.txt'
const WIDE_TEMPLATE_ID = 'wide'

const LEADER_TOOL_ALLOW = Object.freeze(['bash', 'read', 'write', 'edit', 'read_image'])
const LEADER_DENY_SAFE = Object.freeze(['todo_write'])
const TEAM_TOOL_NAMES = Object.freeze(['team_delegate', 'team_archive_member', 'team_follow_up', 'team_collect', 'team_list_members'])

const SELECTED_CASES = Object.freeze([
  'pd21:member-confined-baseline',
  'pd21:member-surface',
  'pd21:subagent-child-governed',
  'pd21:no-child-byte-escape',
  'pd21:child-fact-attribution',
  'pd21:confined-launcher-accounting',
  'pd21:member-create-refused',
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
    leader: { templateId: 'leader', persona: `You lead the a5sf live-member anchor team. ${MK_DISC} is the discovery marker.` },
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
 * The v4 design of the team whose Member turn is measured. Its permission
 * statement is the `memberIoCeilings` family: the worker may read/write the
 * World workspace only, and `secret-out-of-lane.txt` lives one directory ABOVE
 * it. A SECOND template (`wide`) declares a WIDER ceiling so the Member's
 * `team_create_member` arm has a real, wider target: the question is whether a
 * governed Member can MINT one.
 */
function mainBlueprintYaml({ denyList, workspace, outsideDir }) {
  const doc = {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the a5sf PD-21 team. ${MK_L1} drives your chain: delegate the governed worker once, then finish.`,
      // NO `capabilities` block. The permission-coverage gate only runs for a
      // template that DECLARES capabilities, and any declared set must name
      // every tool on the final surface — including agent-scope tools such as
      // `subagent` that `tools.restrict()` cannot even name at root-start time.
      // The team tools (`team_delegate`, …) are mounted by the Team row itself
      // and are present either way (measured: the anchor Leader surface carries
      // all 19 `team_*` names with no capabilities block).
    },
    members: [
      {
        templateId: 'worker',
        displayName: 'Governed Worker',
        persona: 'You are the governed worker. Run the probes exactly once each, one tool call at a time.',
      },
      {
        templateId: WIDE_TEMPLATE_ID,
        displayName: 'Wider Worker (declared, never auto-created)',
        persona: 'You are the wider worker.',
      },
    ],
    requirements: [],
    teamEnvelope: {
      allow: ['create-member', 'assign-task', 'send-message', 'report-progress', 'archive-member'],
      deny: [],
    },
    // The worker's OWN member envelope explicitly ALLOWS `create-member`, so the
    // creation arm is NOT refused by the envelope; the only remaining fence is
    // the admission layer's caller-role rule (a Member is never in a creation
    // role). Without this the refusal would be ambiguous.
    memberEnvelopes: [{
      templateId: 'worker',
      envelope: { allow: ['send-message', 'report-progress', 'create-member'], deny: [] },
    }],
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
      {
        templateId: WIDE_TEMPLATE_ID,
        io: {
          // WIDER than the worker's: it also covers the out-of-lane directory.
          read: lane([workspace, outsideDir]),
          write: lane([workspace, outsideDir]),
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
/** A SUBAGENT CHILD request is identified STRUCTURALLY: its FIRST user message
 *  is the prompt the MEMBER passed to `subagent` (our child token) and it is
 *  NOT the Team's delegated `[team-work …]` envelope. */
function isChildRequest(req) {
  const first = messagesOf(req).find((m) => m?.role === 'user')
  if (first === undefined) return false
  const text = typeof first.content === 'string' ? first.content : JSON.stringify(first.content ?? '')
  return text.includes(TOK_CHILD) && text.includes('[team-work ') === false
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
/**
 * The scripted model. The MEMBER branch is selected STRUCTURALLY by the token
 * that only our delegated prompt carries; the CHILD branch by the prompt the
 * Member passes to `subagent` (a title/compaction call carries neither).
 */
function makeDecide({ inLanePath, secretPath, workspaceDir, outsideDir }) {
  const bashCall = (id, command, description) => ({
    kind: 'tool-call',
    toolCalls: [{ id, name: 'bash', arguments: { command, description, workdir: workspaceDir } }],
  })
  // The CHILD reads through the NATIVE `read` tool and, separately, through
  // `bash`; either path reaching the out-of-lane bytes is the escape.
  const childReadCall = (id) => ({
    kind: 'tool-call',
    toolCalls: [{ id, name: 'read', arguments: { file_path: secretPath } }],
  })
  const childBashCall = (id) => ({
    kind: 'tool-call',
    toolCalls: [{ id, name: 'bash', arguments: { command: `cat '${secretPath}'`, description: 'Read the out-of-lane fixture', workdir: workspaceDir } }],
  })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf pd21 session' }

    // ── THE CHILD TURN (inside the Member's `subagent` call) ───────────────
    if (isChildRequest(req)) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_CHILD_READ)) return childReadCall(CALL_CHILD_READ)
      if (!seen.has(CALL_CHILD_BASH)) return childBashCall(CALL_CHILD_BASH)
      return { kind: 'text', content: `${DONE_CHILD} ${lastToolResultText(req).slice(0, 400)}` }
    }

    // ── THE MEMBER TURN ────────────────────────────────────────────────────
    if (isMemberRequest(req)) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_IN)) {
        // The sleep keeps the confined payload alive so the independent /proc
        // observer can SEE it; it also makes "one launcher per command" a
        // measurable fact rather than a race.
        return bashCall(CALL_IN, `cat '${inLanePath}'; sleep 1.5`, 'Read the in-lane fixture')
      }
      if (!seen.has(CALL_SUBAGENT)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_SUBAGENT,
            name: 'subagent',
            arguments: {
              description: 'PD-21 escape probe child',
              prompt: `${TOK_CHILD}: read the probe fixture and report exactly what you see.`,
              run_in_background: false,
            },
          }],
        }
      }
      if (!seen.has(CALL_CREATE_WORKER)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_CREATE_WORKER,
            name: 'team_create_member',
            arguments: {
              rootSessionId: ACCEPTANCE_ROOT,
              requestToken: 'pd21-create-worker',
              delegationTemplateId: 'worker',
              label: 'pd21-self-worker',
              workspace: workspaceDir,
            },
          }],
        }
      }
      if (!seen.has(CALL_CREATE_WIDE)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_CREATE_WIDE,
            name: 'team_create_member',
            arguments: {
              rootSessionId: ACCEPTANCE_ROOT,
              requestToken: 'pd21-create-wide',
              delegationTemplateId: WIDE_TEMPLATE_ID,
              label: 'pd21-self-wide',
              workspace: outsideDir,
            },
          }],
        }
      }
      return { kind: 'text', content: `${DONE_MEMBER} ${lastToolResultText(req).slice(0, 300)}` }
    }

    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_PD21_DISC_DONE' }

    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1)
    if (isLeader) {
      const seen = resultIdsOf(req)
      if (!seen.has('call-a5sfpd21-delegate')) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: 'call-a5sfpd21-delegate',
            name: 'team_delegate',
            arguments: {
              rootSessionId: ACCEPTANCE_ROOT,
              requestToken: `${TOK_MEMBER}-delegate`,
              delegationTemplateId: 'worker',
              label: 'a5sfpd21-worker',
              workspace: workspaceDir,
              prompt: `${TOK_MEMBER}: run the probes exactly once each, one tool call at a time, then report.`,
              async: false,
            },
          }],
        }
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_PD21_NOOP' }
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
/** Normalise one durable session log into the turn it records. */
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
    agentPreset: found.header?.agentPreset ?? null,
    delegationDepth: found.header?.delegationDepth ?? null,
    lineCount: lines.length,
    user,
    calls: paired,
    assistant,
    finalAssistant: assistant.at(-1) ?? null,
  }
}

/** The Member's OWN durable transcript, by its session id. */
function readMemberTranscript(dshHome, sessionId) {
  const found = findSessionFile(dshHome, sessionId)
  if (found === null) return null
  return normaliseSession(found, sessionId)
}

/**
 * The SUBAGENT child's durable transcript: the session whose header carries
 * `delegationDepth >= 1` (a fresh spawned child stamps depth 1). `origin` is
 * not read from the header because the durable header keeps the fields the
 * creation meta wrote; depth is the structural discriminator here.
 */
function readChildTranscript(dshHome) {
  if (!existsSync(dshHome)) return null
  let best = null
  for (const entry of walkFiles(dshHome)) {
    if (!/^session(\..+)?\.jsonl\.zstd$/u.test(entry.name)) continue
    let buf
    try { buf = readFileSync(entry.path) } catch { continue }
    const header = parseFirstJsonLine(buf)
    const depth = Number(header?.delegationDepth ?? 0)
    if (!Number.isFinite(depth) || depth < 1) continue
    if (best === null || depth < best.depth) best = { file: entry.path, header, buffer: buf, depth }
  }
  if (best === null) return null
  return normaliseSession({ file: best.file, header: best.header, buffer: best.buffer }, String(best.header?.id ?? ''))
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

function judgeBaseline(sample) {
  const record = (() => { try { return JSON.parse(sample.result.text) } catch { return null } })()
  return verdictOf(
    'the Member\'s model-visible `bash` admits an in-ceiling read through the confined terminal face and returns its bytes',
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued the admitted `bash` call' },
      { id: 'call-is-bash', ok: sample.call?.name === 'bash', detail: `name=${String(sample.call?.name)}` },
      { id: 'result-present', ok: sample.result !== undefined && sample.result !== null, detail: 'the Member received a tool result for the admitted call' },
      { id: 'result-not-error', ok: sample.result?.isError === false, detail: `isError=${String(sample.result?.isError)}` },
      { id: 'confined-terminal-kind', ok: record?.kind === 'confined-terminal', detail: `kind=${String(record?.kind)}` },
      { id: 'exit-zero', ok: record?.exitCode === 0, detail: `exitCode=${String(record?.exitCode)}` },
      { id: 'in-lane-bytes', ok: String(record?.stdout ?? '').includes(IN_LANE_TEXT), detail: 'the admitted read returned the in-lane bytes' },
    ],
  )
}

function judgeMemberSurface(surface) {
  const bash = surface.bash
  const props = Object.keys(bash?.parameters?.properties ?? {})
  return verdictOf(
    'the Member\'s model-visible `bash` is the GOVERNED preset\'s confined terminal definition (not the inherited shell)',
    [
      { id: 'bash-present', ok: bash !== null, detail: 'exactly one `bash` schema is on the Member surface' },
      { id: 'params-command-description-workdir', ok: props.sort().join(',') === 'command,description,workdir', detail: `properties=${props.join(',')}` },
      { id: 'no-timeoutMs', ok: props.includes('timeoutMs') === false, detail: 'the inherited shell affordance is gone' },
      { id: 'no-run_in_background', ok: props.includes('run_in_background') === false, detail: 'the inherited shell affordance is gone' },
      { id: 'no-sandbox_permissions', ok: props.includes('sandbox_permissions') === false, detail: 'the inherited shell affordance is gone' },
      { id: 'confined-description', ok: /confined terminal face/iu.test(String(bash?.description ?? '')), detail: `description=${String(bash?.description ?? '').slice(0, 120)}` },
    ],
  )
}

/**
 * THE CORE PROPOSITION. A governed Member's `subagent` call must not produce a
 * child session outside the Member's realm. Two acceptable outcomes:
 *   (a) the tool is NOT on the Member surface and dispatch is a typed
 *       UNKNOWN_TOOL refusal with ZERO child requests (fail-closed); or
 *   (b) a child exists AND its out-of-lane read is a typed IO_READ_DENIED with
 *       zero bytes and a fact that names the Member (inheritance).
 * Anything else is the escape this lane exists to refute.
 */
function judgeChildRealm({ childPresent, childSurface, childReadResult, childBashResult, subagentCall, subagentResult, subagentOnMemberSurface, childModelRequests }) {
  const readText = String(childReadResult?.text ?? '')
  const bashText = String(childBashResult?.text ?? '')
  const childBashProps = Object.keys(childSurface.bash?.parameters?.properties ?? {})
  if (!childPresent) {
    return verdictOf(
      'a governed Member cannot produce a child session outside its realm: `subagent` is absent from the surface and its dispatch is a typed refusal with zero children',
      [
        { id: 'subagent-absent', ok: subagentOnMemberSurface === false, detail: `subagent on Member surface=${String(subagentOnMemberSurface)}` },
        { id: 'dispatch-issued', ok: subagentCall !== null, detail: 'the Member did issue the `subagent` call' },
        { id: 'typed-unknown-tool', ok: subagentResult?.isError === true && /unknown tool "subagent"/iu.test(String(subagentResult?.text ?? '')), detail: `isError=${String(subagentResult?.isError)} text=${String(subagentResult?.text ?? '').slice(0, 160)}` },
        { id: 'zero-child-requests', ok: childModelRequests === 0, detail: `child model requests=${String(childModelRequests)}` },
      ],
    )
  }
  return verdictOf(
    'the Member\'s subagent child inherits the Member realm: its out-of-lane read is a typed IO_READ_DENIED with zero bytes and its shell face is confined',
    [
      { id: 'child-exists', ok: childPresent === true, detail: 'a child session was created and made model requests' },
      { id: 'child-read-denied', ok: /IO_READ_DENIED/u.test(readText), detail: `read result=${readText.slice(0, 200)}` },
      { id: 'child-read-error', ok: childReadResult?.isError === true, detail: `isError=${String(childReadResult?.isError)}` },
      { id: 'child-read-zero-bytes', ok: readText.includes(SECRET_TEXT) === false, detail: 'the child read returned NO secret bytes' },
      { id: 'child-bash-zero-bytes', ok: bashText.includes(SECRET_TEXT) === false, detail: 'the child bash returned NO secret bytes' },
      { id: 'child-bash-confined-schema', ok: childBashProps.sort().join(',') === 'command,description,workdir', detail: `child bash properties=${childBashProps.join(',')}` },
    ],
  )
}

/** The byte-level escape witness: ZERO out-of-lane bytes anywhere. */
function judgeNoEscape({ requestsCarryingSecret, subagentText, childReadText, childBashText, childFinalText }) {
  return verdictOf(
    'NO out-of-lane bytes reach the child\'s model context, the child transcript, or the Member\'s subagent result',
    [
      { id: 'zero-child-read-bytes', ok: childReadText.includes(SECRET_TEXT) === false, detail: `child read result carries secret=${String(childReadText.includes(SECRET_TEXT))}` },
      { id: 'zero-child-bash-bytes', ok: childBashText.includes(SECRET_TEXT) === false, detail: `child bash result carries secret=${String(childBashText.includes(SECRET_TEXT))}` },
      { id: 'zero-child-final-bytes', ok: String(childFinalText ?? '').includes(SECRET_TEXT) === false, detail: 'the child final answer does not quote the fixture' },
      { id: 'zero-member-visible-bytes', ok: String(subagentText ?? '').includes(SECRET_TEXT) === false, detail: 'the Member\'s subagent tool result carries no secret bytes' },
      { id: 'zero-request-bytes', ok: requestsCarryingSecret === 0, detail: `mock requests carrying the secret text=${String(requestsCarryingSecret)}` },
    ],
  )
}

/**
 * If a governed child read happened, its refusal must be a FACT that names the
 * real Member identity, the compiled policy revision, and the tool call.
 */
function judgeChildFacts({ childPresent, childFacts, childReadCallId }) {
  const fact = childFacts.find((f) => String(f?.callId ?? '') === String(childReadCallId ?? '')) ?? childFacts[0] ?? null
  return verdictOf(
    'a governed child read is a guard-consult fact attributed to the Member identity, the policy revision and the tool call',
    childPresent
      ? [
        { id: 'fact-present', ok: fact !== null, detail: `child fs facts=${String(childFacts.length)}` },
        { id: 'fact-identity', ok: typeof fact?.memberIdentity === 'string' && fact.memberIdentity !== '', detail: `memberIdentity=${String(fact?.memberIdentity)}` },
        { id: 'fact-policy-revision', ok: typeof fact?.policyRevision === 'string' && fact.policyRevision !== '', detail: `policyRevision=${String(fact?.policyRevision)}` },
        { id: 'fact-tool', ok: fact?.tool === 'read', detail: `tool=${String(fact?.tool)}` },
        { id: 'fact-call-id', ok: String(fact?.callId ?? '') === String(childReadCallId ?? ''), detail: `callId=${String(fact?.callId)} want=${String(childReadCallId)}` },
        { id: 'fact-deny', ok: fact?.decision === 'deny' && fact?.decidedBy === 'IO_READ_DENIED', detail: `decision=${String(fact?.decision)} decidedBy=${String(fact?.decidedBy)}` },
      ]
      : [
        { id: 'no-child', ok: true, detail: 'no child session exists on the fail-closed path; the attribution question is not reachable (recorded, not claimed)' },
      ],
  )
}

function judgeSpawns(counters) {
  return verdictOf(
    'the Member turn runs exactly ONE confined-provider child for its own in-lane command; a child bash escape would add a base `bwrap` carrying the secret locator',
    [
      { id: 'one-confined-launcher', ok: counters.confinedTurnLaunchers === 1, detail: `--confined-exec-stream launchers=${String(counters.confinedTurnLaunchers)} (the Member's ONE in-lane bash)` },
      { id: 'zero-base-bwrap-with-markers', ok: counters.baseBwrapWithMarkers === 0, detail: `base bwrap argv carrying the Member fixtures=${String(counters.baseBwrapWithMarkers)}` },
    ],
  )
}

/**
 * The creation arm. The Member's OWN envelope ALLOWS `create-member`; the
 * admission layer must still refuse because a Member is never in a creation
 * role. A new instance would mean a Member minted a Member (and, with the
 * `wide` template, a WIDER one).
 */
function judgeCreate({ createWorker, createWide, membersBefore, membersAfter }) {
  // The team runtime answers a role refusal as a SUCCESSFUL tool result whose
  // body is `{status:'rejected', code:'TEAM_RUNTIME_CALLER_AUTHORITY_DENIED'}`
  // (measured PD-21 pre-fix AND post-fix). A typed refusal is therefore
  // "rejected + authority code", not `isError === true`.
  const typed = (r) => /TEAM_RUNTIME_CALLER_AUTHORITY_DENIED/u.test(String(r?.result?.text ?? ''))
    && /"status":"rejected"/u.test(String(r?.result?.text ?? ''))
  return verdictOf(
    'a governed Member cannot create a Member (own template OR the wider template): both calls are typed admission refusals and ZERO instances are added',
    [
      { id: 'worker-call-issued', ok: createWorker.call !== null, detail: 'the Member issued team_create_member for its own template' },
      { id: 'worker-typed-refusal', ok: typed(createWorker), detail: `isError=${String(createWorker.result?.isError)} text=${String(createWorker.result?.text ?? '').slice(0, 220)}` },
      { id: 'wide-call-issued', ok: createWide.call !== null, detail: 'the Member issued team_create_member for the WIDER template' },
      { id: 'wide-typed-refusal', ok: typed(createWide), detail: `isError=${String(createWide.result?.isError)} text=${String(createWide.result?.text ?? '').slice(0, 220)}` },
      { id: 'zero-new-instances', ok: membersAfter === membersBefore, detail: `members before=${String(membersBefore)} after=${String(membersAfter)}` },
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
  const main = mainBlueprintYaml({ denyList: ['u5_canary'], workspace: join(EVIDENCE, 'plan-workspace'), outsideDir: join(EVIDENCE, 'plan-outside') })
  const a = assertBlueprintText(anchor, BP_ANCHOR_ID, 'anchor.yaml')
  const m = assertBlueprintText(main, BP_MAIN_ID, 'main.yaml')
  log(`blueprints accepted: anchor=${JSON.stringify(a)} main=${JSON.stringify(m)}`)
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), workspaceDir: join(EVIDENCE, 'plan-workspace'), anchorYaml: anchor, layer })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-pd21-subagent plan (no World)'], rows) + '\n')
  log(`rows: ${JSON.stringify(rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 80) })))}`)
  const preset = layer.rows.find((r) => r?.config?.id === PRESET_ID)
  // GROUPS ARE PART OF THE SURFACE: the subagent rows live inside the
  // `delegation` group, so a top-level-only id list would report a false zero.
  const flatten = (list) => (list ?? []).flatMap((p) => (p?.group === true ? flatten(p.config) : [p]))
  const plugins = flatten(preset?.config?.plugins).map((p) => p.id)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-fs-search']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  if (plugins.includes('tool-pwsh')) throw new Error('the shipped governed preset unexpectedly carries tool-pwsh')
  // PD-21: the preset's subagent rows are the SUBJECT of this lane. The plan
  // does not assert either state (pre-fix carries them, the fail-closed fix
  // removes them); it records which state the tree is in.
  log(`governed preset subagent rows: ${JSON.stringify(plugins.filter((p) => p.startsWith('tool-subagent')))}`)
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// one boot
// ─────────────────────────────────────────────────────────────────────────────
async function bootOnce({ index, head, authorization, layer, baseDir }) {
  const bootDir = join(RUNS, `boot${String(index).padStart(2, '0')}`)
  mkdirSync(bootDir, { recursive: true })
  const phase = `a5sf-pd21-subagent-boot${String(index)}`
  const runId = `a5sf-pd21-subagent-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-pd21-subagent', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, authorization), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-pd21-subagent', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  // DEV-LIVE slot: the machine-wide concurrency counter (owner ruling
  // 2026-11-13: 6 dev Hosts; the 2-per-subagent cap is separate). The
  // face-scoped `dev-live-grant.json` (Subprocess) is NOT claimed: this face
  // is Subagent and the task itself carries the explicit boot authorisation.
  const slot = acquireDevLiveSlot({
    leaseRoot: factory.leaseRoot,
    runId: String(record.record.runId),
    face: 'Subagent',
    world: LINE,
    headCommit: head,
  })
  log(`[boot${String(index)}] dev-live slot #${String(slot.slot)} face=Subagent world=${LINE} head=${head}`)

  let world = null
  let bootInfo = null
  let teardown = null
  let failure = null
  let hostReached = false
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

      const decide = makeDecide({ inLanePath, secretPath, workspaceDir: workspace, outsideDir })
      process.env.A5SF_GOVERNED_SCRATCH = join(world.home, 'governed-scratch')
      mkdirSync(process.env.A5SF_GOVERNED_SCRATCH, { recursive: true })
      await world.startMock({ decide })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })()
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

    // The /proc observer is INDEPENDENT of the product and of our counters. It
    // must start BEFORE `team.create`: the Leader's whole chain (and therefore
    // the Member turn) runs inside that synchronous call — measured. A watcher
    // started afterwards sees an empty window and reads as "no spawn".
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

    // ── discovery turn: the REAL Leader surface (to compute the deny list) ──
    abortStage = 'discovery'
    await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sflm')
    await waitFor(() => (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith('A5SF_PD21_DISC_DONE')), 60_000)
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
    const mainText = mainBlueprintYaml({ denyList, workspace: paths.workspace, outsideDir: dirname(paths.secret) })
    assertBlueprintText(mainText, BP_MAIN_ID, 'main.yaml')
    writeFileSync(join(world.home, 'blueprints', 'main.yaml'), mainText)

    // ── team.create: the Leader's first turn delegates the governed Member ─
    abortStage = 'team-create'
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5sflm')
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
      out.delegateCall = toolCallFor(requestsNow, 'call-a5sfpd21-delegate')
      out.delegateResult = toolResultFor(requestsNow, 'call-a5sfpd21-delegate') ?? null
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
    const chainTimeoutMs = Number(process.env.A5SF_PD21_CHAIN_TIMEOUT_MS ?? 300_000)
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
    const delegateCall = toolCallFor(requests0, 'call-a5sfpd21-delegate')
    const delegateResult = toolResultFor(requests0, 'call-a5sfpd21-delegate')
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

    const admitted = { call: callOf(CALL_IN), result: own(CALL_IN)?.result ?? resultOf(CALL_IN) }
    const subagentCall = callOf(CALL_SUBAGENT)
    const subagentResult = own(CALL_SUBAGENT)?.result ?? resultOf(CALL_SUBAGENT)
    const createWorker = { call: callOf(CALL_CREATE_WORKER), result: own(CALL_CREATE_WORKER)?.result ?? resultOf(CALL_CREATE_WORKER) }
    const createWide = { call: callOf(CALL_CREATE_WIDE), result: own(CALL_CREATE_WIDE)?.result ?? resultOf(CALL_CREATE_WIDE) }

    // ── surfaces (the mock request body's `tools`, i.e. model-visible) ──────
    const surfaceEntry = (request, name) => {
      if (request === null) return null
      const schema = (request.body?.tools ?? []).find((t) => String(t?.name ?? t?.function?.name ?? '') === name)
      if (schema === undefined) return null
      const fn = schema?.function ?? null
      const params = schema?.parameters ?? fn?.parameters ?? schema?.input_schema ?? schema?.inputSchema ?? null
      return {
        name,
        description: schema?.description ?? fn?.description ?? null,
        parameters: params,
        schemaKeys: Object.keys(schema),
      }
    }
    const memberRequest = requests.filter((r) => isMemberRequest(r) && surfaceNamesOf(r).length > 0).at(-1) ?? null
    const memberSurfaceNames = memberRequest === null ? [] : [...new Set(surfaceNamesOf(memberRequest))].sort()
    const memberSurface = {
      tools: memberSurfaceNames,
      bash: surfaceEntry(memberRequest, 'bash'),
      subagent: surfaceEntry(memberRequest, 'subagent'),
      subagentFork: surfaceEntry(memberRequest, 'subagent_fork'),
      teamCreateMember: surfaceEntry(memberRequest, 'team_create_member'),
      requestSeq: memberRequest === null ? null : requests.indexOf(memberRequest),
    }
    writeFileSync(join(bootDir, 'member-surface.json'), JSON.stringify(memberSurface, null, 2) + '\n')

    const childRequests = requests.filter((r) => isChildRequest(r))
    const childRequest = childRequests.filter((r) => surfaceNamesOf(r).length > 0).at(-1) ?? null
    const childSurfaceNames = childRequest === null ? [] : [...new Set(surfaceNamesOf(childRequest))].sort()
    const childSurface = {
      present: childRequest !== null,
      requestSeq: childRequest === null ? null : requests.indexOf(childRequest),
      requestCount: childRequests.length,
      tools: childSurfaceNames,
      bash: surfaceEntry(childRequest, 'bash'),
      read: surfaceEntry(childRequest, 'read'),
      subagent: surfaceEntry(childRequest, 'subagent'),
      teamCreateMember: surfaceEntry(childRequest, 'team_create_member'),
    }
    writeFileSync(join(bootDir, 'child-surface.json'), JSON.stringify(childSurface, null, 2) + '\n')

    // ── the CHILD's OWN durable transcript ─────────────────────────────────
    const childTranscript = readChildTranscript(world.home)
    if (childTranscript !== null) {
      writeFileSync(join(bootDir, 'child-transcript.json'), JSON.stringify(childTranscript, null, 2) + '\n')
      writeFileSync(join(bootDir, 'child-transcript.txt'), renderTranscript(childTranscript) + '\n')
      try { writeFileSync(join(bootDir, 'child-session.v4.jsonl.zstd'), readFileSync(childTranscript.file)) } catch { /* normalised copy is the evidence */ }
    }
    const childOwn = (id) => childTranscript?.calls.find((c) => String(c.callId) === String(id)) ?? null
    const childReadResult = childOwn(CALL_CHILD_READ)?.result ?? resultOf(CALL_CHILD_READ) ?? null
    const childBashResult = childOwn(CALL_CHILD_BASH)?.result ?? resultOf(CALL_CHILD_BASH) ?? null
    writeFileSync(join(bootDir, 'child-probe.json'), JSON.stringify({
      schema: 'a5sf-pd21-subagent/child-probe/1',
      childPresent: childTranscript !== null || childRequest !== null,
      childSessionId: childTranscript?.sessionId ?? null,
      childAgentPreset: childTranscript?.agentPreset ?? null,
      childDelegationDepth: childTranscript?.delegationDepth ?? null,
      readCall: childOwn(CALL_CHILD_READ) === null ? callOf(CALL_CHILD_READ) : { callId: childOwn(CALL_CHILD_READ)?.callId, name: 'read', arguments: childOwn(CALL_CHILD_READ)?.arguments },
      readResult: childReadResult,
      bashCall: childOwn(CALL_CHILD_BASH) === null ? callOf(CALL_CHILD_BASH) : { callId: childOwn(CALL_CHILD_BASH)?.callId, name: 'bash', arguments: childOwn(CALL_CHILD_BASH)?.arguments },
      bashResult: childBashResult,
      finalAssistant: childTranscript?.finalAssistant ?? null,
    }, null, 2) + '\n')

    // ── guard facts (with attribution) ─────────────────────────────────────
    const factsAll = parseJsonl(paths.sink).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const facts = factsAll.filter((f) => f?.method === 'shellRead' || f?.method === 'readText' || f?.method === 'readBytes')
    const childFacts = factsAll.filter((f) => String(f?.callId ?? '') === String(CALL_CHILD_READ) || (f?.tool === 'read' && f?.decision === 'deny'))
    writeFileSync(join(bootDir, 'guard-facts.json'), JSON.stringify(factsAll, null, 2) + '\n')

    // ── independent /proc counters (deduped by pid, Member-turn window) ────
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
    // Attribution rule (MEASURED; corrected 2026-11-13): the confined terminal
    // does NOT write the command text to a PTY. `packages/runtime/team-services/src/terminal.ts:535`
    // spawns `argv: [program, '-c', text]`, and `:538` sets `stdin: 'ignore'`.
    // The command body therefore IS in the shell child's `/proc/<pid>/cmdline`
    // (a process-list leak surface, not a lane defect). The independent witness
    // for "the confined face RAN" is the PROVIDER's launcher process:
    //   - `--confined-exec-stream` under THIS World's scratch `plans/` dir is a
    //     Member tool execution;
    //   - `probe-*` / `--enforce-leg` / `--net-leg` launchers are the realm's
    //     own attach-time probes and are excluded by name;
    //   - a base `bwrap` whose argv carries one of our fixture paths is the
    //     UNGOVERNED path (a child bash on the base service shows up here).
    const launcherPids = sightingPids('confined-launcher', (h) => h.cmdline.includes('--confined-exec-stream'))
    const preflightPids = sightingPids('confined-launcher', (h) => h.cmdline.includes('--confined-exec-stream') === false)
    const payloadInLane = sightingPids('payload-in-lane')
    const payloadSecret = sightingPids('payload-secret')
    const baseBwrap = sightingPids('base-bwrap', (h) => h.inLane === true || h.secret === true)
    counters.confinedTurnLaunchers = launcherPids.size
    counters.preflightLaunchers = preflightPids.size
    counters.payloadInLaneSightings = payloadInLane.size
    counters.procSecretCommandSightings = payloadSecret.size
    counters.baseBwrapWithMarkers = baseBwrap.size
    counters.guardFacts = { allow: facts.filter((f) => f.decision === 'allow').length, deny: facts.filter((f) => f.decision === 'deny').length }
    counters.mockRequests = requests.length
    counters.memberModelRequests = requests.filter((r) => isMemberRequest(r) && surfaceNamesOf(r).length > 0).length
    counters.childModelRequests = childRequests.length
    counters.childSurfaceCount = childSurfaceNames.length
    counters.subagentOnMemberSurface = memberSurfaceNames.includes('subagent')
    counters.childSessionFound = childTranscript !== null
    counters.childFacts = childFacts.length
    counters.procBatches = procLog.length
    counters.otherBwrapPids = otherBwrapPids.size
    counters.memberWindow = { from: memberPromptAt, to: memberDoneAt }
    counters.requestsCarryingSecret = requests.filter((r) => JSON.stringify(r.body ?? r).includes(SECRET_TEXT)).length

    // Member instances AFTER the create attempts: the count is the witness.
    const stateAfter = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const membersAfter = Array.isArray(stateAfter?.body?.members) ? stateAfter.body.members : members
    counters.memberInstancesBefore = members.length
    counters.memberInstancesAfter = membersAfter.length
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')
    writeFileSync(join(bootDir, 'proc-observations.json'), JSON.stringify({
      schema: 'a5sf-pd21-subagent/proc-observations/1', at: new Date().toISOString(),
      note: 'independent /proc/<pid>/cmdline scan; a sighting is an OS-level fact, not a product counter',
      sightings: procLog,
    }, null, 2) + '\n')

    // ── judges ─────────────────────────────────────────────────────────────
    const childPresent = childTranscript !== null || childRequest !== null
    const verdicts = {
      baseline: judgeBaseline(admitted),
      memberSurface: judgeMemberSurface(memberSurface),
      childRealm: judgeChildRealm({
        childPresent,
        childSurface,
        childReadResult,
        childBashResult,
        subagentCall,
        subagentResult,
        subagentOnMemberSurface: counters.subagentOnMemberSurface,
        childModelRequests: childRequests.length,
      }),
      escape: judgeNoEscape({
        requestsCarryingSecret: counters.requestsCarryingSecret,
        subagentText: String(subagentResult?.text ?? ''),
        childReadText: String(childReadResult?.text ?? ''),
        childBashText: String(childBashResult?.text ?? ''),
        childFinalText: childTranscript?.finalAssistant ?? '',
      }),
      childFacts: judgeChildFacts({ childPresent, childFacts, childReadCallId: CALL_CHILD_READ }),
      spawns: judgeSpawns(counters),
      create: judgeCreate({
        createWorker,
        createWide,
        membersBefore: members.length,
        membersAfter: membersAfter.length,
      }),
    }
    // NOTE: `detail` must NOT carry a `verdict` key — the record spreads it
    // AFTER the passed verdict and would silently overwrite it.
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}`)
    }
    add('pd21:member-confined-baseline', verdicts.baseline.verdict, verdicts.baseline)
    add('pd21:member-surface', verdicts.memberSurface.verdict, verdicts.memberSurface)
    add('pd21:subagent-child-governed', verdicts.childRealm.verdict, verdicts.childRealm)
    add('pd21:no-child-byte-escape', verdicts.escape.verdict, verdicts.escape)
    add('pd21:child-fact-attribution', verdicts.childFacts.verdict, verdicts.childFacts)
    add('pd21:confined-launcher-accounting', verdicts.spawns.verdict, verdicts.spawns)
    add('pd21:member-create-refused', verdicts.create.verdict, verdicts.create)

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
    // The slot represents a LIVE Host, so it is released AFTER teardown. A
    // direct `acquireDevLiveSlot` lease exposes `release()` (which unlinks the
    // slot file and verifies the hold); a silent no-op is impossible because
    // the returned state is logged and a still-held slot fails the boot.
    try {
      const released = await slot.release()
      log(`[boot${String(index)}] dev-live slot released (slot=${String(slot.slot)} state=${JSON.stringify(released ?? null)})`)
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
      rowConfig: 'dev/agent-workflow/evidence/a5sf-pd21-subagent/plan-patch.yml (regenerated by --plan; boot copies live in the World home)',
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
    // Print EVERY argument (bounded): the read/team calls carry no `command`,
    // and a transcript that hides their arguments could not witness anything.
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
  const authorization = { scope: 'DEV-LIVE', face: 'Subagent', world: LINE, source: 'task PD21-SUBAGENT-REALM explicit boot authorisation (2026-11-14)' }
  const archived = archivePriorRuns()
  log(`ARCHIVE: ${archived === null ? '(nothing to archive)' : archived}`)
  writeFileSync(join(EVIDENCE, 'driver-digest.json'), JSON.stringify({
    at: startedAt, head, hostTree: HOST_TREE, hostSha: hostDigest(), pin: TEST_USE_BASELINE_SHA,
    driverSha256: sha256(fileURLToPath(import.meta.url)), jsSubstitutions: layer.jsSubstitutions,
    authorization,
    command: `node tests/world-factory/drivers/a5sf-pd21-subagent/run-boot.mjs${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
  }, null, 2) + '\n')
  log(`START head=${head} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA} boots=${String(BOOTS_WANTED)}`)
  log(`host porcelain before: ${JSON.stringify(hostPorcelain())}`)
  if (hostPorcelain().length !== 0) throw new Error('the pinned host tree is not clean (porcelain non-empty): refusing to boot')

  const results = []
  for (let i = 1; i <= BOOTS_WANTED; i += 1) {
    const r = await bootOnce({ index: i, head, authorization, layer, baseDir: EVIDENCE })
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
/** The two-run agreement table: the facts that must be IDENTICAL. */
function buildAgreement(results) {
  const ok = results.filter((r) => r?.failed !== true)
  const pick = (r) => ({
    overall: r?.overall ?? null,
    baselineVerdict: r?.verdicts?.baseline?.verdict ?? null,
    memberSurfaceVerdict: r?.verdicts?.memberSurface?.verdict ?? null,
    childRealmVerdict: r?.verdicts?.childRealm?.verdict ?? null,
    escapeVerdict: r?.verdicts?.escape?.verdict ?? null,
    childFactsVerdict: r?.verdicts?.childFacts?.verdict ?? null,
    spawnsVerdict: r?.verdicts?.spawns?.verdict ?? null,
    createVerdict: r?.verdicts?.create?.verdict ?? null,
    subagentOnMemberSurface: r?.counters?.subagentOnMemberSurface ?? null,
    childPresent: r?.counters?.childSessionFound ?? null,
    childModelRequests: r?.counters?.childModelRequests ?? null,
    childSurfaceCount: r?.counters?.childSurfaceCount ?? null,
    confinedTurnLaunchers: r?.counters?.confinedTurnLaunchers ?? null,
    baseBwrapWithMarkers: r?.counters?.baseBwrapWithMarkers ?? null,
    guardAllow: r?.counters?.guardFacts?.allow ?? null,
    guardDeny: r?.counters?.guardFacts?.deny ?? null,
    requestsCarryingSecret: r?.counters?.requestsCarryingSecret ?? null,
    memberInstancesBefore: r?.counters?.memberInstancesBefore ?? null,
    memberInstancesAfter: r?.counters?.memberInstancesAfter ?? null,
    admittedBytes: (() => {
      const c = r?.transcript?.calls?.find((x) => String(x.callId) === CALL_IN)
      try { return JSON.parse(c?.result?.text ?? '{}')?.stdout?.includes(IN_LANE_TEXT) === true } catch { return false }
    })(),
    transcriptSourceCount: r?.transcript?.calls?.length ?? null,
  })
  const rows = ok.map((r) => ({ boot: r.boot, ...pick(r) }))
  const keys = [
    'overall', 'baselineVerdict', 'memberSurfaceVerdict', 'childRealmVerdict', 'escapeVerdict',
    'childFactsVerdict', 'spawnsVerdict', 'createVerdict',
    // NOT included: `preflightLaunchers` (the realm's attach-time probe count is
    // environmental — measured 3 vs 4 across two otherwise identical boots).
    'subagentOnMemberSurface', 'childPresent', 'childModelRequests', 'childSurfaceCount',
    'confinedTurnLaunchers', 'baseBwrapWithMarkers', 'guardAllow', 'guardDeny',
    'requestsCarryingSecret', 'memberInstancesBefore', 'memberInstancesAfter',
    'admittedBytes', 'transcriptSourceCount',
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
  return { schema: 'a5sf-pd21-subagent/agreement/1', at: new Date().toISOString(), boots: results.length, agreeing, differing, rows, table }
}
main().catch((error) => {
  log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
