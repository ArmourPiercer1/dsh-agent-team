#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-recon-fs/run-boot.mjs — the A-FACE FS
 * RECON driver: ONE real Host, ONE governed Member, ONE Member turn, thirteen
 * model-visible native-tool calls with a unique fixture and call id each.
 *
 * DERIVED FROM `tests/world-factory/drivers/a5sf-live-member/run-boot.mjs`
 * (the proven live Member driver, @ 235e1af8b). The boot path, the shipped
 * layer parsing, the harness/lease wiring, the durable-transcript reader, the
 * /proc observer and the teardown discipline are that driver's; what changes
 * is the MEASURED FACE: instead of two `bash` probes this driver drives the
 * four native filesystem tools the shipped governed preset declares —
 * `read`, `write`, `edit`, `read_image` — and records, per call, the actual
 * result bytes, the guard facts (or their absence), the on-disk effect and the
 * provider/OS face.
 *
 * WHY THIS EXISTS (recon, not acceptance). PD-5 records that `fs` is absent
 * from `ROUTED_SERVICE_NAMES` and that a ROUTED `read_image` cannot resolve
 * `ctx.fs`. The open question this driver measures is upstream of that: on the
 * SHIPPED governed preset, is a Member's native `read`/`write`/`edit`/
 * `read_image` served by the Member's confined `fs` Provider at all, or by the
 * preset scope's inherited host `ctx.fs`? A successful tool result is NOT
 * evidence for the confined provider; a refusal is NOT evidence of a ceiling
 * (it may be the host sandbox, the observation policy or the route gate). So
 * every call is judged by (a) where it was decided (guard fact or not),
 * (b) what actually came back, (c) what landed on disk.
 *
 * COMPOSITION (unchanged from the proven lane): the SHIPPED `dsh-agent-team/host`
 * row opted in with `memberPresetId: a5sf-governed-member`,
 * `a5sfGovernedRealm: true`, `a5sfEvidencePath`, and a schemaVersion 4
 * `blueprintSource` whose ONE `memberIoCeilings` family is read = write =
 * `<workspace>/lane`. The ceiling is deliberately NARROWER than the host
 * sandbox root (`<workspace>`), so "outside the Member ceiling" and "outside
 * the host sandbox" are two DIFFERENT locators and cannot be confused.
 *
 * MEASURED CALLS (one tool call per model step, unique fixture + call id):
 *   control   bash    <lane>/bash-allow.txt            (the governed face works)
 *   control   bash    <not-in-lane>/bash-deny.txt      (typed IO_READ_DENIED)
 *   required  read    <lane>/read-allow.txt            ALLOW axis
 *   required  read    <not-in-lane>/read-deny.txt      DENY axis
 *   required  write   <lane>/write-allow.txt           ALLOW axis (new file)
 *   required  write   <not-in-lane>/write-deny.txt     DENY axis (new file)
 *   probe     write   <home>/host-fence/…              outside the HOST sandbox
 *   prereq    read    <lane>/edit-allow.txt            read-before-write
 *   required  edit    <lane>/edit-allow.txt            ALLOW axis
 *   prereq    read    <not-in-lane>/edit-deny.txt      read-before-write (deny axis)
 *   required  edit    <not-in-lane>/edit-deny.txt      DENY axis
 *   required  read_image <lane>/probe-allow.png        ALLOW axis
 *   probe     read_image <not-in-lane>/probe-deny.png  DENY axis
 * plus, after the Member turn: ONE `/__p6t6/tool` cross-check (same tool, same
 * session, dispatched outside the model), an archive of the Member, and TWO
 * post-archive dispatches (the lifecycle arm).
 *
 *   node tests/world-factory/drivers/a5sf-recon-fs/run-boot.mjs [--boots N] [--plan]
 *
 * `--plan` is host-free. `--boots 1` is a development iteration; the default is
 * one boot (the task asks for ONE Host / ONE Member / as close to one boot as
 * possible); `--boots 2` adds the stability pair.
 *
 * RECORD CLASS. Every row is `DEV-LIVE`; `candidateClaimEligibility` is false
 * by construction. This run is RECON evidence: it is not a candidate claim, it
 * moves no `V@B` cell, and it is not the merge evidence for any PR.
 *
 * CORE PATCH BUDGET = 0. The pinned host tree is read-only and its porcelain is
 * verified empty before the first boot and after every boot.
 *
 * @module tests/world-factory/drivers/a5sf-recon-fs/run-boot
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
import { preRegisterDevLiveBudget, resolveHeadCommit } from '../../suites/150-a5sf-read.mjs'
import {
  lastUserTextOfStatic, messagesOf, remoteCall, surfaceNamesOf, textOf,
} from '../../lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-recon-fs')
/**
 * `--run-tag <name>` writes the boot directories under `runs/<name>/` instead
 * of `runs/`. A replication of the SAME composition therefore lands in its own
 * directory (no boot ever overwrites another boot's artefacts), and the
 * as-shipped composition and the image-capable one can coexist.
 */
const RUN_TAG = (() => {
  const i = process.argv.indexOf('--run-tag')
  if (i === -1) return null
  const value = String(process.argv[i + 1] ?? '').trim()
  return /^[a-z0-9][a-z0-9-]*$/u.test(value) ? value : null
})()
const RUNS = RUN_TAG === null ? join(EVIDENCE, 'runs') : join(EVIDENCE, 'runs', RUN_TAG)
/**
 * `--compare <tagA>,<tagB>[,…]` is host-free: it reads the stored artefacts of
 * already-finished boots (each tag's `boot01/`) and re-emits the agreement
 * table across them. Two boots of the SAME composition must agree on every
 * REQUIRED fact; two DIFFERENT compositions are compared to make the
 * composition delta explicit instead of hiding it.
 */
const COMPARE = (() => {
  const i = process.argv.indexOf('--compare')
  if (i === -1) return null
  const tags = String(process.argv[i + 1] ?? '').split(',').map((t) => t.trim()).filter((t) => t !== '')
  return tags.length >= 2 ? tags : null
})()
const ARCHIVE = join(EVIDENCE, 'archive')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')
const GRANT_PATH = join(EVIDENCE, 'dev-live-grant.json')

const LINE = 'a5sffsrecon1'
const BOOT_ROOT = 'session-a5srf-boot'
const ACCEPTANCE_ROOT = 'session-a5srf-team'
const BP_ANCHOR_ID = 'team.a5sf.reconfs.anchor'
const BP_MAIN_ID = 'team.a5sf.reconfs.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'A5SF_SRF_DISC'
const MK_L1 = 'A5SF_SRF_L1_DRIVE'
const TOK_MEMBER = 'a5srf-turn'
const DONE_MEMBER = 'A5SF_SRF_MEMBER_DONE'
const DONE_L1 = 'A5SF_SRF_L1_DONE'

const LANE_DIRNAME = 'lane'
const NOT_IN_LANE_DIRNAME = 'not-in-lane'
const HOST_FENCE_DIRNAME = 'host-fence'

const MARK = {
  readAllow: 'A5SF_RECON_FS_READ_ALLOW_BYTES',
  readDeny: 'A5SF_RECON_FS_READ_DENY_SECRET_BYTES',
  writeAllow: 'A5SF_RECON_FS_WRITE_ALLOW_BYTES',
  writeDeny: 'A5SF_RECON_FS_WRITE_DENY_BYTES',
  editAllowOld: 'A5SF_RECON_FS_EDIT_ALLOW_ORIGINAL',
  editAllowNew: 'A5SF_RECON_FS_EDIT_ALLOW_EDITED',
  editDenyOld: 'A5SF_RECON_FS_EDIT_DENY_ORIGINAL',
  editDenyNew: 'A5SF_RECON_FS_EDIT_DENY_EDITED',
  bashAllow: 'A5SF_RECON_FS_BASH_ALLOW_BYTES',
  bashDeny: 'A5SF_RECON_FS_BASH_DENY_SECRET_BYTES',
  hostFence: 'A5SF_RECON_FS_HOST_FENCE_BYTES',
}

/** A 1×1 PNG (the same bytes the host-free fs-contract world plants). */
const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

/** The four native tools this recon is about (the seven-items table is per tool). */
const TOOLS = Object.freeze(['read', 'write', 'edit', 'read_image'])

/** The pinned schemas each tool must carry if it is the preset's own definition. */
const SCHEMA_REQUIRED = Object.freeze({
  read: ['file_path', 'offset', 'limit'],
  write: ['file_path', 'content'],
  edit: ['file_path', 'old_string', 'new_string'],
  read_image: ['file_path'],
})

const SELECTED_CASES = Object.freeze([
  'fs:surface',
  'fs:read-allowed',
  'fs:read-ceiling-denied',
  'fs:write-allowed',
  'fs:write-ceiling-denied',
  'fs:edit-allowed',
  'fs:edit-ceiling-denied',
  'fs:read-image-allowed',
  'fs:read-image-ceiling-denied',
  'fs:provider-attribution',
  'fs:guard-facts',
  'fs:bash-control',
  'fs:lifecycle-post-archive',
])

const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
/**
 * `--image-route` declares an IMAGE-CAPABLE model catalog entry for the route
 * model (`deepseek-v4-flash`) in the World's own profile layer. It is a
 * DEPLOYMENT fact (the `llm-deepseek.models` setting), not a product change:
 * without it the shipped deployment declares no `image` input for that model
 * and `read_image` is refused by its route gate before any provider call.
 */
