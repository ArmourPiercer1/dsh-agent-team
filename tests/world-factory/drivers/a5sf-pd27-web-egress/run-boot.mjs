#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-pd27-web-egress/run-boot.mjs — the LIVE
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
 *   node tests/world-factory/drivers/a5sf-pd27-web-egress/run-boot.mjs
 *   node tests/world-factory/drivers/a5sf-pd27-web-egress/run-boot.mjs --arm prefix
 *
 * `--arm prefix` boots the RECORDED pre-fix composition
 * (`A5SF_PD27_COMPOSITION`, the lane's base commit's `cordis.patch.yml`), so
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
 * @module tests/world-factory/drivers/a5sf-pd27-web-egress/run-boot
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
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
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd27-web-egress')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')

const LINE = 'u5a5sfpd27'
const BOOT_ROOT = 'session-a5sf-pd27-boot'
const ACCEPTANCE_ROOT = 'session-a5sf-pd27-team'
const BP_ANCHOR_ID = 'team.a5sf.pd27.anchor'
const BP_MAIN_ID = 'team.a5sf.pd27.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'A5SF_PD27_DISC'
const MK_L1 = 'A5SF_PD27_L1_DRIVE'
const TOK_A = 'a5sf-pd27-turn'
const CALL_DELEGATE_A = 'call-a5sfpd27-delegate-a'
const CALL_FETCH = 'call-a5sfpd27-fetch'
const CALL_SEARCH = 'call-a5sfpd27-search'
const CALL_CLOSED_WORKFLOW = 'call-a5sfpd27-closed-workflow'
const CALL_CLOSED_RUNCODE = 'call-a5sfpd27-closed-runcode'
const DONE_A = 'A5SF_PD27_MEMBER_A_DONE'
const DONE_L1 = 'A5SF_PD27_L1_DONE'

/** The body the LOCAL server serves. Verbatim, or the allow arm did not happen. */
const KNOWN_BODY = 'A5SF_PD27_KNOWN_BODY_BYTES'
const KNOWN_PATH = '/known'
const DENY_PATH = '/denied'
/** The names this lane restores; both arms must keep the SAME surface. */
const WEB_TOOL_NAMES = Object.freeze(['web_fetch', 'web_search'])


const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
/** PD-27's three arms: the recorded pre-fix surface, the allow lane, the deny lane. */
const ARM = (() => {
  const i = argv.indexOf('--arm')
  if (i === -1) return 'allow'
  const value = argv[i + 1]
  if (value !== 'allow' && value !== 'deny' && value !== 'prefix') {
    throw new Error(`--arm must be 'allow', 'deny' or 'prefix' (got ${String(value)})`)
  }
  return value
})()
/** The cases THIS arm measures. A selected case with no verdict is a FAIL. */
const SELECTED_CASES = Object.freeze([
  ARM === 'deny' ? 'pd27:web-deny' : ARM === 'prefix' ? 'pd27:web-prefix' : 'pd27:web-allow',
  'pd27:web-surface',
  'pd27:closed-still-typed',
  'pd27:no-base-transport',
])
/** The template whose compiled answer the COMPOSITION supplies for this arm. */
const TEMPLATE = ARM === 'deny' ? 'webworker-deny' : 'worker'
const RUNS = ARM === 'prefix'
  ? join(EVIDENCE, 'archive', 'pair-prefix')
  : join(EVIDENCE, 'runs', ARM)
const COMPOSITION_PATH = process.env.A5SF_PD27_COMPOSITION === undefined || process.env.A5SF_PD27_COMPOSITION === ''
  ? join(REPO_ROOT, 'cordis.patch.yml')
  : resolve(process.env.A5SF_PD27_COMPOSITION)
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
  const candidates = [process.env.A5SF_PD27_HOST_TREE, join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')]
  const m = /^(.*)\/\.worktrees\/[^/]+$/u.exec(REPO_ROOT)
  if (m !== null) candidates.push(join(m[1], 'tests', 'deepseek-harness-test-use'))
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== '' && existsSync(candidate)) return candidate
  }
  throw new Error('the pinned host tree is not resolvable (set A5SF_PD27_HOST_TREE): a live boot needs it')
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
// the LOCAL HTTP server — the arm's ground truth
// ─────────────────────────────────────────────────────────────────────────────
/**
 * An in-process server with its OWN connection counter. `/known` answers with
 * the body the allow arm must return verbatim; `/denied` answers the same way,
 * so a deny arm that reached the transport would SUCCEED and be caught by the
 * counter rather than by a 404. Nothing here needs external network.
 */
