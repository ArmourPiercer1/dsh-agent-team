#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs — the LIVE
 * driver for PD-31: can a governed Member actually READ AN IMAGE today, and
 * under what condition can it not?
 *
 * WHY THIS FILE EXISTS. PD-24's surface ledger walked the whole Member roster
 * and measured `read_image` refused at the MODEL ROUTE gate before any byte was
 * read: `model "deepseek-v4-flash" does not declare image input`. That made
 * `read_image` the one governed row whose FACE was pinned host-free while its
 * LIVE branch stayed `UNMEASURED` — the ledger could not tell a capability gate
 * from a broken tool, because the test model was never declared image-capable.
 *
 * THE SEAM UNDER TEST (measured, not guessed). The pinned host ships a model
 * catalog whose `deepseek-flash` entry declares `inputModalities: ['text',
 * 'image']` (H:packages/llm/llm-deepseek/src/models.ts:8-14 @639ed01539). A
 * World points its Team row at any catalog id through the PUBLIC `staticModel`
 * config key (docs/INSTALL.md; the shipped composition uses
 * `deepseek-v4-flash`, which is uncatalogued and therefore resolves `['text']`).
 * The wire still goes to the leased scripted mock; no vision model is needed,
 * only the DECLARED modality. This driver changes that ONE public config value
 * and measures the real Host. No upstream source is patched.
 *
 * ONE COMMAND, TWO BOOTS (the agreeing pair), per arm:
 *
 *   node tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs
 *   A5SF_PD31_PIN=1 node tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs
 *
 * `--arm prefix` / `A5SF_PD31_PIN=1` boots the PRE-FIX state: the shipped
 * `staticModel` (`deepseek-v4-flash`, no image declaration). Every image call
 * must be the route gate's refusal with ZERO provider I/O and ZERO facts.
 *
 * `--mutation model-text` re-runs the POST-FIX composition with the model
 * declaration taken back to `['text']`: the allow arm must go RED and reproduce
 * the same refusal. `--mutation route-gate-off` temporarily REMOVES the
 * capability check from the `tool-fs` module the Host ACTUALLY LOADS — the
 * repo's installed `node_modules/.pnpm/@deepseek-ai+dsh-tool-fs@…/lib/index.js`,
 * resolved by `require.resolve`, NOT the pinned source checkout (the first
 * attempt edited that checkout and changed nothing, which is disclosed in the
 * evidence) — restores it byte-identically in `finally`, and verifies both the
 * restored sha and that the untouched pinned source still has its own. The
 * allow arm must then go GREEN on a text-only route, which is what proves the
 * gate — not the fixture — is the refusing element.
 *
 * `--plan` is host-free (row/blueprint/preset validation, zero boots).
 * `--boots 1` is a development iteration.
 *
 * WHAT THE FIRST BOOTS MEASURED (written down before the recorded pair, so
 * the record cannot be read as a post-hoc story): the allow arm returns the
 * fixture envelope plus a real image block, and consults the guard TWICE —
 * `stat` then `readBytes` — both `allow`, both naming `tool=read_image` and the
 * call's own `callId` (the task brief said "exactly 1 allow fact"; the measured
 * count is 2 and this driver asserts 2, not 1). The same bytes then reach the
 * wire as an image content part; with a text-only route declared the product
 * projects them to `[image omitted because this model accepts text only; …]`.
 * The out-of-lane arm is refused with the lane's own sentence (`authored locator
 * '…' is outside every allow subtree of the lane`) and the typed code
 * `IO_READ_DENIED` is carried by the FACT's `decidedBy`, not by that sentence.
 * The over-dimension fixture is refused by the STORE (`Image exceeds the
 * configured per-side pixel limit.`), the over-byte one by the base read
 * (`… 20971521 bytes exceeds the 20971520-byte limit`); neither is truncated.
 *
 * WHAT IS FIXTURE (disclosed): the model is the shared scripted mock
 * (`packages/tools/harness/mock-deepseek.mjs`); the PNG/GIF fixtures, the
 * in-lane text, the out-of-lane secret and the over-limit images are World
 * files the driver writes. The product path is real: the shipped
 * `cordis.patch.yml` host row + governed preset, the realm provider/compiler,
 * the confined `fs` provider + guard sink, the route-C attach, the pinned host
 * `@deepseek-ai/dsh-tool-fs` `read_image` implementation, the host attachment
 * store, the host llm catalog and the host router.
 *
 * Boot evidence is NEVER merge evidence: record class `DEV-LIVE`,
 * `candidateClaimEligibility` false by construction.
 *
 * CORE PATCH BUDGET = 0. No upstream tree is left touched.
 *
 * @module tests/world-factory/drivers/a5sf-pd31-read-image/run-boot
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { deflateSync, zstdDecompressSync } from 'node:zlib'

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
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd31-read-image')
const RUNS_POSTFIX = join(EVIDENCE, 'runs')
const RUNS_PREFIX = join(EVIDENCE, 'archive', 'pair-prefix')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')

const LINE = 'u5a5sfpd31'
const BOOT_ROOT = 'session-a5sf-pd31-boot'
const ACCEPTANCE_ROOT = 'session-a5sf-pd31-team'
const BP_ANCHOR_ID = 'team.a5sf.pd31.anchor'
const BP_MAIN_ID = 'team.a5sf.pd31.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'A5SF_PD31_DISC'
const MK_L1 = 'A5SF_PD31_L1_DRIVE'
const TOK_A = 'a5sf-pd31-turn'
const CALL_READ = 'call-a5sfpd31-read'
const CALL_IMAGE_IN = 'call-a5sfpd31-image-in'
const CALL_IMAGE_OUT = 'call-a5sfpd31-image-out'
const CALL_IMAGE_MISSING = 'call-a5sfpd31-image-missing'
const CALL_IMAGE_TXT = 'call-a5sfpd31-image-txt'
const CALL_IMAGE_BIG_DIM = 'call-a5sfpd31-image-big-dim'
const CALL_IMAGE_BIG_BYTES = 'call-a5sfpd31-image-big-bytes'
const DONE_A = 'A5SF_PD31_MEMBER_A_DONE'
const DONE_L1 = 'A5SF_PD31_L1_DONE'

/** The catalog id that DECLARES image input on the pinned host generation. */
const IMAGE_CAPABLE_MODEL = 'deepseek-flash'
/** The shipped preset id; uncatalogued, so the route resolves `['text']`. */
const TEXT_ONLY_MODEL = 'deepseek-v4-flash'
const MODEL_PROVIDER = 'deepseek-official'

const IN_LANE_FILE = 'in-lane.txt'
const IN_LANE_TEXT = 'A5SF_PD31_IN_LANE_BYTES'
const NON_IMAGE_FILE = 'notes.txt'
const NON_IMAGE_TEXT = 'A5SF_PD31_NOT_AN_IMAGE'
const IMAGE_FILE = 'probe.png'
const SECRET_FILE = 'secret-out-of-lane.png'
const MISSING_OUT_OF_LANE = 'does-not-exist-out-of-lane.png'
const BIG_DIM_FILE = 'over-dimension.png'
const BIG_BYTES_FILE = 'over-byte-cap.png'
/** Declared size of the over-dimension PNG (the store's per-side law is 8192). */
const BIG_DIM_WIDTH = 9000
const BIG_DIM_HEIGHT = 1
/**
 * The store's own pinned laws (H:packages/attachment/attachment-local/src/
 * index.ts:34-42 @639ed01539): 20 MiB bytes, 64 000 000 decoded pixels,
 * 8192 px per side. The fixtures are built against those numbers, and the
 * driver also READS them from the host when it can, so a baseline move reds.
 */
const STORE_MAX_BYTES = 20 * 1024 * 1024
const STORE_MAX_DIMENSION = 8192
const STORE_MAX_PIXELS = 64_000_000

const SELECTED_CASES = Object.freeze([
  'pd31:image-route-allow',
  'pd31:image-bytes-and-attachment',
  'pd31:lane-deny-no-existence-oracle',
  'pd31:non-image-native-shape',
  'pd31:over-limit-refused-whole',
  'pd31:image-block-not-text',
  'pd31:surface-and-control',
])

const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
const ARM = (() => {
  const i = argv.indexOf('--arm')
  if (i === -1) return process.env.A5SF_PD31_PIN === '1' ? 'prefix' : 'postfix'
  const value = argv[i + 1]
  if (value !== 'postfix' && value !== 'prefix') throw new Error(`--arm must be 'postfix' or 'prefix' (got ${String(value)})`)
  return value
})()
const MUTATION = (() => {
  const i = argv.indexOf('--mutation')
  if (i === -1) return 'none'
  const value = argv[i + 1]
  if (value !== 'model-text' && value !== 'route-gate-off') {
    throw new Error(`--mutation must be 'model-text' or 'route-gate-off' (got ${String(value)})`)
  }
  return value
})()
// Mutation controls are their own archived directory: they are single-boot
// probes, and letting them reuse `runs/` would move the agreeing pair aside.
const RUNS = MUTATION !== 'none'
  ? join(EVIDENCE, 'archive', `mutation-${MUTATION}`)
  : ARM === 'prefix' ? RUNS_PREFIX : RUNS_POSTFIX
const COMPOSITION_PATH = process.env.A5SF_PD31_COMPOSITION === undefined || process.env.A5SF_PD31_COMPOSITION === ''
  ? join(REPO_ROOT, 'cordis.patch.yml')
  : resolve(process.env.A5SF_PD31_COMPOSITION)
const BOOTS_WANTED = (() => {
  const i = argv.indexOf('--boots')
  if (i === -1) return 2
  const n = Number(argv[i + 1])
  if (!Number.isInteger(n) || n < 1 || n > 2) throw new Error(`--boots must be 1 or 2 (got ${String(argv[i + 1])})`)
  return n
})()

/** The model declaration this arm carries through the PUBLIC `staticModel` key. */
const MODEL_ID = ARM === 'prefix' || MUTATION === 'model-text' || MUTATION === 'route-gate-off'
  ? TEXT_ONLY_MODEL
  : IMAGE_CAPABLE_MODEL
/** The allow arm's expected outcome (mutations deliberately move it). */
const EXPECT_ALLOW = MUTATION === 'route-gate-off' ? true : ARM === 'postfix' && MUTATION === 'none'
const ARM_TAG = MUTATION === 'none' ? ARM : `${ARM}-${MUTATION}`

const startedAt = new Date().toISOString()
let RUN_LOG = join(EVIDENCE, 'driver.log')
function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  // eslint-disable-next-line no-console
  console.log(text)
  try { appendFileSync(RUN_LOG, `${text}\n`) } catch { /* evidence is best effort; stdout is not */ }
}
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const sha256Bytes = (b) => createHash('sha256').update(b).digest('hex')
const parseJsonl = (p) => {
  try { return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)) } catch { return [] }
}
const redact = (t) => String(t ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const utcStamp = () => new Date().toISOString().replace(/[:.]/gu, '-')

function hostTreePath() {
  const candidates = [process.env.A5SF_PD31_HOST_TREE, join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')]
  const m = /^(.*)\/\.worktrees\/[^/]+$/u.exec(REPO_ROOT)
  if (m !== null) candidates.push(join(m[1], 'tests', 'deepseek-harness-test-use'))
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== '' && existsSync(candidate)) return candidate
  }
  throw new Error('the pinned host tree is not resolvable (set A5SF_PD31_HOST_TREE): a live boot needs it')
}
const HOST_TREE = hostTreePath()
const require_ = createRequire(join(REPO_ROOT, 'package.json'))

// ─────────────────────────────────────────────────────────────────────────────
// PNG fixtures — built here with zero image library (signature + IHDR + zlib
// IDAT + IEND). The raster is all-black, filter byte 0; every fixture is a
// REAL decodable PNG, so a refusal cannot be explained by a malformed fixture.
// ─────────────────────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length, 0)
  const typeBytes = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBytes, data])), 0)
  return Buffer.concat([len, typeBytes, data, crc])
}
/**
 * One valid RGB PNG of exactly `width` x `height` black pixels.
 * @param {number} width
 * @param {number} height
 * @returns {Buffer}
 */
function png(width, height) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour RGB
  ihdr[10] = 0 // compression
  ihdr[11] = 0 // filter
  ihdr[12] = 0 // interlace
  const row = Buffer.alloc(1 + width * 3)
  const raw = Buffer.concat(Array.from({ length: height }, () => row))
  const idat = deflateSync(raw)
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))])
}
/** The 20 MiB + 1 byte file: it starts as a PNG signature so the only law it
 * crosses is the store's BYTE cap (the cap check runs before the scan). */
function overByteCapPng() {
  const b = Buffer.alloc(STORE_MAX_BYTES + 1, 0)
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(b, 0)
  return b
}

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
    leader: { templateId: 'leader', persona: `You lead the a5sf PD-31 anchor team. ${MK_DISC} is the discovery marker.` },
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
 * in-lane image/text live under it, while `secret-out-of-lane.png` lives beside
 * the workspace (above the lane) and EXISTS on disk, so a base-fs read would
 * return its bytes.
 */
function mainBlueprintYaml({ workspace }) {
  const doc = {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateUrl: 'leader',
      templateId: 'leader',
      persona: `You lead the a5sf PD-31 image team. ${MK_L1} drives your chain: delegate the governed Member once (sync), then finish.`,
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
  delete doc.leader.templateUrl
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
    // PD-31: the ONE public seam under test. The shipped row says
    // `deepseek-v4-flash` (uncatalogued ⇒ resolves `['text']`); this World
    // declares the host catalog's image-capable id instead. No wire change:
    // the leased mock still answers, and no vision model is needed.
    staticModel: { provider: MODEL_PROVIDER, model: MODEL_ID },
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

async function remoteCallLong(fetchJson, origin, cookie, method, params, tag = 'a5sfpd31', timeoutMs = 300_000) {
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
/** The FULL result content (text + image blocks), not only its text. */
function toolResultBlocksFor(requests, callId) {
  for (const req of requests) {
    for (const message of messagesOf(req)) {
      if (!Array.isArray(message?.content)) continue
      for (const block of message.content) {
        if (block?.type !== 'tool_result' || String(block?.tool_use_id) !== String(callId)) continue
        const content = Array.isArray(block.content) ? block.content : []
        const text = content.map((c) => (typeof c?.text === 'string' ? c.text : '')).join('')
        return { source: 'model', isError: block.is_error === true, text, blocks: content }
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
 * The scripted model. One Member turn walks every probe once, in a fixed
 * order; a probe that ended the turn early would hide the rest, which is also
 * how "the turn kept going" is witnessed.
 */
function makeDecide({ workspaceDir }) {
  const call = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf pd31 session' }

    if (isARequest(req)) {
      const seen = resultIdsOf(req)
      // Positive control: a plain `read` on the same confined face must stay
      // live, so a red image arm cannot be explained by a dead realm.
      if (!seen.has(CALL_READ)) return call(CALL_READ, 'read', { file_path: join(workspaceDir, IN_LANE_FILE) })
      // ── the IMAGE arm ────────────────────────────────────────────────────
      if (!seen.has(CALL_IMAGE_IN)) return call(CALL_IMAGE_IN, 'read_image', { file_path: join(workspaceDir, IMAGE_FILE) })
      if (!seen.has(CALL_IMAGE_OUT)) return call(CALL_IMAGE_OUT, 'read_image', { file_path: join(dirname(workspaceDir), 'out-of-lane', SECRET_FILE) })
      if (!seen.has(CALL_IMAGE_MISSING)) return call(CALL_IMAGE_MISSING, 'read_image', { file_path: join(dirname(workspaceDir), 'out-of-lane', MISSING_OUT_OF_LANE) })
      if (!seen.has(CALL_IMAGE_TXT)) return call(CALL_IMAGE_TXT, 'read_image', { file_path: join(workspaceDir, NON_IMAGE_FILE) })
      if (!seen.has(CALL_IMAGE_BIG_DIM)) return call(CALL_IMAGE_BIG_DIM, 'read_image', { file_path: join(workspaceDir, BIG_DIM_FILE) })
      if (!seen.has(CALL_IMAGE_BIG_BYTES)) return call(CALL_IMAGE_BIG_BYTES, 'read_image', { file_path: join(workspaceDir, BIG_BYTES_FILE) })
      return { kind: 'text', content: `${DONE_A} ${lastToolResultText(req).slice(0, 300)}` }
    }

    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_PD31_DISC_DONE' }
    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1)
    if (isLeader) {
      const seen = resultIdsOf(req)
      if (!seen.has('call-a5sfpd31-delegate-a')) {
        return call('call-a5sfpd31-delegate-a', 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_A}-delegate`,
          delegationTemplateId: 'worker',
          label: 'a5sfpd31-worker-a',
          workspace: workspaceDir,
          prompt: `${TOK_A}: run the probes exactly once each, one tool call at a time, then report.`,
        })
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_PD31_NOOP' }
  }
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
  for (const row of lines) {
    const data = row?.data ?? row
    const type = row?.type ?? row?.kind ?? null
    if (type !== null) eventTypes[String(type)] = (eventTypes[String(type)] ?? 0) + 1
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
      // Keep the FULL blocks: the durable image block carries the attachment
      // reference (id/bytes/width/height/mediaType) that the model-facing wire
      // copy deliberately does not.
      const blocks = Array.isArray(body) ? body : []
      results.push({ callId, isError, text: contentText(body), blocks, at: row?.at ?? row?.time ?? null })
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
    out[id] = { file: entry.path, types }
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
/** Every content block, descending into a tool_result's nested content array. */
function flatBlocksOf(content) {
  const out = []
  for (const block of Array.isArray(content) ? content : []) {
    out.push(block)
    if (block?.type === 'tool_result' && Array.isArray(block.content)) out.push(...flatBlocksOf(block.content))
  }
  return out
}
/** A model request's image content parts, with the decoded byte digest. */
function imagePartsOfRequest(req) {
  const parts = []
  for (const message of messagesOf(req)) {
    if (!Array.isArray(message?.content)) continue
    for (const block of flatBlocksOf(message.content)) {
      if (block?.type !== 'image') continue
      const source = block.source ?? block.image_url ?? null
      const data = source?.type === 'base64' ? String(source.data ?? '') : null
      const url = typeof block.image_url?.url === 'string' ? block.image_url.url : null
      const base64 = data ?? (url !== null && url.startsWith('data:') ? url.slice(url.indexOf(',') + 1) : null)
      let bytes = null
      let digest = null
      if (base64 !== null) {
        try { bytes = Buffer.from(base64, 'base64'); digest = sha256Bytes(bytes) } catch { /* not base64 */ }
      }
      parts.push({
        role: message.role ?? null,
        blockType: 'image',
        sourceType: source?.type ?? (url === null ? null : 'data-url'),
        mediaType: source?.media_type ?? block.media_type ?? null,
        base64Chars: base64 === null ? 0 : base64.length,
        bytes: bytes === null ? null : bytes.length,
        sha256: digest,
      })
    }
  }
  return parts
}
/** Any TEXT block that embeds the image's base64 or its PNG signature bytes. */
function textBlocksCarryingImage(req, base64) {
  const hits = []
  for (const message of messagesOf(req)) {
    if (!Array.isArray(message?.content)) continue
    for (const block of message.content) {
      if (block?.type === 'tool_result' && Array.isArray(block.content)) {
        for (const inner of block.content) {
          if (inner?.type !== 'text' || typeof inner.text !== 'string') continue
          if ((base64 !== '' && inner.text.includes(base64.slice(0, 64))) || inner.text.includes('\u0089PNG')) hits.push({ role: message.role ?? null, where: 'tool_result/text' })
        }
        continue
      }
      if (block?.type !== 'text' || typeof block.text !== 'string') continue
      if ((base64 !== '' && block.text.includes(base64.slice(0, 64))) || block.text.includes('\u0089PNG')) hits.push({ role: message.role ?? null, where: 'text' })
    }
  }
  return hits
}

/**
 * The route gate arm.
 *   allow  — the in-lane PNG returns; the model request carries an image part
 *            whose decoded bytes are the fixture's exact bytes.
 *   refuse — the call is the route gate's own sentence, with ZERO provider I/O
 *            (zero facts) and ZERO attachment bytes.
 */
function judgeRoute({ expectAllow, imageIn, factsFor, requestImageParts, imageDigest, imageBytes, requests, requireImagePart = true }) {
  const inFacts = factsFor(CALL_IMAGE_IN)
  const text = resultText(imageIn)
  if (expectAllow) {
    if (!requireImagePart) {
      // Mutation control `route-gate-off`: the gate is gone but the route is
      // still TEXT-ONLY, so the product must serve the read and then project the
      // image to its text placeholder. Nothing about the image may reach a
      // text-only wire; the point is that the READ happened.
      const placeholder = /\[image omitted because this model accepts text only; attachment sha256:([0-9a-f]+)\]/u.exec(requests.map((r) => allToolResultText(r)).join('\n'))
      return verdictOf(
        'with the host capability gate removed and a TEXT-ONLY model, the read is SERVED (allow facts) and the product projects the image to the text-only placeholder instead of inlining it — which proves the gate, not the fixture, is what refuses the text-only arm',
        [
          { id: 'in-lane-not-refused', ok: isErrorResult(imageIn) === false, detail: `isError=${String(isErrorResult(imageIn))} text=${text.slice(0, 200)}` },
          { id: 'allow-facts-attributed', ok: inFacts.length === 2 && inFacts.every((f) => f.decision === 'allow' && String(f.tool ?? '') === 'read_image' && String(f.callId ?? '') === CALL_IMAGE_IN) && inFacts.map((f) => String(f.method)).join(',') === 'stat,readBytes', detail: `facts=${JSON.stringify(inFacts.map((f) => [f.method, f.decision, f.tool, f.callId]))}` },
          { id: 'no-image-on-a-text-wire', ok: requestImageParts.length === 0, detail: `image parts=${String(requestImageParts.length)} — a text-only route must never receive one` },
          { id: 'text-placeholder-present', ok: placeholder !== null && placeholder[1].startsWith(imageDigest.slice(0, 8)), detail: `placeholder=${String(placeholder?.[0] ?? '<absent>')}` },
        ],
      )
    }
    return verdictOf(
      'a governed Member on a model route that DECLARES image input reads a real in-lane PNG: the tool succeeds, the model request carries an IMAGE content part whose decoded bytes are the fixture bytes, and the read is recorded as allow facts attributed to `read_image`',
      [
        { id: 'in-lane-not-refused', ok: isErrorResult(imageIn) === false, detail: `isError=${String(isErrorResult(imageIn))} text=${text.slice(0, 200)}` },
        { id: 'image-part-in-request', ok: requestImageParts.length >= 1, detail: `image parts in any model request=${String(requestImageParts.length)}` },
        { id: 'image-part-is-the-file', ok: requestImageParts.some((p) => p.sha256 === imageDigest && p.bytes === imageBytes), detail: `parts=${JSON.stringify(requestImageParts.map((p) => ({ bytes: p.bytes, sha256: p.sha256 })))}` },
        { id: 'allow-facts-attributed', ok: inFacts.length === 2 && inFacts.every((f) => f.decision === 'allow' && String(f.tool ?? '') === 'read_image' && String(f.callId ?? '') === CALL_IMAGE_IN) && inFacts.map((f) => String(f.method)).join(',') === 'stat,readBytes', detail: `facts=${JSON.stringify(inFacts.map((f) => [f.method, f.decision, f.tool, f.callId]))} — MEASURED: 2 allow facts (stat then readBytes), not 1; the native body consults the guard once per provider method` },
        { id: 'no-deny-facts', ok: inFacts.filter((f) => f.decision !== 'allow').length === 0, detail: `non-allow facts=${String(inFacts.filter((f) => f.decision !== 'allow').length)}` },
      ],
    )
  }
  return verdictOf(
    'on a model route that does NOT declare image input, `read_image` is refused by the capability gate BEFORE any provider I/O: the refusal names the model and the remedy, and there are ZERO guard facts and ZERO attachment bytes',
    [
      { id: 'refused', ok: isErrorResult(imageIn) === true, detail: `isError=${String(isErrorResult(imageIn))} text=${text.slice(0, 240)}` },
      { id: 'names-the-model', ok: text.includes(TEXT_ONLY_MODEL), detail: `model named=${String(text.includes(TEXT_ONLY_MODEL))}` },
      { id: 'names-the-remedy', ok: /switch to an image-capable model/u.test(text), detail: `remedy present=${String(/switch to an image-capable model/u.test(text))}` },
      { id: 'zero-guard-facts', ok: inFacts.length === 0, detail: `facts=${JSON.stringify(inFacts.map((f) => [f.method, f.decision]))} — the gate precedes resolve/stat/readBytes` },
      { id: 'zero-image-parts', ok: requestImageParts.length === 0, detail: `image parts in any model request=${String(requestImageParts.length)}` },
    ],
  )
}

/** Bytes/dimensions of the successful attachment, cross-checked three ways. */
function judgeAttachment({ imageIn, requestImageParts, imageMeta, expectAllow, requireImagePart = true }) {
  const blocks = Array.isArray(imageIn?.blocks) ? imageIn.blocks : []
  const imageBlocks = blocks.filter((b) => b?.type === 'image')
  const envelope = resultText(imageIn)
  const ref = imageBlocks[0]?.attachment ?? null
  if (!expectAllow) {
    return verdictOf(
      'on a text-only route there is no attachment to inspect: the refusal produces ZERO image blocks and ZERO image parts, so no bytes are read, stored or sent',
      [
        { id: 'result-is-refusal', ok: isErrorResult(imageIn) === true, detail: `isError=${String(isErrorResult(imageIn))}` },
        { id: 'zero-image-blocks', ok: imageBlocks.length === 0, detail: `image blocks=${String(imageBlocks.length)}` },
        { id: 'zero-image-parts', ok: requestImageParts.length === 0, detail: `image parts=${String(requestImageParts.length)}` },
      ],
    )
  }
  return verdictOf(
    requireImagePart
      ? 'the allowed read is a REAL image, not a shell: the tool result is exactly ONE image block whose attachment metadata (bytes, width, height, media type, id) is the fixture, and the same bytes ride the model request as an image part'
      : 'with the gate removed on a text-only route the read is still real — exactly ONE image block with the fixture metadata — while the WIRE carries no image (the product projects it)',
    [
      { id: 'one-image-block', ok: imageBlocks.length === 1, detail: `image blocks=${String(imageBlocks.length)}` },
      { id: 'attachment-metadata', ok: ref !== null && Number(ref.bytes) === imageMeta.bytes && Number(ref.width) === imageMeta.width && Number(ref.height) === imageMeta.height && String(ref.mediaType) === 'image/png', detail: `ref=${JSON.stringify(ref)} want=${JSON.stringify(imageMeta)}` },
      { id: 'attachment-id-present', ok: typeof ref?.attachmentId === 'string' && ref.attachmentId === `sha256:${imageMeta.sha256}`, detail: `attachmentId=${String(ref?.attachmentId)} want=sha256:${imageMeta.sha256}` },
      { id: 'envelope-names-the-file', ok: envelope.includes(IMAGE_FILE) && envelope.includes('image/png'), detail: `text=${envelope.slice(0, 200)}` },
      ...requireImagePart
        ? [{ id: 'request-part-bytes-match', ok: requestImageParts.some((p) => p.bytes === imageMeta.bytes && p.sha256 === imageMeta.sha256), detail: `parts=${JSON.stringify(requestImageParts.map((p) => ({ bytes: p.bytes, sha256: p.sha256 })))}` }]
        : [{ id: 'request-part-absent', ok: requestImageParts.length === 0, detail: `parts=${String(requestImageParts.length)} (text-only wire)` }],
    ],
  )
}

/**
 * The lane arm: an out-of-lane path is refused at the FIRST guard consultation,
 * with ONE deny fact, ZERO bytes, and the SAME text for an existing and an
 * absent target (no existence oracle).
 */
function judgeLaneDeny({ imageOut, imageMissing, factsFor, secretDigest, secretPath, missingPath, requestImageParts, expectAllow }) {
  const outFacts = factsFor(CALL_IMAGE_OUT)
  const missingFacts = factsFor(CALL_IMAGE_MISSING)
  const outText = resultText(imageOut)
  const missingText = resultText(imageMissing)
  const norm = (t, p) => String(t).split(p).join('<PATH>')
  if (!expectAllow) {
    return verdictOf(
      'on a text-only route the capability gate runs BEFORE path resolution, so an out-of-lane target and an absent one are the SAME refusal with ZERO guard facts: the lane is never consulted and no existence is disclosed',
      [
        { id: 'out-of-lane-route-refusal', ok: isErrorResult(imageOut) && /does not declare image input/u.test(outText) && outFacts.length === 0, detail: `facts=${String(outFacts.length)} text=${outText.slice(0, 200)}` },
        { id: 'missing-route-refusal', ok: isErrorResult(imageMissing) && /does not declare image input/u.test(missingText) && missingFacts.length === 0, detail: `facts=${String(missingFacts.length)}` },
        { id: 'same-answer', ok: norm(outText, secretPath) === norm(missingText, missingPath), detail: `existing=${norm(outText, secretPath).slice(0, 200)} missing=${norm(missingText, missingPath).slice(0, 200)}` },
        { id: 'no-existence-oracle', ok: /not found|no such file/iu.test(outText) === false && /not found|no such file/iu.test(missingText) === false, detail: 'neither sentence says "not found"' },
      ],
    )
  }
  return verdictOf(
    'an out-of-lane image path is refused at the lane boundary: typed `IO_READ_DENIED`, exactly ONE deny fact, ZERO bytes, and the SAME answer for an existing and an absent target — the refusal never discloses existence',
    [
      { id: 'out-of-lane-refused', ok: isErrorResult(imageOut) && /outside every allow subtree of the lane/u.test(outText), detail: `isError=${String(isErrorResult(imageOut))} text=${outText.slice(0, 240)}` },
      { id: 'out-of-lane-one-deny-fact', ok: outFacts.length === 1 && outFacts[0]?.decision === 'deny' && String(outFacts[0]?.decidedBy ?? '') === 'IO_READ_DENIED', detail: `facts=${JSON.stringify(outFacts.map((f) => [f.method, f.decision, f.decidedBy]))} — the typed code lives in the FACT (decidedBy), not in the model-facing sentence` },
      { id: 'out-of-lane-attributed', ok: outFacts.every((f) => String(f.tool ?? '') === 'read_image' && String(f.callId ?? '') === CALL_IMAGE_OUT), detail: `tools=${JSON.stringify(outFacts.map((f) => [f.tool, f.callId]))}` },
      { id: 'out-of-lane-zero-bytes', ok: requestImageParts.every((p) => p.sha256 !== secretDigest) && !outText.includes('PNG'), detail: `image parts carrying the out-of-lane bytes=${String(requestImageParts.filter((p) => p.sha256 === secretDigest).length)}` },
      { id: 'missing-same-refusal', ok: isErrorResult(imageMissing) && /outside every allow subtree of the lane/u.test(missingText) && missingFacts.length === 1 && missingFacts[0]?.decidedBy === 'IO_READ_DENIED', detail: `facts=${JSON.stringify(missingFacts.map((f) => [f.method, f.decision, f.decidedBy]))} text=${missingText.slice(0, 240)}` },
      { id: 'no-existence-oracle', ok: norm(outText, secretPath) === norm(missingText, missingPath), detail: `existing(normalised)=${norm(outText, secretPath).slice(0, 220)} missing(normalised)=${norm(missingText, missingPath).slice(0, 220)}` },
      { id: 'no-not-found', ok: /not found|no such file/iu.test(outText) === false && /not found|no such file/iu.test(missingText) === false, detail: 'neither refusal says "not found"' },
    ],
  )
}

/** `.txt` under `read_image`: the native extension law, before any I/O. */
function judgeNonImage({ imageTxt, factsFor, requestImageParts, imageMeta }) {
  const text = resultText(imageTxt)
  const facts = factsFor(CALL_IMAGE_TXT)
  return verdictOf(
    'a `.txt` file is refused by the tool\'s own EXTENSION law before any fs I/O or attachment write — a typed refusal, not a crash, and it does not depend on the model route',
    [
      { id: 'refused', ok: isErrorResult(imageTxt) === true, detail: `isError=${String(isErrorResult(imageTxt))}` },
      { id: 'extension-law', ok: /does not declare a supported image format/u.test(text), detail: `text=${text.slice(0, 240)}` },
      { id: 'zero-facts', ok: facts.length === 0, detail: `facts=${String(facts.length)}` },
      { id: 'no-attachment', ok: requestImageParts.every((p) => p.sha256 === imageMeta.sha256), detail: `image parts=${JSON.stringify(requestImageParts.map((p) => p.sha256))} — the only image in flight is the in-lane fixture; the .txt produced none` },
    ],
  )
}

/** The over-limit arms: refused WHOLE, never truncated or stored. */
function judgeOverLimit({ bigDim, bigBytes, factsFor, expectAllow, requestImageParts, bigDimSha, bigBytesSha }) {
  const dimText = resultText(bigDim)
  const byteText = resultText(bigBytes)
  const dimFacts = factsFor(CALL_IMAGE_BIG_DIM)
  const byteFacts = factsFor(CALL_IMAGE_BIG_BYTES)
  const clauses = expectAllow
    ? [
        { id: 'dimension-refused', ok: isErrorResult(bigDim) === true && /per-side pixel limit/u.test(dimText), detail: `text=${dimText.slice(0, 240)} — the store's own refusal, not the tool's mapped 8192px sentence` },
        { id: 'dimension-not-stored', ok: requestImageParts.every((p) => p.sha256 !== bigDimSha), detail: `parts carrying the over-dimension bytes=${String(requestImageParts.filter((p) => p.sha256 === bigDimSha).length)}` },
        { id: 'dimension-io-facts', ok: dimFacts.length === 2 && dimFacts.every((f) => f.decision === 'allow') && dimFacts.map((f) => String(f.method)).join(',') === 'stat,readBytes', detail: `facts=${JSON.stringify(dimFacts.map((f) => [f.method, f.decision]))}` },
        { id: 'byte-cap-refused', ok: isErrorResult(bigBytes) === true && /exceeds the \d+-byte limit/u.test(byteText), detail: `text=${byteText.slice(0, 240)}` },
        { id: 'byte-cap-not-stored', ok: requestImageParts.every((p) => p.sha256 !== bigBytesSha), detail: `parts carrying the over-cap bytes=${String(requestImageParts.filter((p) => p.sha256 === bigBytesSha).length)} — the 20 MiB+1 file never reaches the attachment store or a model request` },
        { id: 'byte-cap-io-facts', ok: byteFacts.length === 2 && byteFacts.every((f) => f.decision === 'allow') && byteFacts.map((f) => String(f.method)).join(',') === 'stat,readBytes', detail: `facts=${JSON.stringify(byteFacts.map((f) => [f.method, f.decision]))}` },
      ]
    : [
        { id: 'route-gate-precedes-dimension', ok: isErrorResult(bigDim) === true && /does not declare image input/u.test(dimText) && dimFacts.length === 0, detail: `text=${dimText.slice(0, 200)} facts=${String(dimFacts.length)}` },
        { id: 'route-gate-precedes-byte-cap', ok: isErrorResult(bigBytes) === true && /does not declare image input/u.test(byteText) && byteFacts.length === 0, detail: `text=${byteText.slice(0, 200)} facts=${String(byteFacts.length)}` },
        { id: 'no-attachment', ok: requestImageParts.length === 0, detail: `image parts=${String(requestImageParts.length)}` },
      ]
  return verdictOf(
    expectAllow
      ? 'an image over the deployment\'s own limits is refused WHOLE — the dimension law (>8192 px) and the byte cap (>20 MiB) each answer a typed refusal after the admitted read, and no over-limit byte is stored or sent as an image'
      : 'on a text-only route the capability gate runs BEFORE the limits: both over-limit calls are the same route refusal with zero guard facts, so the limit arms cannot be confused with a capability answer',
    clauses,
  )
}

/** The binary must be an image block, never prompt text. */
function judgeNotText({ requestImageParts, textHits, expectAllow, requireImagePart = true, requests }) {
  if (!expectAllow) {
    return verdictOf(
      'on a text-only route no image bytes reach the wire at all: ZERO image parts and NO text block embeds the PNG bytes',
      [
        { id: 'zero-image-parts', ok: requestImageParts.length === 0, detail: `image parts=${String(requestImageParts.length)}` },
        { id: 'no-text-carries-binary', ok: textHits.length === 0, detail: `text blocks carrying the image=${JSON.stringify(textHits)}` },
      ],
    )
  }
  if (!requireImagePart) {
    const placeholder = /\[image omitted because this model accepts text only; attachment sha256:([0-9a-f]+)\]/u.exec(requests.map((r) => allToolResultText(r)).join('\n'))
    return verdictOf(
      'with the gate removed on a TEXT-ONLY route the product does not inline the image: ZERO image parts, and the request carries the text-only placeholder instead of binary',
      [
        { id: 'zero-image-parts', ok: requestImageParts.length === 0, detail: `image parts=${String(requestImageParts.length)}` },
        { id: 'no-text-carries-binary', ok: textHits.length === 0, detail: `text blocks carrying the image=${JSON.stringify(textHits)}` },
        { id: 'text-only-placeholder', ok: placeholder !== null, detail: `placeholder=${String(placeholder?.[0] ?? '<absent>')}` },
      ],
    )
  }
  return verdictOf(
    'the image bytes reach the model as an IMAGE content part, not as binary or base64 stuffed into prompt text: at least one image part exists and NO text block embeds the PNG bytes',
    [
      { id: 'image-part-exists', ok: requestImageParts.length >= 1, detail: `image parts=${String(requestImageParts.length)}` },
      { id: 'no-text-carries-binary', ok: textHits.length === 0, detail: `text blocks carrying the image=${JSON.stringify(textHits)}` },
    ],
  )
}

function judgeControls({ read, factsFor }) {
  return verdictOf(
    'the confined native faces are UNAFFECTED: `read` on the same lane still returns the text and still writes its allow fact, so a red image arm cannot be explained by a dead realm',
    [
      { id: 'read-ok', ok: isErrorResult(read) === false && resultText(read).includes(IN_LANE_TEXT), detail: `text=${resultText(read).slice(0, 160)}` },
      { id: 'read-fact', ok: factsFor(CALL_READ).some((f) => f.decision === 'allow' && String(f.method) === 'readText'), detail: `facts=${JSON.stringify(factsFor(CALL_READ).map((f) => [f.method, f.decision]))}` },
    ],
  )
}

function judgeSurface({ surfaceNames, imageInDescription }) {
  const offered = surfaceNames.includes('read_image')
  const native = typeof imageInDescription === 'string' && /Read a PNG\/JPEG\/WebP\/GIF file/u.test(imageInDescription)
  return verdictOf(
    '`read_image` is on the Member surface and is the pinned host tool (its native description), so the measurement is of the shipped row, not a Team shadow',
    [
      { id: 'read-image-offered', ok: offered, detail: `read_image on surface=${String(offered)}` },
      { id: 'native-description', ok: native, detail: `description=${String(imageInDescription).slice(0, 160)}` },
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
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-pd31-read-image plan (no World)'], rows) + '\n')
  log(`rows: ${JSON.stringify(rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 90) })))}`)
  const plugins = presetPluginIds(layer)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-fs-search']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  if (rows[0].config.staticModel.model !== MODEL_ID) throw new Error('the composed row did not carry the arm model')
  log(`arm=${ARM} mutation=${MUTATION} model=${rows[0].config.staticModel.provider}/${rows[0].config.staticModel.model} expectAllow=${String(EXPECT_ALLOW)}`)
  // The store laws the over-limit fixtures are built against, read from the pin.
  const limitsPath = join(HOST_TREE, 'packages', 'attachment', 'attachment-local', 'src', 'index.ts')
  if (existsSync(limitsPath)) {
    const src = readFileSync(limitsPath, 'utf8')
    const num = (name, fallback) => {
      const m2 = new RegExp(`export const ${name} = ([0-9_ *]+)`, 'u').exec(src)
      if (m2 === null) throw new Error(`the pinned store no longer exports ${name}: the over-limit fixtures are UNANCHORED`)
      if (!/^[0-9_ *]+$/u.test(m2[1])) throw new Error(`unparsable ${name}: not an arithmetic integer literal`)
      // The pinned source spells these as arithmetic (`20 * 1024 * 1024`).
      const value = Number(new Function(`"use strict";return (${m2[1]});`)())
      if (!Number.isFinite(value)) throw new Error(`unparsable ${name}`)
      return value
    }
    const bytes = num('DEFAULT_MAX_IMAGE_BYTES', STORE_MAX_BYTES)
    const dimension = num('DEFAULT_MAX_IMAGE_DIMENSION', STORE_MAX_DIMENSION)
    const pixels = num('DEFAULT_MAX_IMAGE_PIXELS', STORE_MAX_PIXELS)
    log(`pinned store laws: bytes=${String(bytes)} dimension=${String(dimension)} pixels=${String(pixels)}`)
    if (bytes !== STORE_MAX_BYTES || dimension !== STORE_MAX_DIMENSION || pixels !== STORE_MAX_PIXELS) {
      throw new Error('the store limits moved under the fixtures; re-derive them before booting')
    }
  }
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// the route-gate mutation (control only; restored byte-identically)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The gate's ACTUAL runtime home. The first attempt edited the pinned host
 * checkout's built artifact and changed nothing: the World's Host resolves the
 * bare specifier `@deepseek-ai/dsh-tool-fs` from the REPO's installed tree
 * (`node_modules/.pnpm/@deepseek-ai+dsh-tool-fs@…/lib/index.js`), not from the
 * pinned source checkout. Every mutation run therefore targets the module that
 * is genuinely loaded, resolved here the same way, and records both copies'
 * digests so the distinction is visible instead of inferred.
 */
const TOOL_FS_ENTRY = createRequire(join(REPO_ROOT, 'package.json')).resolve('@deepseek-ai/dsh-tool-fs')
const GATE_FILE_REL = 'node_modules/.pnpm/<installed @deepseek-ai/dsh-tool-fs>/lib/index.js'
const GATE_NEEDLE = 'if (active.inputModalities === void 0 || !active.inputModalities.includes("image")) throw new Error(`cannot read "${requestedPath}" as an image: model "${model}" does not declare image input; switch to an image-capable model to read images`);'
const GATE_REPLACEMENT = 'void active; /* A5SF_PD31_MUTATION route-gate-off: capability gate removed for this control run */'

const MUTATION_BACKUP = join(EVIDENCE, '.pd31-mutation-backup.bin')
const MUTATION_BACKUP_META = join(EVIDENCE, '.pd31-mutation-backup.json')

/**
 * Crash self-heal. The route-gate-off control writes to a SHARED installed
 * module; SIGKILL between apply and restore would leave every later World
 * ungated. The original bytes and target path are therefore written beside the
 * evidence BEFORE the mutation, and the next run — of any arm — restores and
 * verifies them first. `finally` is the normal path; this is the abnormal one.
 */
function recoverMutationBackup() {
  if (!existsSync(MUTATION_BACKUP) || !existsSync(MUTATION_BACKUP_META)) return null
  const meta = JSON.parse(readFileSync(MUTATION_BACKUP_META, 'utf8'))
  const bytes = readFileSync(MUTATION_BACKUP)
  if (sha256Bytes(bytes) !== meta.beforeSha256) {
    throw new Error(`a crashed mutation backup is corrupt (${MUTATION_BACKUP}): refusing to guess`)
  }
  writeFileSync(meta.resolvedPath, bytes)
  const restored = sha256(meta.resolvedPath)
  if (restored !== meta.beforeSha256) throw new Error(`crash recovery failed to restore ${meta.resolvedPath}`)
  unlinkSync(MUTATION_BACKUP)
  unlinkSync(MUTATION_BACKUP_META)
  log(`[mutation] RECOVERED a crashed run: restored ${meta.resolvedPath} (${restored.slice(0, 12)}) to its pre-mutation bytes`)
  return { recovered: true, path: meta.resolvedPath, sha256: restored, recoveredAt: new Date().toISOString() }
}

function applyRouteGateOff() {
  const file = TOOL_FS_ENTRY
  // The worktree has no node_modules of its own: the Host resolves this from the
  // MAIN checkout's pnpm store, so the anchor is the pnpm layout, not REPO_ROOT.
  if (!/[/\\]node_modules[/\\]\.pnpm[/\\][^/\\]+[/\\]node_modules[/\\]@deepseek-ai[/\\]dsh-tool-fs[/\\]lib[/\\]index\.js$/u.test(file)) {
    throw new Error(`the resolved tool-fs module is not the installed pnpm copy (${file}): the mutation is unanchored`)
  }
  const hostSource = join(HOST_TREE, 'packages', 'fs', 'tool-fs', 'lib', 'index.js')
  const hostSourceSha = existsSync(hostSource) ? sha256(hostSource) : null
  const before = readFileSync(file)
  const beforeSha = sha256Bytes(before)
  const text = before.toString('utf8')
  if (!text.includes(GATE_NEEDLE)) {
    throw new Error(`the route-gate-off mutation could not find its target in ${file}: the installed artifact moved, so the control is unanchored`)
  }
  const mutated = Buffer.from(text.replace(GATE_NEEDLE, GATE_REPLACEMENT), 'utf8')
  writeFileSync(MUTATION_BACKUP, before)
  writeFileSync(MUTATION_BACKUP_META, JSON.stringify({
    schema: 'a5sf-pd31-read-image/mutation-backup/1',
    resolvedPath: file,
    beforeSha256: beforeSha,
    at: new Date().toISOString(),
  }, null, 2) + '\n')
  writeFileSync(file, mutated)
  const mutatedSha = sha256Bytes(mutated)
  log(`[mutation] route-gate-off applied to ${file} (${beforeSha.slice(0, 12)} -> ${mutatedSha.slice(0, 12)}); pinned host source ${hostSource} sha256=${String(hostSourceSha).slice(0, 12)} untouched`)
  return {
    mutation: 'route-gate-off',
    file: GATE_FILE_REL,
    resolvedPath: file,
    tracedBy: 'node:require.resolve("@deepseek-ai/dsh-tool-fs") from the repo root — the same resolution the Host plugin loader uses',
    hostTreeSource: hostSource,
    hostTreeSourceSha256: hostSourceSha,
    beforeSha256: beforeSha,
    mutatedSha256: mutatedSha,
    needle: GATE_NEEDLE.slice(0, 80),
    restore() {
      writeFileSync(file, before)
      const restoredSha = sha256Bytes(readFileSync(file))
      if (restoredSha !== beforeSha) throw new Error(`the route-gate-off mutation FAILED TO RESTORE ${file} (${restoredSha} != ${beforeSha})`)
      if (sha256(hostSource) !== hostSourceSha) throw new Error(`the pinned host source changed during the mutation window: ${hostSource}`)
      try { unlinkSync(MUTATION_BACKUP) } catch { /* absent is fine */ }
      try { unlinkSync(MUTATION_BACKUP_META) } catch { /* absent is fine */ }
      log(`[mutation] route-gate-off restored ${file} (${restoredSha.slice(0, 12)})`)
      return restoredSha
    },
  }
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
  const phase = `a5sf-pd31-read-image-${ARM_TAG}-boot${String(index)}`
  const runId = `a5sf-pd31-read-image-${ARM_TAG}-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-pd31-read-image', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, authorization), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-pd31-read-image', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const slot = acquireDevLiveSlot({
    leaseRoot: factory.leaseRoot,
    runId: String(record.record.runId),
    face: 'ReadImage',
    world: LINE,
    headCommit: head,
  })
  log(`[boot${String(index)}] dev-live slot #${String(slot.slot)} face=ReadImage world=${LINE} head=${head}`)

  let world = null
  let bootInfo = null
  let teardown = null
  let failure = null
  let abortStage = 'pre-boot'
  let paths = null
  let collectDiagnostics = () => ({})
  let mutation = null
  const counters = {}
  let result = null
  const imageMeta = { bytes: png(3, 2).length, width: 3, height: 2, sha256: sha256Bytes(png(3, 2)) }
  try {
    bootInfo = await (async () => {
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      log(`[boot${String(index)}] world=${world.id} home=${world.home}`)
      mkdirSync(join(world.home, 'blueprints'), { recursive: true })
      const workspace = world.workspaceDir
      writeFileSync(join(workspace, IN_LANE_FILE), `${IN_LANE_TEXT}\n`, 'utf8')
      writeFileSync(join(workspace, NON_IMAGE_FILE), `${NON_IMAGE_TEXT}\n`, 'utf8')
      writeFileSync(join(workspace, IMAGE_FILE), png(3, 2))
      const outsideDir = join(world.home, 'out-of-lane')
      mkdirSync(outsideDir, { recursive: true })
      writeFileSync(join(outsideDir, SECRET_FILE), png(2, 2))
      writeFileSync(join(workspace, BIG_DIM_FILE), png(BIG_DIM_WIDTH, BIG_DIM_HEIGHT))
      writeFileSync(join(workspace, BIG_BYTES_FILE), overByteCapPng())
      writeFileSync(join(world.home, 'fixtures.json'), JSON.stringify({
        schema: 'a5sf-pd31-read-image/fixtures/1',
        image: { name: IMAGE_FILE, ...imageMeta },
        secret: { name: SECRET_FILE, bytes: png(2, 2).length, sha256: sha256Bytes(png(2, 2)) },
        overDimension: { name: BIG_DIM_FILE, width: BIG_DIM_WIDTH, height: BIG_DIM_HEIGHT, bytes: png(BIG_DIM_WIDTH, BIG_DIM_HEIGHT).length, sha256: sha256Bytes(png(BIG_DIM_WIDTH, BIG_DIM_HEIGHT)) },
        overByteCap: { name: BIG_BYTES_FILE, bytes: STORE_MAX_BYTES + 1, over: `${STORE_MAX_BYTES + 1} > ${STORE_MAX_BYTES}` },
        storeLaws: { maxBytes: STORE_MAX_BYTES, maxDimension: STORE_MAX_DIMENSION, maxPixels: STORE_MAX_PIXELS },
      }, null, 2) + '\n')
      writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2) + '\n')

      const anchor = anchorBlueprintYaml()
      writeFileSync(join(world.home, 'blueprints', 'anchor.yaml'), anchor)
      const rows = composedRows({ home: world.home, anchorYaml: anchor, layer })
      world.u6Fs.rows.push(...rows)
      log(`[boot${String(index)}] rows: ${rows.map((r) => r.id).join(',')} model=${rows[0].config.staticModel.model}`)

      // MUTATION: after the candidate guard has passed and before the Host
      // boots, remove the capability gate from the BUILT host artifact.
      if (MUTATION === 'route-gate-off') mutation = applyRouteGateOff()

      await world.startMock({ decide: makeDecide({ workspaceDir: workspace }) })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })()
    abortStage = 'composition'
    paths = {
      workspace: world.workspaceDir,
      inLane: join(world.workspaceDir, IN_LANE_FILE),
      secret: join(world.home, 'out-of-lane', SECRET_FILE),
      missing: join(world.home, 'out-of-lane', MISSING_OUT_OF_LANE),
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

    // ── discovery turn: the REAL surface the preset offers ─────────────────
    abortStage = 'discovery'
    await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfpd31')
    await waitFor(() => (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith('A5SF_PD31_DISC_DONE')), 60_000)
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
    const memberWindowFrom = new Date().toISOString()
    abortStage = 'team-create'
    const created = await remoteCallLong(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5sfpd31')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`[boot${String(index)}] team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)

    const chainTimeoutMs = Number(process.env.A5SF_PD31_CHAIN_TIMEOUT_MS ?? 420_000)
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
    const resultOf = (id) => toolResultBlocksFor(requests, id)
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
    const probe = (id) => {
      const own = ownA(id)?.result ?? null
      const mock = resultOf(id) ?? null
      return { call: callOf(id), result: own ?? (mock === undefined ? null : mock), blocks: own?.blocks ?? mock?.blocks ?? [] }
    }
    const probes = {
      read: probe(CALL_READ),
      imageIn: probe(CALL_IMAGE_IN),
      imageOut: probe(CALL_IMAGE_OUT),
      imageMissing: probe(CALL_IMAGE_MISSING),
      imageTxt: probe(CALL_IMAGE_TXT),
      imageBigDim: probe(CALL_IMAGE_BIG_DIM),
      imageBigBytes: probe(CALL_IMAGE_BIG_BYTES),
    }
    writeFileSync(join(bootDir, 'member-probes.json'), JSON.stringify({
      schema: 'a5sf-pd31-read-image/member-probes/1',
      note: 'one entry per probe; result is the durable transcript result when found, else the mock-observed result. blocks are the model-facing content blocks (the durable image block survives only in the session log / model request, both kept)',
      imageMeta,
      probes,
    }, null, 2) + '\n')
    const requestImageParts = requests.flatMap((r) => imagePartsOfRequest(r).map((p) => ({ ...p, seq: requests.indexOf(r) })))
    writeFileSync(join(bootDir, 'model-request-image-parts.json'), JSON.stringify({
      schema: 'a5sf-pd31-read-image/model-request-image-parts/1',
      at: new Date().toISOString(),
      note: 'every IMAGE content part found in the model requests the leased mock actually received; bytes/sha256 are decoded from the part, so a shell or a text paste cannot pass',
      expectedImage: imageMeta,
      parts: requestImageParts,
    }, null, 2) + '\n')

    // The full shape of every request the mock received, so "no image part" is
    // diagnosable rather than asserted: text is truncated, image sources kept.
    writeFileSync(join(bootDir, 'model-requests.json'), JSON.stringify({
      schema: 'a5sf-pd31-read-image/model-requests/1',
      note: 'text blocks truncated to 400 chars; image blocks kept verbatim (they are tiny PNG fixtures)',
      requests: requests.map((r, i) => ({
        seq: i,
        model: r.body?.model ?? null,
        path: r.path ?? null,
        messages: (r.body?.messages ?? []).map((m) => ({
          role: m?.role ?? null,
          content: Array.isArray(m?.content)
            ? m.content.map((b) => (b?.type === 'text'
              ? { type: 'text', text: String(b.text).slice(0, 400) }
              : b?.type === 'tool_result'
                ? { type: 'tool_result', tool_use_id: b.tool_use_id, content: Array.isArray(b.content) ? b.content.map((c) => (c?.type === 'text' ? { type: 'text', text: String(c.text).slice(0, 400) } : c)) : b.content }
                : b))
            : m?.content,
        })),
      })),
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
    const imageFacts = factsAll.filter((f) => String(f?.tool ?? '') === 'read_image')

    // The image's base64 (for the "no binary in text" check) — from the
    // fixture bytes, not from a request.
    const imageBase64 = png(3, 2).toString('base64')
    const textHits = requests.flatMap((r) => textBlocksCarryingImage(r, imageBase64).map((h) => ({ ...h, seq: requests.indexOf(r) })))
    const secretText = png(2, 2).toString('base64')
    counters.requestsCarryingImageBinaryInText = textHits.length
    counters.requestsCarryingSecretImage = requests.filter((r) => JSON.stringify(r.body ?? r).includes(secretText.slice(0, 48))).length

    counters.guardFacts = {
      allow: factsAll.filter((f) => f.decision === 'allow').length,
      deny: factsAll.filter((f) => f.decision === 'deny').length,
      byTool: factTools,
      readImage: {
        total: imageFacts.length,
        allow: imageFacts.filter((f) => f.decision === 'allow').length,
        deny: imageFacts.filter((f) => f.decision === 'deny').length,
        methods: imageFacts.map((f) => `${String(f.method)}:${String(f.decision)}:${String(f.callId)}`),
      },
    }
    counters.mockRequests = requests.length
    counters.aModelRequests = requests.filter((r) => isARequest(r) && surfaceNamesOf(r).length > 0).length
    counters.surfaceACount = surfaceANames.length
    counters.surfaceANames = surfaceANames
    counters.requestImageParts = requestImageParts.length
    counters.requestImagePartDigests = requestImageParts.map((p) => p.sha256)
    counters.imageMeta = imageMeta
    counters.sessionEvents = scanSessionEventTypes(world.home)
    counters.membersAfter = members.length
    counters.memberTemplates = members.map((m) => String(m?.templateId ?? '')).sort()
    counters.memberWindow = { from: memberWindowFrom, to: memberWindowTo }
    counters.composition = { path: composition.path, sha256: composition.sha256, arm: ARM, mutation: MUTATION }
    counters.model = { provider: MODEL_PROVIDER, id: MODEL_ID, expectAllow: EXPECT_ALLOW }
    counters.quiesced = quiesced
    counters.readImageOnSurface = surfaceANames.includes('read_image')
    counters.allowFactsForInLane = factsFor(CALL_IMAGE_IN).length
    counters.denyFactsForOutOfLane = factsFor(CALL_IMAGE_OUT).filter((f) => f.decision === 'deny').length
    counters.mutation = mutation === null ? null : { mutation: mutation.mutation, file: mutation.file, beforeSha256: mutation.beforeSha256, mutatedSha256: mutation.mutatedSha256 }
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')

    // ── judges ─────────────────────────────────────────────────────────────
    const verdicts = {
      capability: judgeRoute({
        expectAllow: EXPECT_ALLOW, imageIn: probes.imageIn, factsFor,
        requestImageParts, imageDigest: imageMeta.sha256, imageBytes: imageMeta.bytes, requests,
        requireImagePart: MUTATION !== 'route-gate-off',
      }),
      attachment: judgeAttachment({
        imageIn: probes.imageIn, requestImageParts, imageMeta,
        expectAllow: EXPECT_ALLOW, requireImagePart: MUTATION !== 'route-gate-off',
      }),
      lane: judgeLaneDeny({
        imageOut: probes.imageOut, imageMissing: probes.imageMissing, factsFor,
        secretDigest: sha256Bytes(png(2, 2)), secretPath: paths.secret, missingPath: paths.missing,
        requestImageParts, expectAllow: EXPECT_ALLOW,
      }),
      nonImage: judgeNonImage({ imageTxt: probes.imageTxt, factsFor, requestImageParts, imageMeta }),
      overLimit: judgeOverLimit({
        bigDim: probes.imageBigDim, bigBytes: probes.imageBigBytes, factsFor,
        expectAllow: EXPECT_ALLOW, requestImageParts,
        bigDimSha: sha256Bytes(png(BIG_DIM_WIDTH, BIG_DIM_HEIGHT)), bigBytesSha: sha256Bytes(overByteCapPng()),
      }),
      notText: judgeNotText({
        requestImageParts, textHits, expectAllow: EXPECT_ALLOW,
        requireImagePart: MUTATION !== 'route-gate-off', requests,
      }),
      controls: judgeControls({ read: probes.read, factsFor }),
      surface: judgeSurface({ surfaceNames: surfaceANames, imageInDescription: surfaceA.entries.read_image?.description ?? null }),
    }
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}${verdict === 'PROVEN' ? '' : ` failed=${JSON.stringify(detail?.failed ?? [])}`}`)
    }
    add('pd31:image-route-allow', verdicts.capability.verdict, verdicts.capability)
    add('pd31:image-bytes-and-attachment', verdicts.attachment.verdict, verdicts.attachment)
    add('pd31:lane-deny-no-existence-oracle', verdicts.lane.verdict, verdicts.lane)
    add('pd31:non-image-native-shape', verdicts.nonImage.verdict, verdicts.nonImage)
    add('pd31:over-limit-refused-whole', verdicts.overLimit.verdict, verdicts.overLimit)
    add('pd31:image-block-not-text', verdicts.notText.verdict, verdicts.notText)
    add('pd31:surface-and-control', verdicts.controls.verdict === 'PROVEN' && verdicts.surface.verdict === 'PROVEN'
      ? 'PROVEN'
      : 'REFUTED', {
      proposition: verdicts.controls.proposition,
      clauses: [...verdicts.controls.clauses, ...verdicts.surface.clauses],
      failed: [...verdicts.controls.failed, ...verdicts.surface.failed],
    })

    collectDiagnostics('final')
    const final = record.finalize()
    const summary = formatSummary(final)
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), summary + '\n')
    log(`[boot${String(index)}] ${summary}`)

    result = {
      boot: index, arm: ARM, mutation: MUTATION, tag: ARM_TAG, worldId: world.id, port: bootInfo.port,
      runId, summary, overall: final.overall, expectAllow: EXPECT_ALLOW,
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
    if (mutation !== null) {
      try {
        const restored = mutation.restore()
        mutation.restoredSha256 = restored
      } catch (error) {
        log(`[boot${String(index)}] MUTATION RESTORE FAILED: ${String(error?.stack ?? error)}`)
        if (failure === null) { failure = error; abortStage = 'mutation-restore' }
      }
    }
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
    writeFileSync(join(bootDir, 'teardown.json'), JSON.stringify({
      at: new Date().toISOString(), teardown, hostTreePorcelain: porcelain,
      mutation: mutation === null ? null : { ...mutation, restore: undefined },
    }, null, 2) + '\n')
    if (mutation !== null) {
      writeFileSync(join(bootDir, 'mutation.json'), JSON.stringify({
        schema: 'a5sf-pd31-read-image/mutation/1',
        ...mutation,
        restore: undefined,
      }, null, 2) + '\n')
    }
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
    modelSeam: { provider: MODEL_PROVIDER, model: MODEL_ID, source: 'World team-row staticModel (docs/INSTALL.md §3)' },
    mutation: MUTATION,
    note: 'DEV-LIVE: development evidence, never a candidate claim; candidateClaimEligibility is false by construction',
  }
}

function buildAgreement(results) {
  const ok = results.filter((r) => r?.failed !== true)
  const pick = (r) => ({
    arm: r?.arm ?? null,
    mutation: r?.mutation ?? null,
    overall: r?.overall ?? null,
    capabilityVerdict: r?.verdicts?.capability?.verdict ?? null,
    attachmentVerdict: r?.verdicts?.attachment?.verdict ?? null,
    laneVerdict: r?.verdicts?.lane?.verdict ?? null,
    nonImageVerdict: r?.verdicts?.nonImage?.verdict ?? null,
    overLimitVerdict: r?.verdicts?.overLimit?.verdict ?? null,
    notTextVerdict: r?.verdicts?.notText?.verdict ?? null,
    surfaceACount: r?.counters?.surfaceACount ?? null,
    readImageOnSurface: r?.counters?.readImageOnSurface ?? null,
    allowFactsForInLane: r?.counters?.allowFactsForInLane ?? null,
    denyFactsForOutOfLane: r?.counters?.denyFactsForOutOfLane ?? null,
    guardAllow: r?.counters?.guardFacts?.allow ?? null,
    guardDeny: r?.counters?.guardFacts?.deny ?? null,
    imageFacts: JSON.stringify(r?.counters?.guardFacts?.readImage ?? null),
    requestImageParts: r?.counters?.requestImageParts ?? null,
    requestImagePartDigests: JSON.stringify(r?.counters?.requestImagePartDigests ?? null),
    model: JSON.stringify(r?.counters?.model ?? null),
    mutationRecord: JSON.stringify(r?.counters?.mutation ?? null),
    requestsCarryingImageBinaryInText: r?.counters?.requestsCarryingImageBinaryInText ?? null,
    requestsCarryingSecretImage: r?.counters?.requestsCarryingSecretImage ?? null,
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
    `TWO-RUN AGREEMENT (${ARM_TAG} arm; the same command, two boots; every row must be identical)`,
    header.map(cell).join('').replace(/ +$/u, ''),
    ...body.map(([k, ...vals]) => `${cell(k)}${vals.map(cell).join('')}`.replace(/ +$/u, '')),
    '',
    `agreeing=${String(agreeing)} differing=${JSON.stringify(differing)}`,
  ].join('\n')
  return { schema: 'a5sf-pd31-read-image/agreement/1', arm: ARM, mutation: MUTATION, tag: ARM_TAG, at: new Date().toISOString(), boots: results.length, agreeing, differing, rows, table }
}
/** Archive-before-start: a previous arm directory is moved aside, never overwritten. */
function archivePriorRuns() {
  if (!existsSync(RUNS)) return null
  const entries = readdirSync(RUNS)
  if (entries.length === 0) return null
  const archiveRoot = join(EVIDENCE, 'archive')
  mkdirSync(archiveRoot, { recursive: true })
  const target = join(archiveRoot, `${ARM_TAG}-${utcStamp()}`)
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
  const composition = { path: COMPOSITION_PATH, sha256: sha256(COMPOSITION_PATH), arm: ARM, mutation: MUTATION }
  const authorization = {
    scope: 'DEV-LIVE', face: 'ReadImage', world: LINE,
    source: `task PD31-READ-IMAGE explicit boot authorisation (2026-11-14), arm=${ARM_TAG}`,
  }
  const recovered = recoverMutationBackup()
  if (recovered !== null) writeFileSync(join(EVIDENCE, 'mutation-recovery.json'), JSON.stringify(recovered, null, 2) + '\n')
  const archived = ARM === 'prefix' || MUTATION !== 'none' ? null : archivePriorRuns()
  log(`ARCHIVE: ${archived === null ? '(nothing to archive)' : archived}`)
  writeFileSync(join(EVIDENCE, `driver-digest-${ARM_TAG}.json`), JSON.stringify({
    at: startedAt, arm: ARM, mutation: MUTATION, head, hostTree: HOST_TREE, hostSha: hostDigest(), pin: TEST_USE_BASELINE_SHA,
    driverSha256: sha256(fileURLToPath(import.meta.url)), jsSubstitutions: layer.jsSubstitutions,
    composition, authorization, model: { provider: MODEL_PROVIDER, id: MODEL_ID },
    command: `node tests/world-factory/drivers/a5sf-pd31-read-image/run-boot.mjs --arm ${ARM}${MUTATION === 'none' ? '' : ` --mutation ${MUTATION}`}${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
  }, null, 2) + '\n')
  log(`START arm=${ARM} mutation=${MUTATION} head=${head} composition=${composition.path} sha256=${composition.sha256} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA} model=${MODEL_ID} expectAllow=${String(EXPECT_ALLOW)} boots=${String(BOOTS_WANTED)}`)
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
  if (MUTATION === 'none') {
    writeFileSync(join(RUNS, 'agreement.json'), JSON.stringify(agreement, null, 2) + '\n')
    writeFileSync(join(RUNS, 'agreement.txt'), agreement.table + '\n')
    writeFileSync(join(EVIDENCE, `agreement-${ARM_TAG}.json`), JSON.stringify(agreement, null, 2) + '\n')
    writeFileSync(join(EVIDENCE, `agreement-${ARM_TAG}.txt`), agreement.table + '\n')
    log(agreement.table)
  } else {
    log(`mutation run: no two-boot agreement is claimed (single boot by design); control verdict below`)
  }
  const porcelain = hostPorcelain()
  writeFileSync(join(EVIDENCE, `host-tree-porcelain-${ARM_TAG}.txt`), porcelain.length === 0 ? 'empty\n' : porcelain.join('\n') + '\n')
  log(`host porcelain after: ${JSON.stringify(porcelain)}`)
  if (porcelain.length !== 0) process.exitCode = 1
  const allOk = results.length === BOOTS_WANTED && results.every((r) => r?.failed !== true && r?.overall === 'PASS')
  const pairOk = BOOTS_WANTED < 2 || agreement.agreeing === true

  if (MUTATION !== 'none') {
    // A mutation run is judged by whether the CONTROL moved the arm the way
    // the mutation says it must — not by the run's overall verdict.
    // The capability case's PROVEN means "this arm's proposition held", and the
    // proposition DIFFERS per arm (refusal vs served read). Selecting on the
    // verdict word alone compared two different propositions; select on the
    // proposition itself, and on the facts, so the control cannot pass by
    // proving the other arm's sentence.
    const capability = results[0]?.verdicts?.capability ?? null
    const allowVerdict = capability?.verdict ?? null
    const proposition = String(capability?.proposition ?? '')
    const served = /read is SERVED/u.test(proposition)
    const refused = /does NOT declare image input/u.test(proposition)
    const want = MUTATION === 'route-gate-off' ? 'served' : 'refused'
    const mutationSatisfied = results.length === 1
      && results[0]?.failed !== true
      && results[0]?.overall === 'PASS'
      && allowVerdict === 'PROVEN'
      && (MUTATION === 'route-gate-off' ? served : refused)
      && (MUTATION === 'route-gate-off'
        ? (results[0]?.counters?.allowFactsForInLane ?? 0) === 2
        : (results[0]?.counters?.allowFactsForInLane ?? -1) === 0)
    writeFileSync(join(EVIDENCE, `mutation-control-${ARM_TAG}.json`), JSON.stringify({
      schema: 'a5sf-pd31-read-image/mutation-control/2',
      mutation: MUTATION, model: MODEL_ID,
      // Two vocabularies are kept apart on purpose: `successArm` grades the
      // PROPOSITION the arm was built to prove (allow vs refusal), while the
      // proposition verdict says whether that proposition held. Conflating them
      // made a proven refusal read as "allowVerdict=PROVEN" in the first dev run.
      expectation: MUTATION === 'route-gate-off'
        ? 'with the capability check removed from the tool-fs module the Host actually resolves, a TEXT-ONLY route must SERVE the read (successArm=GREEN, 2 allow facts) and must send a text placeholder instead of an image part'
        : 'with the model declaration taken back to [text], the post-fix composition must REFUSE before any provider I/O (successArm=RED, 0 guard facts, 0 image parts) — which proves the declaration is load-bearing',
      want,
      successArm: (want === 'served') === (allowVerdict === 'PROVEN') ? 'GREEN' : 'RED',
      propositionVerdict: allowVerdict,
      observedProposition: proposition,
      observedInLaneAllowFacts: results[0]?.counters?.allowFactsForInLane ?? null,
      observedImageParts: results[0]?.counters?.requestImageParts ?? null,
      observedOverall: results[0]?.overall ?? null,
      mutationRecord: results[0]?.counters?.mutation ?? null,
      hostPorcelainAfter: porcelain,
      satisfied: mutationSatisfied,
    }, null, 2) + '\n')
    log(`MUTATION CONTROL ${mutationSatisfied ? 'OK' : 'FAILED'} mutation=${MUTATION} successArm=${(want === 'served') === (allowVerdict === 'PROVEN') ? 'GREEN' : 'RED'} propositionVerdict=${String(allowVerdict)} want=${want} inLaneAllowFacts=${String(results[0]?.counters?.allowFactsForInLane)} imageParts=${String(results[0]?.counters?.requestImageParts)}` + ` proposition=${proposition.slice(0, 80)}`)
    if (!mutationSatisfied) process.exitCode = 1
    return
  }

  log(`RESULT ${allOk ? 'PASS' : 'FAIL'} arm=${ARM_TAG} (${String(results.length)}/${String(BOOTS_WANTED)} boots; agreeing pair=${String(agreement.agreeing)})`)
  if (!allOk || !pairOk) process.exitCode = 1
}
function hostDigest() {
  try { return execFileSync('git', ['-C', HOST_TREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { return null }
}

main().catch((error) => {
  log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