const IMAGE_ROUTE = argv.includes('--image-route')
const BOOTS_WANTED = (() => {
  const i = argv.indexOf('--boots')
  if (i === -1) return 1
  const n = Number(argv[i + 1])
  return Number.isInteger(n) && n > 0 ? n : 1
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
const sha256Text = (t) => createHash('sha256').update(String(t)).digest('hex')
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

// ─────────────────────────────────────────────────────────────────────────────
// blueprints
// ─────────────────────────────────────────────────────────────────────────────
function anchorBlueprintYaml() {
  const doc = {
    schemaVersion: 3,
    blueprintId: BP_ANCHOR_ID,
    revision: '1',
    leader: { templateId: 'leader', persona: `You lead the a5sf recon fs anchor team. ${MK_DISC} is the discovery marker.` },
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
 * statement is the `memberIoCeilings` family: read/write are `<workspace>/lane`.
 * `<workspace>/not-in-lane` is therefore OUTSIDE the Member ceiling while still
 * INSIDE the host sandbox root — the two fences are different locators.
 */
function mainBlueprintYaml({ denyList, laneDir }) {
  const doc = {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the a5sf recon fs team. ${MK_L1} drives your chain: delegate the governed worker once, then finish.`,
      // NO `capabilities` block (the coverage gate only polices declared sets).
    },
    members: [{
      templateId: 'worker',
      displayName: 'Governed FS Worker',
      persona: 'You are the governed worker. Run the thirteen probes in the fixed order, exactly once each, one tool call at a time.',
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
        read: lane([laneDir]),
        write: lane([laneDir]),
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
    // THE OPT-IN (both keys explicit; a v3 design or a missing ceiling family
    // would refuse at Member attach, never silently grant a default).
    memberPresetId: PRESET_ID,
    a5sfGovernedRealm: true,
    // The product guard-consult sink: the ONLY channel guard facts reach.
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    // NO `a5sfNativeToolModules`: this is the SHIPPED governed preset as
    // assembled by the product. Whether the native fs tools ride the confined
    // realm or the inherited host `ctx.fs` is the question under measurement,
    // so the composition must not pre-empt it. (Recorded in the digest.)
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
 *  delegated `[team-work …]` envelope carrying our token. */
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
        if (block?.type !== 'tool_result' || String(block.tool_use_id) !== String(callId)) continue
        const images = Array.isArray(block.content)
          ? block.content.filter((c) => c?.type === 'image').map((c) => ({
            mediaType: c?.source?.media_type ?? c?.mediaType ?? null,
            attachmentId: c?.source?.attachmentId ?? c?.attachmentId ?? null,
          }))
          : []
        const text = Array.isArray(block.content)
          ? block.content.map((c) => (c?.type === 'image' ? `[image ${String(c?.source?.media_type ?? '?')}]` : (c?.text ?? ''))).join('')
          : typeof block.content === 'string' ? block.content : ''
        return { source: 'model', isError: block.is_error === true, text, images }
      }
    }
  }
  return undefined
}

/**
 * The scripted model. One tool call per Member step, in a FIXED order, each
 * with its own call id and its own fixture — so every result is attributable
 * to exactly one call and one locator.
 */
function memberScript(f) {
  return [
    {
      key: 'bash-allow', tool: 'bash', expect: 'allow', locator: f.bashAllow,
      args: { command: `cat '${f.bashAllow}'; sleep 0.3`, description: 'Read the in-lane control fixture', workdir: f.lane },
    },
    {
      key: 'bash-deny', tool: 'bash', expect: 'deny', locator: f.bashDeny,
      args: { command: `cat '${f.bashDeny}'; sleep 0.3`, description: 'Read the out-of-lane control fixture', workdir: f.lane },
    },
    { key: 'read-allow', tool: 'read', expect: 'allow', locator: f.readAllow, args: { file_path: f.readAllow } },
    { key: 'read-deny', tool: 'read', expect: 'deny', locator: f.readDeny, args: { file_path: f.readDeny } },
    { key: 'write-allow', tool: 'write', expect: 'allow', locator: f.writeAllow, args: { file_path: f.writeAllow, content: `${MARK.writeAllow}\n` } },
    { key: 'write-deny', tool: 'write', expect: 'deny', locator: f.writeDeny, args: { file_path: f.writeDeny, content: `${MARK.writeDeny}\n` } },
    {
      key: 'write-host-fence', tool: 'write', expect: 'probe', locator: f.hostFenceFile,
      args: { file_path: f.hostFenceFile, content: `${MARK.hostFence}\n` },
    },
    { key: 'edit-allow-preread', tool: 'read', expect: 'prereq', locator: f.editAllow, args: { file_path: f.editAllow } },
    {
      key: 'edit-allow', tool: 'edit', expect: 'allow', locator: f.editAllow,
      args: { file_path: f.editAllow, old_string: `${MARK.editAllowOld}\n`, new_string: `${MARK.editAllowNew}\n` },
    },
    { key: 'edit-deny-preread', tool: 'read', expect: 'prereq', locator: f.editDeny, args: { file_path: f.editDeny } },
    {
      key: 'edit-deny', tool: 'edit', expect: 'deny', locator: f.editDeny,
      args: { file_path: f.editDeny, old_string: `${MARK.editDenyOld}\n`, new_string: `${MARK.editDenyNew}\n` },
    },
    { key: 'read-image-allow', tool: 'read_image', expect: 'allow', locator: f.imageAllow, args: { file_path: f.imageAllow } },
    { key: 'read-image-deny', tool: 'read_image', expect: 'probe-deny', locator: f.imageDeny, args: { file_path: f.imageDeny } },
    // A path outside BOTH fences (the Member ceiling and the host workspace):
    // a success here says the serving provider's read face is host-wide.
    { key: 'read-host-reach', tool: 'read', expect: 'probe', locator: '/etc/hostname', args: { file_path: '/etc/hostname' } },
  ]
}
const CALL_ID = (key) => `call-a5srf-${key}`

function makeDecide(f) {
  const script = memberScript(f)
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf recon fs session' }

    // ── THE MEMBER TURN: the thirteen probes, one call per step ────────────
    if (isMemberRequest(req)) {
      const seen = resultIdsOf(req)
      const next = script.find((step) => !seen.has(CALL_ID(step.key)))
      if (next !== undefined) {
        return { kind: 'tool-call', toolCalls: [{ id: CALL_ID(next.key), name: next.tool, arguments: next.args }] }
      }
      return { kind: 'text', content: `${DONE_MEMBER} ${lastToolResultText(req).slice(0, 200)}` }
    }

    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_SRF_DISC_DONE' }

    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1)
    if (isLeader) {
      const seen = resultIdsOf(req)
      if (!seen.has('call-a5srf-delegate')) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: 'call-a5srf-delegate',
            name: 'team_delegate',
            arguments: {
              rootSessionId: ACCEPTANCE_ROOT,
              requestToken: `${TOK_MEMBER}-delegate`,
              delegationTemplateId: 'worker',
              label: 'a5srf-worker',
              workspace: f.workspace,
              prompt: `${TOK_MEMBER}: run the thirteen filesystem probes in the FIXED order you were given, exactly once each, one tool call at a time, then report. Probe A (control) reads and probes B..M follow. Do not skip a probe and do not repeat one.`,
              async: false,
            },
          }],
        }
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_SRF_NOOP' }
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

function scanProc(markers) {
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
      hits.push({
        marker: 'base-bwrap',
        named: markers.filter((m) => cmdline.includes(m.payload)),
        cmdline: cmdline.slice(0, 400),
        ...base,
      })
    }
    for (const m of markers) {
      if (cmdline.includes(m.payload)) hits.push({ marker: m.marker, cmdline: cmdline.slice(0, 400), ...base })
    }
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
  if (Array.isArray(content)) {
    return content.map((c) => (typeof c === 'string' ? c : (c?.type === 'image' ? `[image ${String(c?.source?.media_type ?? '?')}]` : String(c?.text ?? '')))).join('')
  }
  return JSON.stringify(content ?? '')
}
/**
 * Normalise the durable session log into the Member-VISIBLE turn: the user
 * prompt, every tool call and its tool result (in order), and the final
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
      const images = Array.isArray(body)
        ? body.filter((c) => c?.type === 'image').map((c) => ({
          mediaType: c?.source?.media_type ?? null,
          attachmentId: c?.source?.attachmentId ?? null,
        }))
        : []
      results.push({ callId, isError, text: contentText(body), images, at: row?.at ?? row?.time ?? null })
    }
  }
  const paired = calls.map((call) => {
    const result = results.find((r) => String(r.callId) === String(call.callId)) ?? null
    let args = null
    try { args = JSON.parse(call.arguments) } catch { args = null }
    return { callId: call.callId, name: call.name, arguments: args, result, at: call.at }
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
// judges — one call, one locator, one verdict
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

const effectMarkerOf = (key) => ({
  'read-allow': MARK.readAllow,
  'read-deny': MARK.readDeny,
  'write-allow': MARK.writeAllow,
  'write-deny': MARK.writeDeny,
  'edit-allow': MARK.editAllowNew,
  'edit-deny': MARK.editDenyNew,
  'read-image-allow': MARK.readAllow,
  'read-image-deny': MARK.readDeny,
  'bash-allow': MARK.bashAllow,
  'bash-deny': MARK.bashDeny,
  'write-host-fence': MARK.hostFence,
  'read-host-reach': '',
  'edit-allow-preread': MARK.editAllowOld,
  'edit-deny-preread': MARK.editDenyOld,
}[key] ?? '')

/** Guard facts that belong to ONE locator (the unique fixture per call). */
function factsFor(facts, locator) {
  const want = resolve(String(locator))
  return facts.filter((f) => typeof f?.locator === 'string' && resolve(f.locator) === want)
}

/**
 * The SIX-CLASS outcome label for one call. This is the report's vocabulary,
 * and it is derived from the result + the guard facts only — never from the
 * call's declared expectation.
 */
function classifyCall({ call, tool, result, facts, locator, surfaceSet }) {
  const toolName = tool ?? call?.tool ?? call?.name
  if (call === null || call === undefined) return 'NOT_REACHED'
  if (surfaceSet !== undefined && surfaceSet.has(toolName) !== true) return 'NOT_ON_SURFACE'
  if (result === undefined) return 'NOT_REACHED'
  const text = String(result.text ?? '')
  const matching = factsFor(facts, locator)
  const denyFacts = matching.filter((f) => f.decision === 'deny')
  if (result.isError !== true) {
    return matching.length === 0 ? 'COMPLETED_NO_GUARD_FACT' : 'COMPLETED_WITH_GUARD_FACT'
  }
  if (denyFacts.length > 0 && /IO_[A-Z_]+_DENIED/u.test(text)) return 'CORRECTLY_REFUSED'
  if (denyFacts.length > 0) return 'CORRECTLY_REFUSED'
  if (/FS_SANDBOX_DENIED|sandbox: file access denied/u.test(text)) return 'REFUSED_BY_HOST_SANDBOX'
  if (/has not been read/u.test(text)) return 'REFUSED_BY_HOST_OBSERVATION_POLICY'
  if (/does not declare image input|no attachment service|could not be resolved/u.test(text)) return 'NOT_REACHED_ROUTE_GATE'
  return 'REFUSED_OTHER'
}

function judgeBashControl({ allowSample, denySample, facts, memberIdentity }) {
  return verdictOf(
    'the same Member, in the same boot, is refused an out-of-ceiling read by the governed terminal face (typed IO_READ_DENIED, zero secret bytes) — so the realm guard EXISTS and is the contrast for the native tools',
    [
      { id: 'allow-result', ok: allowSample.result?.isError === false, detail: `bash allow isError=${String(allowSample.result?.isError)}` },
      { id: 'allow-bytes', ok: String(allowSample.result?.text ?? '').includes(MARK.bashAllow), detail: 'the in-lane bash read returned the planted bytes' },
      { id: 'deny-error', ok: denySample.result?.isError === true, detail: `bash deny isError=${String(denySample.result?.isError)}` },
      { id: 'deny-typed', ok: String(denySample.result?.text ?? '').includes('IO_READ_DENIED'), detail: 'the denied bash result names IO_READ_DENIED' },
      { id: 'deny-zero-secret', ok: String(denySample.result?.text ?? '').includes(MARK.bashDeny) === false, detail: 'NO bash secret bytes reached the Member' },
      {
        id: 'deny-fact',
        ok: factsFor(facts, denySample.locator).some((f) => f.decision === 'deny' && f.method === 'shellRead' && f.memberIdentity === memberIdentity),
        detail: 'one shellRead DENY guard fact at the denied locator, for the real Member identity',
      },
    ],
  )
}

/** The seven-item row for ONE tool. */
function sevenItemsForTool({ tool, specs, samples, facts, memberIdentity, policyRevision, surface, disk, lifecycle }) {
  const surfaceSet = new Set(surface.map((s) => s.name))
  const allowance = specs.find((s) => s.expect === 'allow')
  const denySpec = specs.find((s) => s.expect === 'deny' || s.expect === 'probe-deny')
  const allowSample = allowance === undefined ? null : samples[allowance.key]
  const denySample = denySpec === undefined ? null : samples[denySpec.key]
  const allowFacts = allowance === undefined ? [] : factsFor(facts, allowance.locator)
  const denyFacts = denySpec === undefined ? [] : factsFor(facts, denySpec.locator)

  // 1 SURFACE
  const surfaceEntry = surface.find((s) => s.name === tool) ?? null
  const props = Object.keys(surfaceEntry?.parameters?.properties ?? {})
  const wantProps = SCHEMA_REQUIRED[tool] ?? []
  const surfaceVerdict = surfaceEntry === null
    ? 'NOT_ON_SURFACE'
    : wantProps.every((p) => props.includes(p)) ? 'PASS' : 'FAIL'

  // 2 DISPATCH — every configured call for this tool reached a result
  const dispatched = specs.map((s) => samples[s.key]).filter(Boolean)
  const dispatchVerdict = surfaceVerdict === 'NOT_ON_SURFACE'
    ? 'NOT_ON_SURFACE'
    : dispatched.length !== specs.length ? 'FAIL'
      : dispatched.every((s) => s.result !== undefined) ? 'PASS' : 'FAIL'

  // 3 PROVIDER — the Member's confined fs Provider decided (guard fact)
  const providerFace = allowFacts.length > 0 || denyFacts.length > 0
    ? 'realm-confined-fs (a5sf guard fact present)'
    : 'host ctx.fs (ZERO a5sf guard facts for this locator)'
  const providerVerdict = surfaceVerdict === 'NOT_ON_SURFACE' || dispatchVerdict !== 'PASS'
    ? 'NOT_REACHED'
    : (allowFacts.some((f) => f.memberIdentity === memberIdentity) || denyFacts.some((f) => f.memberIdentity === memberIdentity))
      ? 'PASS' : 'FAIL'

  // 4 ALLOW — the allowed call succeeded with the expected effect
  const allowClass = allowance === undefined ? null : classifyCall({
    call: allowSample?.call, tool, result: allowSample?.result, facts, locator: allowance.locator, surfaceSet,
  })
  const allowEffect = allowance === undefined ? null : disk[allowance.key] ?? null
  const allowOk = (() => {
    if (allowClass === null) return false
    if (allowClass !== 'COMPLETED_NO_GUARD_FACT' && allowClass !== 'COMPLETED_WITH_GUARD_FACT') return false
    if (tool === 'read') return String(allowSample?.result?.text ?? '').includes(effectMarkerOf(allowance.key))
    if (tool === 'write') return allowEffect?.exists === true && allowEffect?.content === `${MARK.writeAllow}\n`
    if (tool === 'edit') return allowEffect?.content === `${MARK.editAllowNew}\n`
    if (tool === 'read_image') {
      return (allowSample?.result?.images?.length ?? 0) > 0
        || (allowSample?.mockResult?.images?.length ?? 0) > 0
        || /attachmentId|image\/png/u.test(String(allowSample?.result?.text ?? ''))
    }
    return false
  })()
  const allowVerdict = allowance === undefined ? 'NOT_APPLICABLE' : allowOk ? 'PASS' : 'FAIL'

  // 5 DENY — refused at the guard, with a deny fact and zero bytes
  const denyClass = denySpec === undefined ? null : classifyCall({
    call: denySample?.call, tool, result: denySample?.result, facts, locator: denySpec.locator, surfaceSet,
  })
  const denyVerdict = denySpec === undefined ? 'NOT_APPLICABLE'
    : denyClass === 'CORRECTLY_REFUSED' && denyFacts.some((f) => f.decision === 'deny') ? 'PASS'
      : dispatchVerdict !== 'PASS' ? 'NOT_REACHED' : 'FAIL'

  // 6 EVIDENCE — a guard fact attributable to the call (locator is 1:1)
  const evidenceFacts = [...allowFacts, ...denyFacts]
  const evidenceVerdict = surfaceVerdict === 'NOT_ON_SURFACE' || dispatchVerdict !== 'PASS'
    ? 'NOT_REACHED'
    : evidenceFacts.length > 0
      && evidenceFacts.every((f) => typeof f.memberIdentity === 'string' && f.memberIdentity === memberIdentity)
      && evidenceFacts.every((f) => typeof f.policyRevision === 'string' && f.policyRevision !== '')
      ? 'PASS' : 'FAIL'

  return {
    tool,
    surface: {
      verdict: surfaceVerdict,
      present: surfaceEntry !== null,
      parameters: props,
      description: surfaceEntry?.description ?? null,
      detail: surfaceEntry === null
        ? 'the tool is NOT on the Member\'s model-visible surface'
        : `parameters=${props.join(',')} (required ${wantProps.join(',')})`,
    },
    dispatch: {
      verdict: dispatchVerdict,
      calls: specs.map((s) => ({
        key: s.key, callId: CALL_ID(s.key),
        issued: samples[s.key]?.call !== null && samples[s.key]?.call !== undefined,
        resultPresent: samples[s.key]?.result !== undefined,
      })),
    },
    provider: {
      verdict: providerVerdict,
      face: providerFace,
      factsAtAllowLocator: allowFacts.map((f) => ({ method: f.method, decision: f.decision, decidedBy: f.decidedBy })),
      factsAtDenyLocator: denyFacts.map((f) => ({ method: f.method, decision: f.decision, decidedBy: f.decidedBy })),
    },
    allow: {
      verdict: allowVerdict,
      callId: allowance === undefined ? null : CALL_ID(allowance.key),
      locator: allowance?.locator ?? null,
      outcomeClass: allowClass,
      resultBytes: byteEvidence(allowSample?.result?.text),
      effect: allowEffect,
    },
    deny: {
      verdict: denyVerdict,
      callId: denySpec === undefined ? null : CALL_ID(denySpec.key),
      locator: denySpec?.locator ?? null,
      outcomeClass: denyClass,
      resultBytes: byteEvidence(denySample?.result?.text),
      effect: denySpec === undefined ? null : (disk[denySpec.key] ?? null),
      secretAbsent: denySpec === undefined ? null
        : String(denySample?.result?.text ?? '').includes(effectMarkerOf(denySpec.key)) === false,
    },
    evidence: {
      verdict: evidenceVerdict,
      policyRevision,
      facts: evidenceFacts.map((f) => ({
        method: f.method, locator: f.locator, decision: f.decision, decidedBy: f.decidedBy,
        memberIdentity: f.memberIdentity, policyRevision: f.policyRevision, observedAt: f.observedAt,
      })),
    },
    lifecycle: lifecycle.perTool?.[tool] ?? lifecycle.defaultRow,
  }
}

function byteEvidence(text) {
  const t = String(text ?? '')
  return {
    bytes: Buffer.byteLength(t, 'utf8'),
    sha256: sha256Text(t),
    excerpt: t.length <= 600 ? t : `${t.slice(0, 600)}…`,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// plan (host-free)
// ─────────────────────────────────────────────────────────────────────────────
function planOnly() {
  const layer = shippedLayer()
  log(`PLAN repo=${REPO_ROOT} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA}`)
  log(`shipped !!js substitutions: ${JSON.stringify(layer.jsSubstitutions)}`)
  const anchor = anchorBlueprintYaml()
  const main = mainBlueprintYaml({ denyList: [], laneDir: join(EVIDENCE, 'plan-workspace', LANE_DIRNAME) })
  const a = assertBlueprintText(anchor, BP_ANCHOR_ID, 'anchor.yaml')
  const m = assertBlueprintText(main, BP_MAIN_ID, 'main.yaml')
  log(`blueprints accepted: anchor=${JSON.stringify(a)} main=${JSON.stringify(m)}`)
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), anchorYaml: anchor, layer })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-recon-fs plan (no World)'], rows) + '\n')
  log(`rows: ${JSON.stringify(rows.map((r) => ({ id: r.id })))}`)
  const preset = layer.rows.find((r) => r?.config?.id === PRESET_ID)
  const plugins = (preset?.config?.plugins ?? []).map((p) => p.id)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-fs-search']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  if (plugins.includes('tool-pwsh')) throw new Error('the shipped governed preset unexpectedly carries tool-pwsh')
  const hostRow = rows.find((r) => r.id === 'dsh-agent-team')
  if (hostRow.config.a5sfNativeToolModules !== undefined) {
    throw new Error('the recon composition must NOT configure a5sfNativeToolModules: the point is the SHIPPED assembly')
  }
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// one boot
// ─────────────────────────────────────────────────────────────────────────────
async function bootOnce({ index, head, grant, layer }) {
  const bootDir = join(RUNS, `boot${String(index).padStart(2, '0')}`)
  mkdirSync(bootDir, { recursive: true })
  const phase = `a5sf-recon-fs-boot${String(index)}`
  const runId = `a5sf-recon-fs-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-recon-fs', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, grant), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-recon-fs', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const lease = await preRegisterDevLiveBudget({
    grantPath: GRANT_PATH, headCommit: head, runRecord: record,
    face: 'FS Provider', world: LINE, leaseRoot: factory.leaseRoot, requiredBoots: 1,
  })
  log(`[boot${String(index)}] dev-live lease grant=${lease.grant.grantId} face=${String(grant.face)} world=${LINE} head=${head}`)

  let world = null
  let bootInfo = null
  let teardown = null
  let failure = null
  let abortStage = 'pre-boot'
  let paths = null
  let fixtures = null
  let collectDiagnostics = () => ({})
  const counters = {}
  let result = null
  try {
    bootInfo = await lease.boot(async () => {
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      log(`[boot${String(index)}] world=${world.id} home=${world.home}`)
      mkdirSync(join(world.home, 'blueprints'), { recursive: true })
      const workspace = world.workspaceDir
      const laneDir = join(workspace, LANE_DIRNAME)
      const notInLaneDir = join(workspace, NOT_IN_LANE_DIRNAME)
      const hostFenceDir = join(world.home, HOST_FENCE_DIRNAME)
      for (const dir of [laneDir, notInLaneDir, hostFenceDir]) mkdirSync(dir, { recursive: true })
      fixtures = {
        workspace,
        lane: laneDir,
        notInLane: notInLaneDir,
        hostFenceDir,
        readAllow: join(laneDir, 'read-allow.txt'),
        readDeny: join(notInLaneDir, 'read-deny.txt'),
        writeAllow: join(laneDir, 'write-allow.txt'),
        writeDeny: join(notInLaneDir, 'write-deny.txt'),
        editAllow: join(laneDir, 'edit-allow.txt'),
        editDeny: join(notInLaneDir, 'edit-deny.txt'),
        imageAllow: join(laneDir, 'probe-allow.png'),
        imageDeny: join(notInLaneDir, 'probe-deny.png'),
        bashAllow: join(laneDir, 'bash-allow.txt'),
        bashDeny: join(notInLaneDir, 'bash-deny.txt'),
        hostFenceFile: join(hostFenceDir, 'write-host-fence.txt'),
      }
      // One independent fixture per call. The write targets do NOT exist yet
      // (a create, not an overwrite: no read-before-write coupling), and the
      // edit targets exist so a pre-read can arm the observation policy.
      writeFileSync(fixtures.readAllow, `${MARK.readAllow}\n`, 'utf8')
      writeFileSync(fixtures.readDeny, `${MARK.readDeny}\n`, 'utf8')
      writeFileSync(fixtures.editAllow, `${MARK.editAllowOld}\n`, 'utf8')
      writeFileSync(fixtures.editDeny, `${MARK.editDenyOld}\n`, 'utf8')
      writeFileSync(fixtures.imageAllow, PIXEL_PNG)
      writeFileSync(fixtures.imageDeny, PIXEL_PNG)
      writeFileSync(fixtures.bashAllow, `${MARK.bashAllow}\n`, 'utf8')
      writeFileSync(fixtures.bashDeny, `${MARK.bashDeny}\n`, 'utf8')
      writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2) + '\n')

      const anchor = anchorBlueprintYaml()
      writeFileSync(join(world.home, 'blueprints', 'anchor.yaml'), anchor)
      const rows = composedRows({ home: world.home, anchorYaml: anchor, layer })
      world.u6Fs.rows.push(...rows)
      if (IMAGE_ROUTE) {
        // The ONLY composition delta of this boot: the deployment's advisory
        // catalog declares `image` input for the route model, so the read_image
        // ROUTE GATE can be passed and the FS face behind it measured. Nothing
        // else in the composition changes.
        world.u6Fs.rows.push({
          id: 'llm-deepseek',
          name: '@deepseek-ai/dsh-llm-deepseek-api-key',
          config: {
            models: [{
              id: 'deepseek-v4-flash',
              name: 'DeepSeek-V4-Flash (recon image-capable catalog)',
              contextWindow: 1_000_000,
              inputModalities: ['text', 'image'],
            }],
          },
        })
      }
      log(`[boot${String(index)}] rows: ${world.u6Fs.rows.map((r) => r.id).join(',')} imageRoute=${String(IMAGE_ROUTE)}`)

      const decide = makeDecide(fixtures)
      process.env.A5SF_GOVERNED_SCRATCH = join(world.home, 'governed-scratch')
      mkdirSync(process.env.A5SF_GOVERNED_SCRATCH, { recursive: true })
      await world.startMock({ decide })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })
    abortStage = 'composition'
    paths = {
      workspace: fixtures.workspace,
      lane: fixtures.lane,
      notInLane: fixtures.notInLane,
      sink: join(world.home, 'a5sf-consult.jsonl'),
      hostFence: fixtures.hostFenceFile,
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

    // The /proc observer must start BEFORE `team.create`: the Leader's whole
    // chain (and therefore the Member turn) runs inside that synchronous call.
    const procLog = []
    const otherBwrapPids = new Set()
    const markers = [
      { marker: 'payload-bash-allow', payload: fixtures.bashAllow },
      { marker: 'payload-bash-deny', payload: fixtures.bashDeny },
      // The native fs fixtures are read in-process; a sighting of one of them
      // in ANY process argv would be an unexpected external witness.
      { marker: 'payload-read-allow', payload: fixtures.readAllow },
      { marker: 'payload-read-deny', payload: fixtures.readDeny },
    ]
    const watcher = setInterval(() => {
      try {
        const hits = scanProc(markers)
        const kept = []
        for (const hit of hits) {
          if (hit.marker === 'base-bwrap' && (!Array.isArray(hit.named) || hit.named.length === 0)) {
            otherBwrapPids.add(hit.pid)
            continue
          }
          kept.push(hit)
        }
        if (kept.length > 0) procLog.push({ at: new Date().toISOString(), hits: kept })
      } catch { /* observation must never break the run */ }
    }, 40)

    // ── discovery turn: the REAL Leader surface ─────────────────────────────
    abortStage = 'discovery'
    await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5srf')
    await waitFor(() => (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith('A5SF_SRF_DISC_DONE')), 60_000)
    const discRequests = world.mock?.requests ?? []
    const byMarker = discRequests.filter((r) => messagesOf(r).some((m) => textOf(m).includes(MK_DISC)) && surfaceNamesOf(r).length > 0).at(-1) ?? null
    const byTools = discRequests.filter((r) => surfaceNamesOf(r).length > 0).at(-1) ?? null
    const discRequest = byMarker ?? byTools ?? null
    const leaderSurface = discRequest === null ? [] : [...new Set(surfaceNamesOf(discRequest))].sort()
    log(`[boot${String(index)}] leader surface (${String(leaderSurface.length)}): ${leaderSurface.join(',')}`)
    if (!leaderSurface.some((n) => n.startsWith('team_'))) {
      throw new Error(`the Leader surface carries no team tools (${leaderSurface.join(',')}) — the composition did not register them`)
    }
    writeFileSync(join(bootDir, 'leader-surface.json'), JSON.stringify({ at: new Date().toISOString(), tools: leaderSurface }, null, 2) + '\n')
    const mainText = mainBlueprintYaml({ denyList: [], laneDir: fixtures.lane })
    assertBlueprintText(mainText, BP_MAIN_ID, 'main.yaml')
    writeFileSync(join(world.home, 'blueprints', 'main.yaml'), mainText)

    // ── team.create: the Leader's first turn delegates the governed Member ─
    abortStage = 'team-create'
    const memberPromptAt = new Date().toISOString()
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5srf')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`[boot${String(index)}] team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)

    abortStage = 'member-turn'
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
      out.delegateCall = toolCallFor(requestsNow, 'call-a5srf-delegate')
      out.delegateResult = toolResultFor(requestsNow, 'call-a5srf-delegate') ?? null
      try { out.hostLogTail = redact(readFileSync(bootInfo.logPath, 'utf8').split('\n').slice(-120).join('\n')) } catch { out.hostLogTail = '<absent>' }
      try { out.guardFacts = parseJsonl(paths.sink) } catch { out.guardFacts = [] }
      try {
        out.sessions = walkFiles(join(world.home, 'sessions')).map((e) => ({
          file: e.path, bytes: readFileSync(e.path).length, id: parseFirstJsonLine(readFileSync(e.path))?.id ?? null,
        }))
      } catch (error) { out.sessions = []; out.sessionError = String(error?.message ?? error) }
      out.counters = { ...counters, procBatches: procLog.length }
      writeFileSync(join(bootDir, `diagnostics-${label}.json`), JSON.stringify(out, null, 2) + '\n')
      try { writeFileSync(join(bootDir, `host-log-${label}.log`), out.hostLogTail + '\n') } catch { /* best effort */ }
      log(`[boot${String(index)}] diagnostics(${label}): mockRequests=${String(out.mockRequests.length)} delegateResult=${redact(String(out.delegateResult?.text ?? '<none>')).slice(0, 200)} sessions=${JSON.stringify(out.sessions.map((x) => x.id))}`)
      return out
    }
    let chainOk = false
    const chainTimeoutMs = Number(process.env.A5SF_RECON_CHAIN_TIMEOUT_MS ?? 420_000)
    const chainDeadline = Date.now() + (Number.isFinite(chainTimeoutMs) && chainTimeoutMs > 0 ? chainTimeoutMs : 420_000)
    for (;;) {
      chainOk = (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith(DONE_L1))
      if (chainOk || Date.now() > chainDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    const memberDoneAt = new Date().toISOString()
    clearInterval(watcher)
    await new Promise((r) => setTimeout(r, 800))
    log(`[boot${String(index)}] leader chain closed (${DONE_L1})=${String(chainOk)}`)
    abortStage = 'evidence-collection'
    if (!chainOk) {
      collectDiagnostics('chain-timeout')
      throw new Error('the Leader chain never closed: no Member turn settled')
    }

    const requests0 = world.mock?.requests ?? []
    const delegateCall = toolCallFor(requests0, 'call-a5srf-delegate')
    const delegateResult = toolResultFor(requests0, 'call-a5srf-delegate')
    writeFileSync(join(bootDir, 'leader-delegate.json'), JSON.stringify({
      call: delegateCall, result: delegateResult === undefined ? null : delegateResult,
    }, null, 2) + '\n')
    log(`[boot${String(index)}] delegate call=${String(delegateCall !== null)} result=${redact(String(delegateResult?.text ?? '<missing>')).slice(0, 400)}`)

    const state = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const members = Array.isArray(state?.body?.members) ? state.body.members : []
    const member = members.find((m) => String(m?.templateId ?? '') === 'worker') ?? members[0] ?? null
    const instanceId = member?.instanceId ?? null
    const memberLifecycle = member?.lifecycle ?? null
    const childSessionId = member?.childSessionId ?? member?.row?.childSessionId
      ?? (instanceId === null ? null : `session-team-child-${createHash('sha256').update(`${ACCEPTANCE_ROOT}\u0000${instanceId}`).digest('hex').slice(0, 32)}`)
    log(`[boot${String(index)}] members=${JSON.stringify(members.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle })))} childSessionId=${String(childSessionId)}`)

    const transcript = childSessionId === null ? null : readMemberTranscript(world.home, childSessionId)
    if (transcript !== null) {
      writeFileSync(join(bootDir, 'member-transcript.json'), JSON.stringify(transcript, null, 2) + '\n')
      try { writeFileSync(join(bootDir, 'member-session.v4.jsonl.zstd'), readFileSync(transcript.file)) } catch { /* normalised transcript still evidence */ }
    }
    writeFileSync(join(bootDir, 'member-transcript.txt'), renderTranscript(transcript) + '\n')

    const requests = world.mock?.requests ?? []
    const own = (id) => transcript?.calls.find((c) => String(c.callId) === String(id)) ?? null
    const callOf = (id) => toolCallFor(requests, id)
    const resultOf = (id) => toolResultFor(requests, id)

    // ── the Member surface (all names + the four native schemas) ───────────
    const memberRequest = requests.filter((r) => isMemberRequest(r) && surfaceNamesOf(r).length > 0).at(-1) ?? null
    const surfaceNames = memberRequest === null ? [] : surfaceNamesOf(memberRequest)
    const surface = surfaceNames.map((name) => {
      const schema = (memberRequest.body?.tools ?? []).find((t) => String(t?.name ?? t?.function?.name ?? '') === name)
      const fn = schema?.function ?? null
      const params = schema?.parameters ?? fn?.parameters ?? schema?.input_schema ?? schema?.inputSchema ?? null
      return { name, description: schema?.description ?? fn?.description ?? null, parameters: params, schemaKeys: schema === null || schema === undefined ? [] : Object.keys(schema) }
    })
    const surfaceSet = new Set(surfaceNames)
    writeFileSync(join(bootDir, 'tool-surface.json'), JSON.stringify({
      toolCount: surfaceNames.length,
      tools: surfaceNames,
      nativeFs: TOOLS.map((t) => surface.find((s) => s.name === t) ?? { name: t, present: false }),
      bash: surface.find((s) => s.name === 'bash') ?? null,
    }, null, 2) + '\n')

    const factsAll = parseJsonl(paths.sink).filter((f) => f?.schema === 'a5sf-guard-consult/1' || typeof f?.method === 'string')
    writeFileSync(join(bootDir, 'guard-facts.json'), JSON.stringify(factsAll, null, 2) + '\n')
    const policyRevisions = [...new Set(factsAll.map((f) => String(f.policyRevision ?? '')).filter((x) => x !== ''))]
    const identityOfFacts = [...new Set(factsAll.map((f) => String(f.memberIdentity ?? '')).filter((x) => x !== ''))]

    // ── per-call samples (Member's OWN transcript first) ───────────────────
    const specs = memberScript(fixtures)
    const samples = {}
    for (const spec of specs) {
      const id = CALL_ID(spec.key)
      samples[spec.key] = {
        key: spec.key, tool: spec.tool, expect: spec.expect, locator: spec.locator,
        call: callOf(id) ?? own(id),
        result: own(id)?.result ?? resultOf(id),
        mockResult: resultOf(id),
      }
    }

    // ── on-disk effect of every call's fixture ─────────────────────────────
    const disk = {}
    for (const spec of specs) {
      const p = spec.locator
      const exists = existsSync(p)
      const content = exists ? readFileSync(p, 'utf8') : null
      disk[spec.key] = {
        locator: p, exists,
        bytes: exists ? readFileSync(p).length : 0,
        sha256: exists ? sha256(p) : null,
        content: content !== null && content.length <= 400 ? content : (content === null ? null : `${content.slice(0, 400)}…`),
        markerPresent: content !== null && effectMarkerOf(spec.key) !== '' ? content.includes(effectMarkerOf(spec.key)) : null,
      }
    }
    writeFileSync(join(bootDir, 'disk-effects.json'), JSON.stringify(disk, null, 2) + '\n')

    // ── cross-check: the SAME tool, same session, dispatched outside the model
    abortStage = 'dispatch-crosscheck'
    const xcheck = await fetchJson(`${origin}/__p6t6/tool`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        name: 'read',
        args: { file_path: fixtures.readDeny },
        as: childSessionId,
        callId: 'a5srf-xcheck-read-deny',
      }),
    }, 60_000)
    log(`[boot${String(index)}] crosscheck read(deny locator) as member: status=${String(xcheck?.status)} body=${redact(JSON.stringify(xcheck?.body ?? null)).slice(0, 300)}`)

    // ── LIFECYCLE ARM: archive the Member, then try to execute again ───────
    abortStage = 'lifecycle'
    const factsAtStop = parseJsonl(paths.sink).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const archiveAt = new Date().toISOString()
    const archiveCall = instanceId === null ? null : await fetchJson(`${origin}/__p6t6/tool`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        name: 'team_archive_member',
        args: { rootSessionId: ACCEPTANCE_ROOT, requestToken: 'a5srf-archive', targetInstanceId: instanceId },
        as: ACCEPTANCE_ROOT,
        callId: 'a5srf-archive',
      }),
    }, 60_000)
    const stopInstant = new Date().toISOString()
    const stateAfterArchive = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const membersAfter = Array.isArray(stateAfterArchive?.body?.members) ? stateAfterArchive.body.members : []
    const postArchiveRead = await fetchJson(`${origin}/__p6t6/tool`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'read', args: { file_path: fixtures.readDeny }, as: childSessionId, callId: 'a5srf-post-archive-read' }),
    }, 60_000)
    const postArchiveWrite = await fetchJson(`${origin}/__p6t6/tool`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'write', args: { file_path: fixtures.hostFenceFile, content: 'POST_ARCHIVE\n' }, as: childSessionId, callId: 'a5srf-post-archive-write' }),
    }, 60_000)
    const factsAtEnd = parseJsonl(paths.sink).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const probeFacts = factsAtEnd.slice(factsAtStop.length)
    const postArchiveExecuted = (r) => r?.status === 200 && r?.body?.ok !== false
    const lifecycle = {
      at: archiveAt, stopInstant,
      archive: archiveCall === null ? null : { status: archiveCall.status, body: archiveCall.body },
      memberBefore: { instanceId, lifecycle: memberLifecycle, childSessionId },
      membersAfterArchive: membersAfter.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle })),
      postArchive: {
        read: postArchiveRead === null ? null : { status: postArchiveRead.status, body: postArchiveRead.body, executed: postArchiveExecuted(postArchiveRead) },
        write: postArchiveWrite === null ? null : { status: postArchiveWrite.status, body: postArchiveWrite.body, executed: postArchiveExecuted(postArchiveWrite) },
      },
      factsBeforeStop: factsAtStop.length,
      factsAfterProbes: factsAtEnd.length,
      probeFacts,
      executedAfterArchive: postArchiveExecuted(postArchiveRead) || postArchiveExecuted(postArchiveWrite),
      refusalLayer: postArchiveExecuted(postArchiveRead) || postArchiveExecuted(postArchiveWrite)
        ? 'NONE (the tool executed after archive)'
        : (postArchiveRead?.status === 422 ? 'session route (NO_LIVE_AGENT) — NOT the fs guard' : `HTTP ${String(postArchiveRead?.status)}`),
      defaultRow: {
        verdict: postArchiveExecuted(postArchiveRead) || postArchiveExecuted(postArchiveWrite) ? 'FAIL' : 'PASS',
        detail: postArchiveExecuted(postArchiveRead) || postArchiveExecuted(postArchiveWrite)
          ? 'a tool executed after the Member was archived'
          : `no post-archive execution: the refusal is the SESSION ROUTE (${String(postArchiveRead?.status)}), not the Member fs face — and because the native fs path produced no guard facts at all, revocation has nothing to revoke there`,
        postArchiveReadStatus: postArchiveRead?.status ?? null,
        postArchiveWriteStatus: postArchiveWrite?.status ?? null,
        executedAfterArchive: postArchiveExecuted(postArchiveRead) || postArchiveExecuted(postArchiveWrite),
      },
    }
    writeFileSync(join(bootDir, 'lifecycle.json'), JSON.stringify(lifecycle, null, 2) + '\n')
    log(`[boot${String(index)}] lifecycle: archive=${String(archiveCall?.status)} postRead=${String(postArchiveRead?.status)} postWrite=${String(postArchiveWrite?.status)} probeFacts=${String(probeFacts.length)}`)

    // ── counters (the independent /proc witness) ───────────────────────────
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
    const launcherPids = sightingPids('confined-launcher', (h) => h.cmdline.includes('--confined-exec-stream'))
    const preflightPids = sightingPids('confined-launcher', (h) => h.cmdline.includes('--confined-exec-stream') === false)
    counters.confinedTurnLaunchers = launcherPids.size
    counters.preflightLaunchers = preflightPids.size
    counters.payloadInLaneSightings = sightingPids('payload-bash-allow').size
    counters.procSecretCommandSightings = sightingPids('payload-bash-deny').size
    counters.nativeFsPayloadSightings = sightingPids('payload-read-allow').size + sightingPids('payload-read-deny').size
    counters.baseBwrapWithMarkers = sightingPids('base-bwrap', (h) => Array.isArray(h.named) && h.named.length > 0).size
    counters.guardFacts = {
      total: factsAll.length,
      allow: factsAll.filter((f) => f.decision === 'allow').length,
      deny: factsAll.filter((f) => f.decision === 'deny').length,
      byMethod: factsAll.reduce((acc, f) => { acc[f.method] = (acc[f.method] ?? 0) + 1; return acc }, {}),
    }
    counters.mockRequests = requests.length
    counters.memberModelRequests = requests.filter((r) => isMemberRequest(r) && surfaceNamesOf(r).length > 0).length
    counters.procBatches = procLog.length
    counters.otherBwrapPids = otherBwrapPids.size
    counters.memberWindow = { from: memberPromptAt, to: memberDoneAt }
    counters.policyRevisions = policyRevisions
    counters.memberIdentitiesInFacts = identityOfFacts
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')
    writeFileSync(join(bootDir, 'proc-observations.json'), JSON.stringify({
      schema: 'a5sf-recon-fs/proc-observations/1', at: new Date().toISOString(),
      note: 'independent /proc/<pid>/cmdline scan; a sighting is an OS-level fact, not a product counter',
      sightings: procLog,
    }, null, 2) + '\n')

    // ── the per-call table ─────────────────────────────────────────────────
    const callRows = specs.map((spec) => {
      const s = samples[spec.key]
      return {
        caseId: `fs:${spec.key}`,
        callId: CALL_ID(spec.key),
        tool: spec.tool,
        expected: spec.expect,
        locator: spec.locator,
        inLane: spec.locator.startsWith(`${fixtures.lane}/`),
        args: callOf(CALL_ID(spec.key))?.arguments ?? null,
        issued: s.call !== null && s.call !== undefined,
        resultPresent: s.result !== undefined,
        isError: s.result?.isError ?? null,
        outcomeClass: classifyCall({ call: s.call ?? { name: spec.tool }, tool: spec.tool, result: s.result, facts: factsAll, locator: spec.locator, surfaceSet }),
        resultBytes: byteEvidence(s.result?.text),
        resultImages: (s.result?.images?.length ?? 0) > 0 ? s.result.images : (s.mockResult?.images ?? []),
        guardFacts: factsFor(factsAll, spec.locator),
        onDisk: disk[spec.key],
      }
    })
    writeFileSync(join(bootDir, 'calls.json'), JSON.stringify({
      schema: 'a5sf-recon-fs/calls/1', at: new Date().toISOString(),
      attribution: 'each call has a UNIQUE locator, so a guard fact at that locator is attributable to exactly this call',
      identity: { instanceId, childSessionId, policyRevisions, memberIdentitiesInFacts: identityOfFacts },
      calls: callRows,
    }, null, 2) + '\n')
    writeFileSync(join(bootDir, 'calls.txt'), renderCalls(callRows) + '\n')

    // ── the seven-items table per tool ─────────────────────────────────────
    const seven = {}
    for (const tool of TOOLS) {
      seven[tool] = sevenItemsForTool({
        tool,
        specs: specs.filter((s) => s.tool === tool),
        samples, facts: factsAll, memberIdentity: instanceId, policyRevision: policyRevisions[0] ?? null,
        surface, disk, lifecycle,
      })
    }
    writeFileSync(join(bootDir, 'seven-items.json'), JSON.stringify({
      schema: 'a5sf-recon-fs/seven-items/1', at: new Date().toISOString(),
      binding: {
        productSha: head, hostSha: TEST_USE_BASELINE_SHA, memberInstanceId: instanceId,
        memberLifecycle, childSessionId, blueprintRevision: { blueprintId: BP_MAIN_ID, revision: '1', schemaVersion: 4 },
        authorityRevision: policyRevisions, providerPolicyRevision: policyRevisions[0] ?? null,
        memberIdentitiesInFacts: identityOfFacts, ceiling: { read: [fixtures.lane], write: [fixtures.lane] },
      },
      tools: seven,
    }, null, 2) + '\n')

    // ── provider attribution (the one claim this recon must not overstate) ──
    const nativeSpecs = specs.filter((s) => s.tool !== 'bash')
    const bashSpecs = specs.filter((s) => s.tool === 'bash')
    const nativeFacts = factsAll.filter((f) => nativeSpecs.some((s) => resolve(f.locator ?? '') === resolve(s.locator)))
    const bashFacts = factsAll.filter((f) => bashSpecs.some((s) => resolve(f.locator ?? '') === resolve(s.locator)))
    const providerAttribution = {
      schema: 'a5sf-recon-fs/provider-attribution/1', at: new Date().toISOString(),
      memberIdentity: instanceId,
      realmPolicyRevision: policyRevisions[0] ?? null,
      nativeFs: {
        calls: nativeSpecs.length,
        guardFacts: nativeFacts.length,
        face: nativeFacts.length === 0 ? 'host ctx.fs (no a5sf guard consult)' : 'realm confined fs',
        conclusion: nativeFacts.length === 0
          ? 'ZERO guard facts exist for the native fs calls whose locators are unique: the Member\'s confined fs Provider was never consulted. The bytes came from a provider that is not the realm\'s.'
          : 'guard facts exist: the realm confined fs provider decided at least one native fs call.',
      },
      bash: {
        calls: bashSpecs.length,
        guardFacts: bashFacts.length,
        facts: bashFacts.map((f) => ({ method: f.method, locator: f.locator, decision: f.decision, decidedBy: f.decidedBy })),
        face: bashFacts.length > 0 ? 'realm confined terminal face (shellRead guard)' : 'NOT the realm face',
      },
      compositionFact: {
        a5sfNativeToolModules: null,
        note: 'the shipped governed preset configures NO native tool modules; `attachA5sfNativeToolModules` therefore has an empty spec list and shadows nothing. The four native fs tools stay the preset\'s own definitions, mounted on the preset registry scope — whose `ctx.fs` is the base host provider, not the Member\'s isolated `fs` label.',
      },
      readImageOutcome: callRows.find((c) => c.caseId === 'fs:read-image-allow')?.outcomeClass ?? null,
      imageRouteDeclared: IMAGE_ROUTE,
      hostReach: (() => {
        const row = callRows.find((c) => c.caseId === 'fs:read-host-reach')
        return row === undefined ? null : {
          callId: row.callId, locator: row.locator, isError: row.isError,
          outcomeClass: row.outcomeClass, bytes: row.resultBytes.bytes,
          sha256: row.resultBytes.sha256, excerpt: row.resultBytes.excerpt,
          guardFacts: row.guardFacts.length,
        }
      })(),
      hostSandboxProbe: (() => {
        const row = callRows.find((c) => c.caseId === 'fs:write-host-fence')
        return row === undefined ? null : {
          callId: row.callId, locator: row.locator, isError: row.isError,
          outcomeClass: row.outcomeClass, bytes: row.resultBytes.bytes,
          excerpt: row.resultBytes.excerpt, onDisk: row.onDisk,
        }
      })(),
      crosscheck: { status: xcheck?.status ?? null, body: xcheck?.body ?? null },
      lifecycle,
    }
    writeFileSync(join(bootDir, 'provider-attribution.json'), JSON.stringify(providerAttribution, null, 2) + '\n')

    // ── judges ─────────────────────────────────────────────────────────────
    const bashAllow = samples['bash-allow']
    const bashDeny = samples['bash-deny']
    const verdicts = {
      surface: (() => {
        const missing = TOOLS.filter((t) => !surfaceSet.has(t))
        const wrong = TOOLS.filter((t) => {
          const entry = surface.find((s) => s.name === t)
          const props = Object.keys(entry?.parameters?.properties ?? {})
          return entry !== undefined && !(SCHEMA_REQUIRED[t] ?? []).every((p) => props.includes(p))
        })
        return verdictOf('the four native fs tools are on the governed Member\'s model-visible surface with the preset\'s own schemas', [
          { id: 'all-present', ok: missing.length === 0, detail: `missing=${JSON.stringify(missing)}` },
          { id: 'schemas', ok: wrong.length === 0, detail: `wrong-schema=${JSON.stringify(wrong)}` },
          { id: 'read_image-present', ok: surfaceSet.has('read_image'), detail: 'read_image is registered (which also says `attachments` resolved on the preset scope)' },
        ])
      })(),
      readAllow: verdictsOfCall(seven.read.allow, 'read'),
      readDeny: verdictsOfDeny(seven.read.deny, 'read'),
      writeAllow: verdictsOfCall(seven.write.allow, 'write'),
      writeDeny: verdictsOfDeny(seven.write.deny, 'write'),
      editAllow: verdictsOfCall(seven.edit.allow, 'edit'),
      editDeny: verdictsOfDeny(seven.edit.deny, 'edit'),
      imageAllow: verdictsOfCall(seven.read_image.allow, 'read_image'),
      imageDeny: verdictsOfDeny(seven.read_image.deny, 'read_image'),
      provider: verdictOf('every native fs call was decided by the Member\'s confined fs Provider', [
        {
          id: 'native-facts-present',
          ok: providerAttribution.nativeFs.guardFacts > 0,
          detail: `native fs guard facts=${String(providerAttribution.nativeFs.guardFacts)} for ${String(providerAttribution.nativeFs.calls)} calls; face=${providerAttribution.nativeFs.face}`,
        },
        {
          id: 'bash-facts-present',
          ok: providerAttribution.bash.guardFacts > 0,
          detail: `the SAME boot's governed terminal face wrote ${String(providerAttribution.bash.guardFacts)} shellRead fact(s) — the realm guard exists, so the native zero is not "no guard mounted"`,
        },
      ]),
      facts: verdictOf('each native fs call has a guard fact carrying the real Member identity and the realm policyRevision', [
        {
          id: 'facts-for-all-tools',
          ok: TOOLS.every((t) => seven[t].evidence.verdict === 'PASS'),
          detail: `per-tool evidence: ${TOOLS.map((t) => `${t}=${seven[t].evidence.verdict}`).join(',')}`,
        },
        {
          id: 'identity',
          ok: identityOfFacts.length === 1 && identityOfFacts[0] === instanceId,
          detail: `fact identities=${JSON.stringify(identityOfFacts)} member=${String(instanceId)}`,
        },
      ]),
      bashControl: judgeBashControl({ allowSample: bashAllow, denySample: bashDeny, facts: factsAll, memberIdentity: instanceId }),
      lifecycle: verdictOf('no native fs call can execute after the Member is archived', [
        {
          id: 'no-execution',
          ok: lifecycle.executedAfterArchive === false,
          detail: `post-archive read=${String(lifecycle.postArchive.read?.status)} write=${String(lifecycle.postArchive.write?.status)} executed=${String(lifecycle.executedAfterArchive)}`,
        },
        {
          id: 'no-new-facts',
          ok: probeFacts.length === 0,
          detail: `guard facts written by the post-archive probes=${String(probeFacts.length)}`,
        },
        {
          id: 'layer-named',
          ok: lifecycle.refusalLayer !== 'NONE (the tool executed after archive)',
          detail: `refusal layer=${lifecycle.refusalLayer}`,
        },
      ]),
    }
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}`)
    }
    add('fs:surface', verdicts.surface.verdict, verdicts.surface)
    add('fs:read-allowed', verdicts.readAllow.verdict, verdicts.readAllow)
    add('fs:read-ceiling-denied', verdicts.readDeny.verdict, verdicts.readDeny)
    add('fs:write-allowed', verdicts.writeAllow.verdict, verdicts.writeAllow)
    add('fs:write-ceiling-denied', verdicts.writeDeny.verdict, verdicts.writeDeny)
    add('fs:edit-allowed', verdicts.editAllow.verdict, verdicts.editAllow)
    add('fs:edit-ceiling-denied', verdicts.editDeny.verdict, verdicts.editDeny)
    add('fs:read-image-allowed', verdicts.imageAllow.verdict, verdicts.imageAllow)
    add('fs:read-image-ceiling-denied', verdicts.imageDeny.verdict, verdicts.imageDeny)
    add('fs:provider-attribution', verdicts.provider.verdict, verdicts.provider)
    add('fs:guard-facts', verdicts.facts.verdict, verdicts.facts)
    add('fs:bash-control', verdicts.bashControl.verdict, verdicts.bashControl)
    add('fs:lifecycle-post-archive', verdicts.lifecycle.verdict, verdicts.lifecycle)

    collectDiagnostics('final')
    const final = record.finalize()
    const summary = formatSummary(final)
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), summary + '\n')
    log(`[boot${String(index)}] ${summary}`)

    result = {
      boot: index, worldId: world.id, port: bootInfo.port, hostLog: bootInfo.logPath,
      runId, summary, overall: final.overall,
      childSessionId, instanceId, memberLifecycle,
      counters, verdicts, seven, providerAttribution, lifecycle, callRows,
      identity: { policyRevisions, memberIdentitiesInFacts: identityOfFacts },
      paths,
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
    try { lease.release?.() } catch { /* slot cleanup */ }
    if (world !== null) {
      try {
        teardown = await world.teardown({ keepHome: false })
        log(`[boot${String(index)}] teardown: ${JSON.stringify(teardown).slice(0, 600)}`)
      } catch (error) {
        log(`[boot${String(index)}] teardown failed: ${String(error?.message ?? error)}`)
      }
    }
    const porcelain = hostPorcelain()
    writeFileSync(join(bootDir, 'teardown.json'), JSON.stringify({
      at: new Date().toISOString(), teardown, hostTreePorcelain: porcelain,
      homeDeleted: world === null ? null : !existsSync(world.home),
    }, null, 2) + '\n')
    if (porcelain.length > 0) log(`[boot${String(index)}] HOST TREE IS DIRTY: ${JSON.stringify(porcelain)}`)
  }
  if (failure !== null) return { boot: index, failed: true, stage: abortStage, error: String(failure?.message ?? failure), result }
  return result
}

function verdictsOfCall(section, tool) {
  return verdictOf(
    `the ${tool} ALLOW-axis call succeeds and returns its effect`,
    [
      { id: 'outcome', ok: String(section.outcomeClass ?? '').startsWith('COMPLETED_'), detail: `outcomeClass=${String(section.outcomeClass)}` },
      { id: 'verdict', ok: section.verdict === 'PASS', detail: `allow verdict=${String(section.verdict)}` },
      { id: 'result-bytes', ok: (section.resultBytes?.bytes ?? 0) > 0, detail: `result bytes=${String(section.resultBytes?.bytes)} sha256=${String(section.resultBytes?.sha256).slice(0, 16)}…` },
    ],
  )
}
function verdictsOfDeny(section, tool) {
  return verdictOf(
    `the ${tool} DENY-axis call is refused AT THE MEMBER CEILING (guard deny fact + typed code + zero bytes)`,
    [
      { id: 'verdict', ok: section.verdict === 'PASS', detail: `deny verdict=${String(section.verdict)} outcomeClass=${String(section.outcomeClass)}` },
      { id: 'outcome-is-refusal', ok: String(section.outcomeClass ?? '').startsWith('REFUSED_') || section.outcomeClass === 'CORRECTLY_REFUSED', detail: `outcomeClass=${String(section.outcomeClass)}` },
      { id: 'zero-secret-bytes', ok: section.secretAbsent === true, detail: `the deny fixture's marker is absent from the result=${String(section.secretAbsent)}` },
      { id: 'effect-absent', ok: section.effect === null || section.effect?.markerPresent !== true, detail: `on-disk effect=${JSON.stringify(section.effect)}` },
    ],
  )
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
    out.push('USER:', text.length <= 900 ? text : `${text.slice(0, 900)}\n… [rendered truncated at 900 chars; the full text is in member-transcript.json]`, '')
  }
  for (const call of transcript.calls) {
    const args = call.arguments ?? {}
    out.push(`TOOL CALL [${call.name}] ${String(call.callId)}`)
    for (const [k, v] of Object.entries(args)) {
      const s = typeof v === 'string' ? v : JSON.stringify(v)
      out.push(`  ${k}: ${s.length <= 400 ? s : `${s.slice(0, 400)}…`}`)
    }
    if (call.result === null) {
      out.push('TOOL RESULT: <missing>', '')
      continue
    }
    out.push(`TOOL RESULT isError=${String(call.result.isError)}`)
    out.push(indent(call.result.text))
    if (Array.isArray(call.result.images) && call.result.images.length > 0) {
      out.push(`  [image blocks: ${JSON.stringify(call.result.images)}]`)
    }
    out.push('')
  }
  out.push('ASSISTANT (final):', String(transcript.finalAssistant ?? '').trim())
  return out.join('\n')
}
function indent(text) {
  return String(text ?? '').split('\n').map((l) => `  ${l}`).join('\n')
}