function makeLocalServer() {
  const state = { connections: 0, pathHits: {}, requests: [], bytes: 0, closed: false }
  const sockets = new Set()
  const handler = (req, res) => {
    const path = String(req.url ?? '').split('?')[0]
    state.pathHits[path] = (state.pathHits[path] ?? 0) + 1
    state.requests.push({ at: new Date().toISOString(), method: String(req.method ?? ''), path })
    const body = KNOWN_BODY
    state.bytes += Buffer.byteLength(body)
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': String(Buffer.byteLength(body)) })
    res.end(body)
  }
  const server = createServer(handler)
  server.on('connection', (socket) => {
    state.connections += 1
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
  })
  return {
    async start() {
      await new Promise((resolveStart, rejectStart) => {
        server.once('error', rejectStart)
        server.listen(0, '127.0.0.1', resolveStart)
      })
      const address = server.address()
      return `http://127.0.0.1:${String(address.port)}`
    },
    reset() {
      state.connections = 0
      state.pathHits = {}
      state.requests = []
      state.bytes = 0
    },
    snapshot() {
      return {
        connections: state.connections,
        pathHits: { ...state.pathHits },
        requests: [...state.requests],
        bytesServed: state.bytes,
        openSockets: sockets.size,
        servedBody: KNOWN_BODY,
      }
    },
    async stop() {
      if (state.closed) return
      state.closed = true
      for (const socket of sockets) { try { socket.destroy() } catch { /* closed */ } }
      await new Promise((resolveStop) => server.close(() => resolveStop()))
    },
  }
}
let server = null
let targetBase = ''

// ─────────────────────────────────────────────────────────────────────────────
// blueprints
// ─────────────────────────────────────────────────────────────────────────────
function anchorBlueprintYaml() {
  const doc = {
    schemaVersion: 3,
    blueprintId: BP_ANCHOR_ID,
    revision: '1',
    leader: { templateId: 'leader', persona: `You lead the a5sf PD-27 anchor team. ${MK_DISC} is the discovery marker.` },
    members: [{ templateId: TEMPLATE, persona: 'You are the anchor worker.' }],
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
 * ONE governed Member, one network lane.
 *
 * `memberIoCeilings` is required by the v4 grammar and documents the INTENT; it
 * is NOT what compiles this Member. The product has no v4 → compiled-lane
 * bridge at this base, and `product-assembly.ts` REFUSES a narrowing
 * `network: deny` ceiling with `NETWORK_UNCONFINED_REALM` before any realm
 * exists. The lane is therefore supplied by the composition (the offer row) —
 * which is why the deny arm measures the MECHANISM, not a path a user can take.
 */
function mainBlueprintYaml({ workspace }) {
  const doc = {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the a5sf PD-27 web-egress team. ${MK_L1} drives your chain: delegate the governed Member once (sync), then finish.`,
    },
    members: [
      {
        templateId: TEMPLATE,
        displayName: ARM === 'deny' ? 'Governed Deny Worker' : 'Governed Allow Worker',
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
        templateId: TEMPLATE,
        io: {
          read: lane([workspace]),
          write: lane([workspace]),
          network: ARM === 'deny' ? { mode: 'deny', default: 'deny' } : { mode: 'allow' },
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

function composedRows({ home, anchorYaml, layer, targetBase }) {
  const hostRow = layer.rows.find((row) => row?.name === 'dsh-agent-team/host')
  const presetRow = layer.rows.find((row) => row?.config?.id === PRESET_ID)
  if (hostRow === undefined) throw new Error('the shipped layer carries no dsh-agent-team/host row')
  if (presetRow === undefined) throw new Error(`the shipped layer carries no preset '${PRESET_ID}' row`)
  const counterPath = join(home, 'a5sf-pd27-web-counters.jsonl')
  const hostWebCounterPath = join(home, 'a5sf-pd27-host-web-calls.jsonl')
  const config = {
    ...hostRow.config,
    rootSessionId: BOOT_ROOT,
    bootPhase: 'create',
    blueprintSource: anchorYaml,
    blueprintDir: join(home, 'blueprints'),
    seedMembers: [],
    memberPresetId: PRESET_ID,
    // NO `a5sfGovernedRealm`: the shipped governed realm supplies `subprocess`
    // and `terminal` only, so it cannot serve a web face; the realm answer is
    // the composition's (see `pd27-web-offer-row.mjs`).
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    mcpServers: [],
    mcpServer: null,
  }
  // ── the ONE composition adaptation, disclosed ────────────────────────────
  // The shipped preset names its network row `dsh-agent-team/web-tool`, a
  // subpath export of THIS repository's root package. A real install has that
  // package in the profile's node_modules (that is how the shipped root row
  // `dsh-agent-team/host` resolves); the pinned test tree does not — its
  // node_modules carries `@deepseek-ai/*` only. So, exactly as this driver
  // rewrites the host row to a file URL, it points the SAME module at its file
  // URL inside the preset. Nothing is swapped: the module, its config and its
  // id are the shipped ones, and `preset-effective.json` records the rewrite so
  // a reader can see it without reading this code.
  const WEB_ROW_ID = 'tool-web'
  const WEB_ROW_NAME = 'dsh-agent-team/web-tool'
  const webModuleUrl = pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'confined-web-tool.mjs')).href
  const presetPlugins = Array.isArray(presetRow.config?.plugins) ? presetRow.config.plugins : []
  const rewrites = []
  const effectivePlugins = presetPlugins.map((row) => {
    if (row?.group === true) return row
    if (row?.id !== WEB_ROW_ID || row?.name !== WEB_ROW_NAME) return row
    rewrites.push({ id: WEB_ROW_ID, shipped: WEB_ROW_NAME, effective: webModuleUrl })
    return { ...row, name: webModuleUrl }
  })
  const effectivePreset = { ...presetRow.config, plugins: effectivePlugins }
  // The pre-fix composition (the lane's base commit) carries NO such row: that
  // absence is the defect this pair measures, so zero rewrites is expected
  // there and only there.
  if (rewrites.length > 1) throw new Error(`the preset must carry at most ONE '${WEB_ROW_ID}' row named '${WEB_ROW_NAME}' (found ${String(rewrites.length)})`)
  if (rewrites.length === 0 && ARM !== 'prefix') throw new Error(`the shipped preset lost its '${WEB_ROW_ID}' row`)

  return {
    counterPath,
    hostWebCounterPath,
    rewrites,
    effectivePreset,
    rows: [
      {
        id: 'dsh-agent-team',
        name: pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')).href,
        config,
      },
      { id: 'preset-a5sf-governed-member', name: '@deepseek-ai/dsh-agent-preset', config: effectivePreset },
      {
        id: 'a5sf-pd27-web-offer',
        name: pathToFileURL(join(HERE, 'pd27-web-offer-row.mjs')).href,
        config: {
          allowRoot: home,
          counterPath,
          hostWebCounterPath,
          bindingIdentity: 'team/web/pd27',
          networkDenyTemplates: ['webworker-deny'],
          targetBase,
        },
      },
      { id: 'p6t6-team-tools', name: pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href },
    ],
  }
}

function makeDecide({ workspaceDir, targetBase }) {
  const call = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf pd27 session' }

    if (isARequest(req)) {
      const seen = resultIdsOf(req)
      // The request under measurement. On the deny arm the SAME URL is issued
      // against a transport that WOULD connect (the offer row's provider), so a
      // refusal is the face's admission decision, not a 404.
      if (!seen.has(CALL_FETCH)) {
        return call(CALL_FETCH, 'web_fetch', { url: `${targetBase}${ARM === 'deny' ? DENY_PATH : KNOWN_PATH}` })
      }
      // The second restored name, dispatched once. Its own refusal shape is not
      // the subject; its PRESENCE on the surface is.
      if (!seen.has(CALL_SEARCH)) return call(CALL_SEARCH, 'web_search', { query: 'a5sf-pd27 surface probe', maxResults: 1 })
      // Names an earlier lane closed stay typed `unknown tool`.
      if (!seen.has(CALL_CLOSED_WORKFLOW)) return call(CALL_CLOSED_WORKFLOW, 'workflow', {})
      if (!seen.has(CALL_CLOSED_RUNCODE)) return call(CALL_CLOSED_RUNCODE, 'run_code', {})
      return { kind: 'text', content: `${DONE_A} ${lastToolResultText(req).slice(0, 300)}` }
    }

    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_PD27_DISC_DONE' }
    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1)
    if (isLeader) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_DELEGATE_A)) {
        return call(CALL_DELEGATE_A, 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_A}-delegate`,
          delegationTemplateId: TEMPLATE,
          label: 'a5sfpd27-worker-a',
          workspace: workspaceDir,
          prompt: `${TOK_A}: run the probes exactly once each, one tool call at a time, then report.`,
        })
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_PD27_NOOP' }
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
/**
 * ALLOW — the lane says allow, the transport is real, the body comes back
 * VERBATIM. Four independent counters must agree: the model received the bytes,
 * the guard recorded exactly ONE allow fact, the LOCAL SERVER counted exactly
 * one request on the declared path, and the inherited host `web` was never
 * consulted.
 */
function judgeAllow({ fetch, facts, server, hostWebCalls, surface }) {
  const text = resultText(fetch)
  return verdictOf(
    'on the allow lane a governed Member reaches the declared HTTP endpoint through its CONFINED `web` face: the server body returns VERBATIM, exactly ONE allow fact names the declared URL, the local server counts exactly ONE request, and the inherited unconfined host transport is never consulted',
    [
      { id: 'call-succeeded', ok: isErrorResult(fetch) === false, detail: `isError=${String(isErrorResult(fetch))} text=${text.slice(0, 200)}` },
      { id: 'body-verbatim', ok: text.includes(KNOWN_BODY), detail: `result carries the server body: ${String(text.includes(KNOWN_BODY))}` },
      { id: 'http-200-presented', ok: /HTTP 200/u.test(text), detail: `host presentation present: ${String(/HTTP 200/u.test(text))}` },
      { id: 'one-allow-fact', ok: facts.length === 1 && facts[0]?.decision === 'allow' && String(facts[0]?.method ?? '') === 'web:fetch', detail: `facts=${JSON.stringify(facts.map((f) => [f.method, f.decision, f.decidedBy, f.locator]))}` },
      { id: 'fact-names-declared-url', ok: String(facts[0]?.locator ?? '').includes(KNOWN_PATH), detail: `locator=${String(facts[0]?.locator ?? '<none>')}` },
      { id: 'server-saw-one-request', ok: server.pathHits?.[KNOWN_PATH] === 1, detail: `pathHits=${JSON.stringify(server.pathHits)} connections=${String(server.connections)}` },
      { id: 'no-inherited-transport', ok: hostWebCalls === 0, detail: `host web calls=${String(hostWebCalls)}` },
      { id: 'surface-restored', ok: WEB_TOOL_NAMES.every((n) => surface.includes(n)), detail: `surface=${JSON.stringify(surface)}` },
    ],
  )
}

/**
 * DENY — the SAME face, the SAME reachable transport, the lane says deny. Not
 * one byte may leave: the local server's OWN connection counter is the
 * measurement, and it must read ZERO while exactly one typed deny fact exists.
 */
function judgeDeny({ fetch, facts, server, hostWebCalls, surface }) {
  const text = resultText(fetch)
  return verdictOf(
    'on the deny lane the SAME reachable transport is refused BEFORE the provider: the call is a typed NETWORK_UNCONFINED_REALM, the local server counts ZERO connections, the inherited host transport is never consulted, and exactly ONE deny fact records the decision',
    [
      { id: 'call-refused', ok: isErrorResult(fetch) === true, detail: `isError=${String(isErrorResult(fetch))}` },
      { id: 'typed-refusal', ok: /NETWORK_UNCONFINED_REALM|network=deny/u.test(text), detail: `text=${text.slice(0, 240)}` },
      { id: 'zero-connections', ok: server.connections === 0 && (server.requests ?? []).length === 0, detail: `connections=${String(server.connections)} requests=${JSON.stringify(server.requests ?? [])}` },
      { id: 'one-deny-fact', ok: facts.length === 1 && facts[0]?.decision === 'deny', detail: `facts=${JSON.stringify(facts.map((f) => [f.method, f.decision, f.decidedBy]))}` },
      { id: 'fact-carries-the-code', ok: String(facts[0]?.decidedBy ?? '') === 'NETWORK_UNCONFINED_REALM', detail: `decidedBy=${String(facts[0]?.decidedBy ?? '<none>')}` },
      { id: 'no-inherited-transport', ok: hostWebCalls === 0, detail: `host web calls=${String(hostWebCalls)}` },
      { id: 'surface-restored', ok: WEB_TOOL_NAMES.every((n) => surface.includes(n)), detail: `surface=${JSON.stringify(surface)}` },
    ],
  )
}

/** PRE-FIX: the names are not on the preset at all — typed `unknown tool`. */
function judgePrefix({ fetch, facts, server }) {
  return verdictOf(
    'PRE-FIX (defect): the governed preset offers no network pair, so `web_fetch` is the host router\'s typed `unknown tool`, zero facts are recorded and the local server counts ZERO connections — fail-closed, not confined',
    [
      { id: 'typed-unknown', ok: typedUnknown(fetch, 'web_fetch'), detail: `text=${resultText(fetch).slice(0, 160)}` },
      { id: 'zero-facts', ok: facts.length === 0, detail: `facts=${String(facts.length)}` },
      { id: 'zero-connections', ok: server.connections === 0, detail: `connections=${String(server.connections)}` },
    ],
  )
}

/** Names an earlier lane closed stay typed `unknown tool` in EVERY arm. */
function judgeClosed({ workflow, runCode, facts }) {
  return verdictOf(
    'the names PD-18 closed remain the router\'s typed `unknown tool` and produce no facts: restoring the network pair did not reopen the workflow surface',
    [
      { id: 'workflow-unknown', ok: typedUnknown(workflow, 'workflow'), detail: `text=${resultText(workflow).slice(0, 120)}` },
      { id: 'run-code-unknown', ok: typedUnknown(runCode, 'run_code'), detail: `text=${resultText(runCode).slice(0, 120)}` },
      { id: 'closed-names-no-facts', ok: facts.length === 0, detail: `closed-name facts=${String(facts.length)}` },
    ],
  )
}

function firstUserText(req) {
  const first = messagesOf(req).find((m) => m?.role === 'user')
  if (first === undefined) return ''
  return typeof first.content === 'string' ? first.content : JSON.stringify(first.content ?? '')
}
function isARequest(req) {
  const text = firstUserText(req)
  return text.includes('[team-work ') && text.includes(TOK_A)
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
async function remoteCallLong(fetchJson, origin, cookie, method, params, tag = 'a5sfpd27', timeoutMs = 300_000) {
  const rpcId = `${tag}-${Math.random().toString(36).slice(2, 12)}`
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { version: 1, params } }),
  }, timeoutMs)
}

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
  const phase = `a5sf-pd27-web-egress-${ARM}-boot${String(index)}`
  const runId = `a5sf-pd27-web-egress-${ARM}-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-pd27-web-egress', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, authorization), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-pd27-web-egress', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const slot = acquireDevLiveSlot({
    leaseRoot: factory.leaseRoot,
    runId: String(record.record.runId),
    face: 'WebEgress',
    world: LINE,
    headCommit: head,
  })
  log(`[boot${String(index)}] dev-live slot #${String(slot.slot)} face=WebEgress world=${LINE} head=${head}`)

  let world = null
  let bootInfo = null
  let teardown = null
  let failure = null
  let abortStage = 'pre-boot'
  let paths = null
  let counterPath = join(EVIDENCE, 'unused-counters.jsonl')
  let hostWebCounterPath = join(EVIDENCE, 'unused-host-web.jsonl')
  let collectDiagnostics = () => ({})
  const counters = {}
  let result = null
  try {
    bootInfo = await (async () => {
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      log(`[boot${String(index)}] world=${world.id} home=${world.home}`)
      mkdirSync(join(world.home, 'blueprints'), { recursive: true })
      const workspace = world.workspaceDir
      writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2) + '\n')

      const anchor = anchorBlueprintYaml()
      writeFileSync(join(world.home, 'blueprints', 'anchor.yaml'), anchor)
      const composed = composedRows({ home: world.home, anchorYaml: anchor, layer, targetBase })
      writeFileSync(join(bootDir, 'preset-effective.json'), JSON.stringify({
        note: 'the ONE composition adaptation: the shipped row name is a subpath export of the repo root package, which the pinned test tree does not install; the same module is mounted by file URL',
        rewrites: composed.rewrites,
        shippedRowPresent: composed.rewrites.length > 0,
      }, null, 2) + '\n')
      world.u6Fs.rows.push(...composed.rows)
      targetBase = composed.targetBase ?? targetBase
      counterPath = composed.counterPath
      hostWebCounterPath = composed.hostWebCounterPath
      log(`[boot${String(index)}] rows: ${composed.rows.map((r) => r.id).join(',')}`)
      log(`[boot${String(index)}] target=${targetBase} counters=${counterPath}`)

      await world.startMock({ decide: makeDecide({ workspaceDir: world.workspaceDir, targetBase }) })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })()
    abortStage = 'composition'
    paths = {
      workspace: world.workspaceDir,
      sink: join(world.home, 'a5sf-consult.jsonl'),
      counters: counterPath,
      hostWebCalls: hostWebCounterPath,
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

    // The local server's counters are RESET here, after the Host is up, so the
    // only thing they can count is what this Member turn does.
    server.reset()
    const memberWindowFrom = new Date().toISOString()

    // ── discovery turn: the REAL surface the preset offers ─────────────────
    abortStage = 'discovery'
    await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfpd27')
    await waitFor(() => (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith('A5SF_PD27_DISC_DONE')), 60_000)
    const discRequest = (world.mock?.requests ?? []).filter((r) => surfaceNamesOf(r).length > 0).at(-1) ?? null
    const leaderSurface = discRequest === null ? [] : [...new Set(surfaceNamesOf(discRequest))].sort()
    log(`[boot${String(index)}] leader surface (${String(leaderSurface.length)}): ${leaderSurface.join(',')}`)
    writeFileSync(join(bootDir, 'leader-surface.json'), JSON.stringify({ at: new Date().toISOString(), tools: leaderSurface }, null, 2) + '\n')
    const mainText = mainBlueprintYaml({ workspace: world.workspaceDir })
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
      try { out.hostLogTail = redact(readFileSync(bootInfo.logPath, 'utf8').split('\n').slice(-160).join('\n')) } catch { out.hostLogTail = '<absent>' }
      try { out.guardFacts = parseJsonl(paths.sink) } catch { out.guardFacts = [] }
      out.server = server.snapshot()
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
    }, 'a5sfpd27')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`[boot${String(index)}] team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)

    const chainTimeoutMs = Number(process.env.A5SF_PD27_CHAIN_TIMEOUT_MS ?? 420_000)
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
    const memberA = memberOf(state, TEMPLATE)
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
      fetch: probe(CALL_FETCH),
      search: probe(CALL_SEARCH),
      workflow: probe(CALL_CLOSED_WORKFLOW),
      runCode: probe(CALL_CLOSED_RUNCODE),
    }
    writeFileSync(join(bootDir, 'member-probes.json'), JSON.stringify({
      schema: 'a5sf-pd27-web-egress/member-probes/1',
      at: new Date().toISOString(),
      note: 'every Member surface call and the result the Member actually received (durable session first, mock transcript fallback)',
      probes,
    }, null, 2) + '\n')

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
    const webFacts = factsAll.filter((f) => String(f?.tool ?? '') === 'web_fetch')
    const closedFacts = factsAll.filter((f) => ['workflow', 'run_code'].includes(String(f?.tool ?? '')))
    const fetchFacts = factsFor(CALL_FETCH)
    const serverNow = server.snapshot()
    writeFileSync(join(bootDir, 'server.json'), JSON.stringify(serverNow, null, 2) + '\n')
    const hostWebCalls = parseJsonl(paths.hostWebCalls).filter((r) => r?.leg === 'host-web-call').length
    writeFileSync(join(bootDir, 'host-web-calls.json'), JSON.stringify(parseJsonl(paths.hostWebCalls), null, 2) + '\n')

    counters.guardFacts = {
      allow: factsAll.filter((f) => f.decision === 'allow').length,
      deny: factsAll.filter((f) => f.decision === 'deny').length,
      webFetch: { total: webFacts.length, allow: webFacts.filter((f) => f.decision === 'allow').length, deny: webFacts.filter((f) => f.decision === 'deny').length },
    }
    counters.server = serverNow
    counters.hostWebCalls = hostWebCalls
    counters.mockRequests = requests.length
    counters.aModelRequests = requests.filter((r) => isARequest(r) && surfaceNamesOf(r).length > 0).length
    counters.surfaceACount = surfaceANames.length
    counters.surfaceANames = surfaceANames
    counters.membersAfter = members.length
    counters.memberTemplates = members.map((m) => String(m?.templateId ?? '')).sort()
    counters.memberWindow = { from: memberWindowFrom, to: memberWindowTo }
    counters.composition = { path: composition.path, sha256: composition.sha256, arm: ARM }
    counters.quiesced = quiesced
    counters.webNamesOnSurface = WEB_TOOL_NAMES.filter((n) => surfaceANames.includes(n))
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')

    // ── judges ─────────────────────────────────────────────────────────────
    const verdicts = {
      allow: judgeAllow({ fetch: probes.fetch, facts: fetchFacts, server: serverNow, hostWebCalls, surface: surfaceANames }),
      deny: judgeDeny({ fetch: probes.fetch, facts: fetchFacts, server: serverNow, hostWebCalls, surface: surfaceANames }),
      prefix: judgePrefix({ fetch: probes.fetch, facts: fetchFacts, server: serverNow }),
      closed: judgeClosed({ workflow: probes.workflow, runCode: probes.runCode, facts: closedFacts }),
    }
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}${verdict === 'PROVEN' ? '' : ` failed=${JSON.stringify(detail?.failed ?? [])}`}`)
    }
    if (ARM === 'deny') add('pd27:web-deny', verdicts.deny.verdict, verdicts.deny)
    else if (ARM === 'prefix') add('pd27:web-prefix', verdicts.prefix.verdict, verdicts.prefix)
    else add('pd27:web-allow', verdicts.allow.verdict, verdicts.allow)
    add('pd27:closed-still-typed', verdicts.closed.verdict, verdicts.closed)
    // The pre-fix arm asserts the OPPOSITE: the names are absent, which is the
    // defect (a capability removed, not confined). Post-fix both must be there.
    const surfaceOk = ARM === 'prefix'
      ? WEB_TOOL_NAMES.every((n) => surfaceANames.includes(n)) === false
      : WEB_TOOL_NAMES.every((n) => surfaceANames.includes(n))
    add('pd27:web-surface', surfaceOk ? 'PROVEN' : 'REFUTED', {
      proposition: ARM === 'prefix'
        ? 'PRE-FIX the network pair is ABSENT from the Member\'s surface: the capability this lane restores is not declared at all'
        : 'both restored names are on the Member\'s surface, so the arm above is dispatched through a real declaration and not a stub',
      failed: surfaceOk ? [] : [`surface=${JSON.stringify(surfaceANames)} (arm=${ARM})`],
      clauses: [{ id: ARM === 'prefix' ? 'both-names-absent' : 'both-names-present', ok: surfaceOk, detail: `surface=${JSON.stringify(surfaceANames)}` }],
    })
    add('pd27:no-base-transport', hostWebCalls === 0 ? 'PROVEN' : 'REFUTED', {
      proposition: 'the inherited unconfined host `web` service is never consulted in either arm (its prototype is instrumented read-only and counts zero calls)',
      failed: hostWebCalls === 0 ? [] : [`host web calls=${String(hostWebCalls)}`],
      clauses: [{ id: 'zero-host-web-calls', ok: hostWebCalls === 0, detail: `calls=${String(hostWebCalls)}` }],
    })

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