function renderCalls(rows) {
  const out = ['# one row per Member tool call (unique fixture + unique call id)', '']
  for (const row of rows) {
    out.push(`CALL ${row.callId}  tool=${row.tool}  expected=${row.expected}`)
    out.push(`  locator:   ${row.locator}`)
    out.push(`  inLane:    ${String(row.inLane)}`)
    out.push(`  issued:    ${String(row.issued)}  resultPresent=${String(row.resultPresent)}  isError=${String(row.isError)}`)
    out.push(`  class:     ${row.outcomeClass}`)
    out.push(`  bytes:     ${String(row.resultBytes.bytes)}  sha256=${row.resultBytes.sha256}`)
    out.push(`  guardFacts:${JSON.stringify(row.guardFacts.map((f) => ({ method: f.method, decision: f.decision, decidedBy: f.decidedBy })))}`)
    out.push(`  onDisk:    exists=${String(row.onDisk?.exists)} bytes=${String(row.onDisk?.bytes)} markerPresent=${String(row.onDisk?.markerPresent)}`)
    out.push('')
  }
  return out.join('\n')
}

function runBindings(head, grant) {
  return {
    authority: readAuthorityBinding(REPO_ROOT),
    candidate: { head, hostSha: TEST_USE_BASELINE_SHA, baseline: TEST_USE_BASELINE_SHA },
    grant: { grantId: grant.grantId, scope: 'DEV-LIVE', face: grant.face, world: grant.world },
    recordClass: 'DEV-LIVE',
    teamSha: head,
    hostSha: TEST_USE_BASELINE_SHA,
    note: 'DEV-LIVE recon: development evidence, never a candidate claim; candidateClaimEligibility is false by construction',
  }
}

/** Archive-before-start: a previous `runs/` is moved aside, never overwritten. */
function archivePriorRuns() {
  if (!existsSync(RUNS)) return null
  const entries = readdirSync(RUNS)
  if (entries.length === 0) return null
  mkdirSync(ARCHIVE, { recursive: true })
  const target = join(ARCHIVE, RUN_TAG === null ? utcStamp() : `${utcStamp()}-${RUN_TAG}`)
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
  if (COMPARE !== null) { compareStoredRuns(COMPARE); return }
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
    command: `node tests/world-factory/drivers/a5sf-recon-fs/run-boot.mjs${BOOTS_WANTED === 1 ? '' : ` --boots ${String(BOOTS_WANTED)}`}${IMAGE_ROUTE ? ' --image-route' : ''}${RUN_TAG === null ? '' : ` --run-tag ${RUN_TAG}`}`,
    derivedFrom: 'tests/world-factory/drivers/a5sf-live-member/run-boot.mjs @ 235e1af8b',
    composition: {
      preset: PRESET_ID,
      a5sfGovernedRealm: true,
      a5sfNativeToolModules: null,
      ceiling: 'read = write = <workspace>/lane',
      imageCapableRouteDeclared: IMAGE_ROUTE,
      runTag: RUN_TAG,
    },
  }, null, 2) + '\n')
  log(`START head=${head} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA} boots=${String(BOOTS_WANTED)} imageRoute=${String(IMAGE_ROUTE)} runTag=${String(RUN_TAG)}`)
  log(`host porcelain before: ${JSON.stringify(hostPorcelain())}`)
  if (hostPorcelain().length !== 0) throw new Error('the pinned host tree is not clean (porcelain non-empty): refusing to boot')

  const results = []
  for (let i = 1; i <= BOOTS_WANTED; i += 1) {
    const r = await bootOnce({ index: i, head, grant, layer })
    results.push(r)
    if (r?.failed === true) {
      log(`boot ${String(i)} failed at ${String(r.stage)}; continuing is pointless (no agreeing pair)`)
      break
    }
  }

  const agreement = buildAgreement(results)
  const aggregateDir = RUN_TAG === null ? EVIDENCE : RUNS
  writeFileSync(join(aggregateDir, 'agreement.json'), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(aggregateDir, 'agreement.txt'), agreement.table + '\n')
  log(agreement.table)
  const porcelain = hostPorcelain()
  writeFileSync(join(EVIDENCE, 'host-tree-porcelain.txt'), porcelain.length === 0 ? 'empty\n' : porcelain.join('\n') + '\n')
  log(`host porcelain after: ${JSON.stringify(porcelain)}`)
  if (porcelain.length !== 0) process.exitCode = 1
  const allOk = results.length === BOOTS_WANTED && results.every((r) => r?.failed !== true)
  const pairOk = BOOTS_WANTED < 2 || agreement.agreeing === true
  log(`RESULT ${allOk && pairOk ? 'COMPLETE' : 'INCOMPLETE'} (${String(results.length)}/${String(BOOTS_WANTED)} boots; agreeing pair=${String(agreement.agreeing)})`)
  if (!allOk || !pairOk) process.exitCode = 1
}