/** A rerun of the same arm must never overwrite the last measured pair. */
function archivePriorRuns() {
  if (!existsSync(RUNS)) return null
  const existing = readdirSync(RUNS).filter((entry) => /^boot\d\d$/u.test(entry))
  if (existing.length === 0) return null
  const target = join(EVIDENCE, 'archive', `${ARM}-${utcStamp()}`)
  mkdirSync(dirname(target), { recursive: true })
  renameSync(RUNS, target)
  return target
}

function buildAgreement(results) {
  const ok = results.filter((r) => r?.failed !== true)
  const pick = (r) => ({
    arm: r?.arm ?? null,
    overall: r?.overall ?? null,
    allowVerdict: ARM === 'allow' ? r?.verdicts?.allow?.verdict ?? null : 'n/a',
    denyVerdict: ARM === 'deny' ? r?.verdicts?.deny?.verdict ?? null : 'n/a',
    prefixVerdict: ARM === 'prefix' ? r?.verdicts?.prefix?.verdict ?? null : 'n/a',
    closedVerdict: r?.verdicts?.closed?.verdict ?? null,
    serverConnections: r?.counters?.server?.connections ?? null,
    serverPathHits: r?.counters?.server?.pathHits ?? null,
    guardFacts: r?.counters?.guardFacts ?? null,
    hostWebCalls: r?.counters?.hostWebCalls ?? null,
    surfaceCount: r?.counters?.surfaceACount ?? null,
    surface: r?.counters?.surfaceANames ?? null,
  })
  const rows = results.map((r) => pick(r))
  rows.forEach((row, i) => { row.boot = results[i]?.boot ?? i + 1 })
  const sig = (r) => JSON.stringify([r.overall, r.serverConnections, r.serverPathHits, r.guardFacts, r.hostWebCalls, r.surfaceCount])
  const agreeing = rows.length === 2 && sig(rows[0]) === sig(rows[1])
  const header = ['boot', 'overall', 'arm', 'allow', 'deny', 'prefix', 'closed', 'connections', 'pathHits', 'webFacts', 'hostWebCalls', 'surface']
  const lines = [header.join(' | ')]
  for (const r of rows) {
    lines.push([
      `boot${String(r.boot)}`, r.overall, r.arm, r.allowVerdict, r.denyVerdict, r.prefixVerdict, r.closedVerdict,
      String(r.serverConnections), JSON.stringify(r.serverPathHits), JSON.stringify(r.guardFacts?.webFetch ?? null),
      String(r.hostWebCalls), String(r.surfaceCount),
    ].join(' | '))
  }
  const table = [`AGREEMENT arm=${ARM}: ${agreeing ? 'two boots agree on every measured counter' : 'BOOTS DISAGREE (or fewer than two)'}`, ...lines].join('\n')
  return { arm: ARM, agreeing, rows, table, note: 'two boots must agree on connections, path hits, fact counts, host-web calls and the surface size; the verdict names are compared too' }
}