/** Host-free: rebuild the agreement table from stored boot artefacts. */
function compareStoredRuns(tags) {
  const results = tags.map((tag) => {
    const dir = join(EVIDENCE, 'runs', tag, 'boot01')
    const seven = readJson(join(dir, 'seven-items.json'))
    const calls = readJson(join(dir, 'calls.json'))
    const attribution = readJson(join(dir, 'provider-attribution.json'))
    const counters = readJson(join(dir, 'counters.json'))
    const lifecycle = readJson(join(dir, 'lifecycle.json'))
    if (seven === null || calls === null) throw new Error(`run tag '${tag}' has no stored seven-items/calls artefact under ${dir}`)
    return {
      boot: tag,
      seven: seven.tools,
      instanceId: seven.binding?.memberInstanceId ?? null,
      callRows: calls.calls ?? [],
      providerAttribution: attribution,
      counters,
      lifecycle,
    }
  })
  const agreement = buildAgreement(results)
  writeFileSync(join(EVIDENCE, 'agreement.json'), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(EVIDENCE, 'agreement.txt'), agreement.table + '\n')
  log(agreement.table)
  log(`COMPARE tags=${tags.join(',')} agreeing=${String(agreement.agreeing)}`)
}

function hostDigest() {
  try { return execFileSync('git', ['-C', HOST_TREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { return null }
}

/** The agreement table: the facts that must be IDENTICAL across boots. */
function buildAgreement(results) {
  const ok = results.filter((r) => r?.failed !== true)
  const pick = (r) => {
    const seven = r?.seven ?? {}
    const row = {}
    for (const tool of TOOLS) {
      for (const item of ['surface', 'dispatch', 'provider', 'allow', 'deny', 'evidence', 'lifecycle']) {
        row[`${tool}.${item}`] = seven[tool]?.[item]?.verdict ?? null
      }
    }
    row.classes = r?.callRows?.map((c) => `${c.tool}:${c.expected}:${c.outcomeClass}`).join('|') ?? null
    row.bashControlFacts = r?.providerAttribution?.bash?.guardFacts ?? null
    row.nativeFsFacts = r?.providerAttribution?.nativeFs?.guardFacts ?? null
    row.guardFactTotal = r?.counters?.guardFacts?.total ?? null
    row.memberIdentity = r?.instanceId ?? null
    row.lifecycleExecuted = r?.lifecycle?.executedAfterArchive ?? null
    return row
  }
  const rows = ok.map((r) => ({ boot: r.boot, ...pick(r) }))
  const keys = Object.keys(rows[0] ?? {}).filter((k) => k !== 'boot')
  // `memberIdentity` and the class table are boot-specific (instance ids differ
  // by construction); they are shown, not required to be equal.
  const required = keys.filter((k) => k !== 'memberIdentity')
  const differing = required.filter((k) => new Set(rows.map((r) => JSON.stringify(r[k]))).size > 1)
  const agreeing = rows.length >= 2 && differing.length === 0
  const header = ['fact', ...rows.map((r) => `boot${String(r.boot)}`)]
  const body = keys.map((k) => [k, ...rows.map((r) => String(r[k]))])
  const width = Math.max(34, ...header.map((h) => h.length)) + 2
  const cell = (v) => String(v).padEnd(width)
  const table = [
    'AGREEMENT (the same command, every boot; every REQUIRED row must be identical)',
    header.map(cell).join('').replace(/ +$/u, ''),
    ...body.map(([k, ...vals]) => `${cell(k)}${vals.map(cell).join('')}`.replace(/ +$/u, '')),
    '',
    `agreeing=${String(agreeing)} differing=${JSON.stringify(differing)}`,
  ].join('\n')
  return { schema: 'a5sf-recon-fs/agreement/1', at: new Date().toISOString(), boots: results.length, agreeing, differing, rows, table }
}

main().catch((error) => {
  log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