function planOnly() {
  const layer = shippedLayer()
  const home = join(EVIDENCE, 'plan-home')
  const composed = composedRows({ home, anchorYaml: anchorBlueprintYaml(), layer, targetBase: 'http://127.0.0.1:9' })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-pd27-web-egress plan (no World)'], composed.rows) + '\n')
  const plugins = presetPluginIds(layer)
  log(`rows: ${JSON.stringify(composed.rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 110) })))}`)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-fs-search', 'tool-web']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  for (const forbidden of ['tool-workflow', 'workflow-ptc', 'tool-pwsh']) {
    if (plugins.includes(forbidden)) throw new Error(`the shipped governed preset unexpectedly carries '${forbidden}'`)
  }
  const presetRow = layer.rows.find((r) => r?.config?.id === PRESET_ID)
  const web = presetRow.config.plugins.find((r) => r.id === 'tool-web')
  if (web === undefined || web.name !== 'dsh-agent-team/web-tool') throw new Error('tool-web is not served by the fail-closed Team module')
  assertBlueprintText(anchorBlueprintYaml(), BP_ANCHOR_ID, 'anchor.yaml')
  assertBlueprintText(mainBlueprintYaml({ workspace: join(EVIDENCE, 'plan-workspace') }), BP_MAIN_ID, 'main.yaml')
  log('PLAN OK')
}


/** `--recompute`: rebuild agreement.{json,txt} from the boot artefacts on disk. */
function recomputeAgreement() {
  const boots = existsSync(RUNS) ? readdirSync(RUNS).filter((e) => /^boot\d\d$/u.test(e)).sort() : []
  if (boots.length === 0) throw new Error(`no boot artefacts under ${RUNS}`)
  const results = boots.map((dir, i) => {
    const counters = JSON.parse(readFileSync(join(RUNS, dir, 'counters.json'), 'utf8'))
    const record = JSON.parse(readFileSync(join(RUNS, dir, 'run-record.json'), 'utf8'))
    const verdictOfCase = (id) => (record.cases ?? []).find((c) => c.id === id)?.verdict === 'PASS' ? 'PROVEN' : 'REFUTED'
    return {
      boot: counters.boot ?? i + 1,
      arm: ARM,
      overall: record.overall,
      counters,
      verdicts: {
        allow: { verdict: verdictOfCase('pd27:web-allow') },
        deny: { verdict: verdictOfCase('pd27:web-deny') },
        prefix: { verdict: verdictOfCase('pd27:web-prefix') },
        closed: { verdict: verdictOfCase('pd27:closed-still-typed') },
      },
    }
  })
  const agreement = buildAgreement(results)
  writeFileSync(join(RUNS, 'agreement.json'), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(RUNS, 'agreement.txt'), agreement.table + '\n')
  writeFileSync(join(EVIDENCE, `agreement-${ARM}.json`), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(EVIDENCE, `agreement-${ARM}.txt`), agreement.table + '\n')
  return agreement
}

async function main() {
  mkdirSync(EVIDENCE, { recursive: true })
  RUN_LOG = join(EVIDENCE, 'driver.log')
  if (PLAN_ONLY) { planOnly(); return }
  if (argv.includes('--recompute')) { const a = recomputeAgreement(); log(a.table); return }
  mkdirSync(RUNS, { recursive: true })

  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the start cannot be bound')
  const layer = shippedLayer()
  const composition = { path: COMPOSITION_PATH, sha256: sha256(COMPOSITION_PATH), arm: ARM }
  const authorization = {
    scope: 'DEV-LIVE', face: 'WebEgress', world: LINE,
    source: `task PD27-WEB-EGRESS explicit boot authorisation (2026-11-14), arm=${ARM}`,
  }
  const archived = ARM === 'prefix' ? null : archivePriorRuns()
  log(`ARCHIVE: ${archived === null ? '(nothing to archive)' : archived}`)
  writeFileSync(join(EVIDENCE, `driver-digest-${ARM}.json`), JSON.stringify({
    at: startedAt, arm: ARM, head, hostTree: HOST_TREE, hostSha: hostDigest(), pin: TEST_USE_BASELINE_SHA,
    driverSha256: sha256(fileURLToPath(import.meta.url)), jsSubstitutions: layer.jsSubstitutions,
    composition, authorization,
    command: `node tests/world-factory/drivers/a5sf-pd27-web-egress/run-boot.mjs --arm ${ARM}${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
  }, null, 2) + '\n')
  server = makeLocalServer()
  targetBase = await server.start()
  log(`LOCAL SERVER ${targetBase} (the arm's ground truth: it serves '${KNOWN_BODY}' on ${KNOWN_PATH} and ${DENY_PATH})`)
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

  try { await server.stop() } catch (error) { log(`server stop failed: ${String(error?.message ?? error)}`) }
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
