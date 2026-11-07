#!/usr/bin/env node
/**
 * dev/agent-workflow/evidence/a5sf-recon-review/run-boot.mjs
 *
 * The INDEPENDENT REVIEWER's own boot (Alpha.5 five-face DEV-LIVE recon review,
 * 2026-11-13). It is derived from
 * `tests/world-factory/drivers/a5sf-live-member/run-boot.mjs` (shape, seam and
 * boot discipline unchanged) and exists for exactly ONE question none of the
 * five lane reports answered:
 *
 *   In ONE boot, with TWO governed Members on DIFFERENT compiled ceilings,
 *   does Member A's lane read Member B's lane, and does A's tool call carry
 *   B's identity?
 *
 * It also re-measures, in the same governed Member, three claims the lanes made
 * in separate boots: the native FS tools (`read`) execute with zero guard facts
 * and outside the ceiling; `grep` executes with zero guard facts outside the
 * ceiling; `web_fetch` on the SHIPPED governed composition either does or does
 * not produce a guard fact (the D-face lane measured web governance on a TEST
 * composition, never on the shipped row).
 *
 * WHAT IS FIXTURE (disclosed): the model is the shared scripted mock
 * (`packages/tools/harness/mock-deepseek.mjs`); the /proc watcher and the
 * mock-request log are instrumentation. The product path is NOT a fixture: the
 * shipped `cordis.patch.yml` rows (host + `preset-a5sf-governed-member`), the
 * realm provider, the compiler, the guard, the confined terminal face and the
 * base `ctx.fs` / `ctx.subprocess` / `ctx.web` services the preset rows resolve
 * are the shipped modules the Host loads.
 *
 * NOT a candidate: `recordClass=DEV-LIVE`, `eligible=false`, no V@B.
 *
 *   node dev/agent-workflow/evidence/a5sf-recon-review/run-boot.mjs --plan
 *   node dev/agent-workflow/evidence/a5sf-recon-review/run-boot.mjs
 *
 * @module dev/agent-workflow/evidence/a5sf-recon-review/run-boot
 */
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

import { apiPrompt, authenticate, emitPatchLayer, fetchJson } from '../../../../tests/world-factory/lib/world-factory.mjs'
import { createRunRecord, formatSummary, readAuthorityBinding } from '../../../../tests/world-factory/lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../../tests/paths.mjs'
import { createA5sfHarness } from '../../../../tests/world-factory/lib/a5sf-harness.mjs'
import { preRegisterDevLiveBudget } from '../../../../tests/world-factory/suites/150-a5sf-read.mjs'
import {
  messagesOf, remoteCall, surfaceNamesOf, textOf, lastUserTextOfStatic,
} from '../../../../tests/world-factory/lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = HERE
const RUNS = join(EVIDENCE, 'runs')
const ARCHIVE = join(EVIDENCE, 'archive')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')
const GRANT_PATH = join(EVIDENCE, 'dev-live-grant.json')

const LINE = 'u5a5sfrev1'
const BOOT_ROOT = 'session-a5sf-rv-boot'
const ACCEPTANCE_ROOT = 'session-a5sf-rv-team'
const BP_ANCHOR_ID = 'team.a5sf.rv.anchor'
const BP_MAIN_ID = 'team.a5sf.rv.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'A5SF_RV_DISC'
const MK_L1 = 'A5SF_RV_L1_DRIVE'
const TOK_A = 'a5sf-rv-member-a'
const TOK_B = 'a5sf-rv-member-b'
const DONE_L1 = 'A5SF_RV_L1_DONE'
const DONE_A = 'A5SF_RV_A_DONE'
const DONE_B = 'A5SF_RV_B_DONE'

const C = {
  aBashAllow: 'call-a5sfrv-a-bash-allow',
  aBashCross: 'call-a5sfrv-a-bash-cross',
  aReadCross: 'call-a5sfrv-a-read-cross',
  aGrepCross: 'call-a5sfrv-a-grep-cross',
  aWebFetch: 'call-a5sfrv-a-web-fetch',
  bBashAllow: 'call-a5sfrv-b-bash-allow',
  bBashCross: 'call-a5sfrv-b-bash-cross',
}

const TEXT_A = 'A5SF_RV_LANE_A_BYTES'
const TEXT_B = 'A5SF_RV_LANE_B_BYTES'
const WEB_PROBE_URL = 'http://127.0.0.1:1/a5sf-review-probe'

const SELECTED_CASES = Object.freeze([
  'rv:two-members-admitted',
  'rv:a-bash-own-lane-allow',
  'rv:a-bash-cross-lane-deny',
  'rv:a-native-read-cross-lane-no-fact',
  'rv:a-grep-cross-lane-no-fact',
  'rv:a-web-fetch-governed-fact',
  'rv:b-identity-separation',
  'rv:cross-dispatch-as-a',
])

const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
const RUN_TAG = (() => { const i = argv.indexOf('--run-tag'); return i === -1 ? 'boot01' : String(argv[i + 1] ?? 'boot01') })()
const startedAt = new Date().toISOString()

let RUN_LOG = join(EVIDENCE, 'driver.log')
function log(line) {
  const text = `[${new Date().toISOString()}] ${String(line)}`.replace(/[ \t]+$/u, '')
  // eslint-disable-next-line no-console
  console.log(text)
  try { appendFileSync(RUN_LOG, text + '\n') } catch { /* console is the live channel */ }
}
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }
const parseJsonl = (p) => {
  try {
    return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => {
      try { return JSON.parse(l) } catch { return { unparseable: l.slice(0, 200) } }
    })
  } catch { return [] }
}
const redact = (t) => String(t ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const utcStamp = () => new Date().toISOString().replace(/[:.]/gu, '-')
const require_ = createRequire(join(REPO_ROOT, 'package.json'))
/** The pristine pinned host tree: this worktree's copy when it exists, else the
 *  main checkout's prepared read-only tree (a worktree does not carry the
 *  gitignored runtime). Never written. */
function hostTreePath() {
  const local = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  if (existsSync(local)) return local
  return resolve(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
}
const HOST_TREE = hostTreePath()

// ─────────────────────────────────────────────────────────────────────────────
// shipped layer
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
// blueprints: TWO templates, TWO different ceilings, one team
// ─────────────────────────────────────────────────────────────────────────────
function anchorBlueprintYaml() {
  const doc = {
    schemaVersion: 3,
    blueprintId: BP_ANCHOR_ID,
    revision: '1',
    leader: { templateId: 'leader', persona: `You lead the a5sf recon-review anchor team. ${MK_DISC} is the discovery marker.` },
    members: [{ templateId: 'lane-a', persona: 'You are the anchor worker.' }],
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

const lane = (allow) => ({ mode: 'restricted', allow: [...allow], ask: [], deny: [] })

function mainBlueprintYaml({ laneA, laneB }) {
  const doc = {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the a5sf recon-review team. ${MK_L1} drives your chain: delegate lane-a once, then lane-b once, then finish.`,
    },
    members: [
      { templateId: 'lane-a', displayName: 'Lane A', persona: 'You are governed worker A. Follow the probe order exactly, one tool call at a time.' },
      { templateId: 'lane-b', displayName: 'Lane B', persona: 'You are governed worker B. Follow the probe order exactly, one tool call at a time.' },
    ],
    requirements: [],
    teamEnvelope: {
      allow: ['create-member', 'assign-task', 'send-message', 'report-progress', 'archive-member'],
      deny: [],
    },
    memberEnvelopes: [
      { templateId: 'lane-a', envelope: { allow: ['send-message', 'report-progress'], deny: [] } },
      { templateId: 'lane-b', envelope: { allow: ['send-message', 'report-progress'], deny: [] } },
    ],
    policyStates: [{ id: 'default', description: 'Default state.' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [
      { templateId: 'lane-a', io: { read: lane([laneA]), write: lane([laneA]), network: { mode: 'allow' } } },
      { templateId: 'lane-b', io: { read: lane([laneB]), write: lane([laneB]), network: { mode: 'allow' } } },
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
    throw new Error(`${label} rejected by the host validator: ${String(error?.message ?? error)}`)
  }
  const doc = parsed.blueprint ?? parsed
  if (doc.blueprintId !== wantId) throw new Error(`${label} resolves as ${String(doc.blueprintId)}, want ${wantId}`)
  if (wantId === BP_MAIN_ID) {
    if (doc.schemaVersion !== 4) throw new Error(`${label} is schemaVersion ${String(doc.schemaVersion)}, want 4`)
    if (!Array.isArray(doc.memberIoCeilings) || doc.memberIoCeilings.length !== 2) throw new Error(`${label} lost its two-member memberIoCeilings family`)
  }
  return { ok: true, schemaVersion: doc.schemaVersion, via: 'parseBlueprint(dist domain facade)' }
}

// ─────────────────────────────────────────────────────────────────────────────
// composed rows
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
// mock-model helpers
// ─────────────────────────────────────────────────────────────────────────────
function firstUserText(req) {
  const first = messagesOf(req).find((m) => m?.role === 'user')
  if (first === undefined) return ''
  return typeof first.content === 'string' ? first.content : JSON.stringify(first.content ?? '')
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
 * The scripted model. The Member branch is selected STRUCTURALLY (first user
 * message = the delegated `[team-work …]` envelope carrying OUR token).
 */
function makeDecide({ laneAPath, laneBPath, workspaceDir, workdirA, workdirB }) {
  const one = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
  const bash = (id, command, description, workdir) => one(id, 'bash', { command, description, workdir })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf recon review session' }

    const first = firstUserText(req)
    const isMember = first.includes('[team-work ')
    if (isMember && first.includes(TOK_A)) {
      const seen = resultIdsOf(req)
      if (!seen.has(C.aBashAllow)) return bash(C.aBashAllow, `cat '${laneAPath}/a.txt'; sleep 1.0`, 'Control: read lane A', workdirA)
      if (!seen.has(C.aBashCross)) return bash(C.aBashCross, `cat '${laneBPath}/b.txt'; sleep 1.0`, 'Probe: read lane B through the governed face', workdirA)
      if (!seen.has(C.aReadCross)) return one(C.aReadCross, 'read', { file_path: `${laneBPath}/b.txt` })
      if (!seen.has(C.aGrepCross)) return one(C.aGrepCross, 'grep', { pattern: 'A5SF_RV_LANE_B', path: laneBPath })
      if (!seen.has(C.aWebFetch)) return one(C.aWebFetch, 'web_fetch', { url: WEB_PROBE_URL })
      return { kind: 'text', content: `${DONE_A} ${lastToolResultText(req).slice(0, 160)}` }
    }
    if (isMember && first.includes(TOK_B)) {
      const seen = resultIdsOf(req)
      if (!seen.has(C.bBashAllow)) return bash(C.bBashAllow, `cat '${laneBPath}/b.txt'; sleep 1.0`, 'Control: read lane B', workdirB)
      if (!seen.has(C.bBashCross)) return bash(C.bBashCross, `cat '${laneAPath}/a.txt'; sleep 1.0`, 'Probe: read lane A through the governed face', workdirB)
      return { kind: 'text', content: `${DONE_B} ${lastToolResultText(req).slice(0, 160)}` }
    }

    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_RV_DISC_DONE' }

    if (lastUser.includes(MK_L1) || allText.includes(MK_L1)) {
      const seen = resultIdsOf(req)
      if (!seen.has('call-a5sfrv-delegate-a')) {
        return one('call-a5sfrv-delegate-a', 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_A}-delegate`,
          delegationTemplateId: 'lane-a',
          label: 'a5sfrv-a',
          workspace: workspaceDir,
          prompt: `${TOK_A}: run your five probes exactly once each, in the order given, one tool call at a time, then report. Do not skip and do not repeat.`,
          async: false,
        })
      }
      if (!seen.has('call-a5sfrv-delegate-b')) {
        return one('call-a5sfrv-delegate-b', 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_B}-delegate`,
          delegationTemplateId: 'lane-b',
          label: 'a5sfrv-b',
          workspace: workspaceDir,
          prompt: `${TOK_B}: run your two probes exactly once each, in the order given, one tool call at a time, then report.`,
          async: false,
        })
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_RV_NOOP' }
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
  if (pending !== undefined) { try { parts.push(zstdDecompressSync(pending)) } catch { /* partial tail */ } }
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
    if (type === 'user/message') user.push(contentText((data?.message ?? data)?.content))
    if (type === 'assistant/message') {
      const t = contentText((data?.message ?? data)?.content)
      if (t.trim() !== '') assistant.push(t)
    }
    if (type === 'tool/call') {
      const args = data?.arguments ?? data?.input ?? data?.message?.arguments ?? null
      calls.push({
        callId: data?.callId ?? data?.id ?? data?.message?.source?.callId ?? null,
        name: data?.name ?? data?.message?.name ?? null,
        arguments: typeof args === 'string' ? args : JSON.stringify(args),
        at: row?.at ?? row?.time ?? null,
      })
    }
    if (type === 'tool/result') {
      const src = data?.message?.source ?? data?.source ?? {}
      const body = data?.message?.content ?? data?.content ?? data?.result ?? ''
      results.push({
        callId: src.callId ?? data?.callId ?? null,
        isError: data?.isError === true || data?.message?.isError === true || data?.message?.error !== undefined,
        text: contentText(body),
        at: row?.at ?? row?.time ?? null,
      })
    }
  }
  const paired = calls.map((call) => {
    const result = results.find((r) => String(r.callId) === String(call.callId)) ?? null
    let args = null
    try { args = JSON.parse(call.arguments) } catch { args = null }
    return { callId: call.callId, name: call.name, arguments: args, result }
  })
  return { sessionId, file: found.file, header: found.header, lineCount: lines.length, user, calls: paired, assistant, finalAssistant: assistant.at(-1) ?? null }
}
function renderTranscript(t) {
  if (t === null) return '<no transcript>'
  const out = [`SESSION ${t.sessionId} (${t.file})`, '']
  for (const call of t.calls) {
    out.push(`TOOL CALL [${String(call.name)}] ${String(call.callId)}`)
    out.push(`  ${JSON.stringify(call.arguments)}`)
    out.push(`TOOL RESULT isError=${String(call.result?.isError)}`)
    out.push(`  ${String(call.result?.text ?? '<no result>').slice(0, 3000)}`)
    out.push('')
  }
  out.push(`FINAL: ${String(t.finalAssistant ?? '')}`)
  return out.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// plan
// ─────────────────────────────────────────────────────────────────────────────
function planOnly() {
  const layer = shippedLayer()
  const ws = join(EVIDENCE, 'plan-workspace')
  const laneA = join(ws, 'lane-a')
  const laneB = join(ws, 'lane-b')
  log(`PLAN repo=${REPO_ROOT} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA}`)
  log(`shipped !!js substitutions: ${JSON.stringify(layer.jsSubstitutions)}`)
  const anchor = anchorBlueprintYaml()
  const main = mainBlueprintYaml({ laneA, laneB })
  log(`blueprints accepted: anchor=${JSON.stringify(assertBlueprintText(anchor, BP_ANCHOR_ID, 'anchor.yaml'))} main=${JSON.stringify(assertBlueprintText(main, BP_MAIN_ID, 'main.yaml'))}`)
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), anchorYaml: anchor, layer })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-recon-review plan (no World)'], rows) + '\n')
  log(`rows: ${JSON.stringify(rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 80) })))}`)
  const preset = layer.rows.find((r) => r?.config?.id === PRESET_ID)
  const plugins = (preset?.config?.plugins ?? []).map((p) => p.id)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-fs-search']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// the boot
// ─────────────────────────────────────────────────────────────────────────────
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

async function bootOnce({ head, layer }) {
  const bootDir = join(RUNS, RUN_TAG)
  mkdirSync(bootDir, { recursive: true })
  const runId = `a5sf-recon-review-${utcStamp()}-b1`
  const record = createRunRecord({
    runId, suite: 'a5sf-recon-review', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, readJson(GRANT_PATH)), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-recon-review', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const lease = await preRegisterDevLiveBudget({
    grantPath: GRANT_PATH, headCommit: head, runRecord: record,
    face: 'Subprocess', world: LINE, leaseRoot: factory.leaseRoot, requiredBoots: 1,
  })
  log(`dev-live lease grant=${lease.grant.grantId} world=${LINE} head=${head} holdsSlot=${String(lease.holdsSlot())}`)

  let world = null
  let bootInfo = null
  let teardown = null
  let failure = null
  let abortStage = 'pre-boot'
  let collectDiagnostics = () => ({})
  const out = {}
  try {
    bootInfo = await lease.boot(async () => {
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      log(`world=${world.id} home=${world.home}`)
      mkdirSync(join(world.home, 'blueprints'), { recursive: true })
      const workspace = world.workspaceDir
      const laneA = join(workspace, 'lane-a')
      const laneB = join(workspace, 'lane-b')
      mkdirSync(laneA, { recursive: true })
      mkdirSync(laneB, { recursive: true })
      writeFileSync(join(laneA, 'a.txt'), `${TEXT_A}\n`, 'utf8')
      writeFileSync(join(laneB, 'b.txt'), `${TEXT_B}\n`, 'utf8')
      out.paths = { workspace, laneA, laneB, sink: join(world.home, 'a5sf-consult.jsonl') }
      writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2) + '\n')

      const anchor = anchorBlueprintYaml()
      writeFileSync(join(world.home, 'blueprints', 'anchor.yaml'), anchor)
      const rows = composedRows({ home: world.home, anchorYaml: anchor, layer })
      world.u6Fs.rows.push(...rows)
      log(`rows: ${rows.map((r) => r.id).join(',')}`)

      const decide = makeDecide({ laneAPath: laneA, laneBPath: laneB, workspaceDir: workspace, workdirA: laneA, workdirB: laneB })
      process.env.A5SF_GOVERNED_SCRATCH = join(world.home, 'governed-scratch')
      mkdirSync(process.env.A5SF_GOVERNED_SCRATCH, { recursive: true })
      await world.startMock({ decide })
      log(`mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase: 'a5sf-recon-review-boot1', bootTimeoutMs: 300_000 })
    })
    abortStage = 'composition'
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
    log(`p6t6 health=${String(healthOk)}`)
    if (!healthOk) throw new Error('the p6t6 harness route never answered: the World did not reach a usable Host')

    collectDiagnostics = (label) => {
      const requestsNow = world?.mock?.requests ?? []
      const dump = {
        mockRequests: requestsNow.map((r, i) => ({
          seq: i,
          firstUser: firstUserText(r).slice(0, 400),
          isMemberA: firstUserText(r).includes('[team-work ') && firstUserText(r).includes(TOK_A),
          isMemberB: firstUserText(r).includes('[team-work ') && firstUserText(r).includes(TOK_B),
          tools: surfaceNamesOf(r).length,
          reply: typeof r.reply === 'object' ? JSON.stringify(r.reply).slice(0, 400) : String(r.reply ?? '').slice(0, 400),
        })),
        guardFacts: parseJsonl(out.paths?.sink ?? ''),
      }
      writeFileSync(join(bootDir, `diagnostics-${label}.json`), JSON.stringify(dump, null, 2) + '\n')
      log(`diagnostics(${label}) mockRequests=${String(dump.mockRequests.length)} facts=${String(dump.guardFacts.length)}`)
      return dump
    }

    // ── discovery turn: the real Leader surface ────────────────────────────
    abortStage = 'discovery'
    await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfrv')
    await waitFor(() => (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith('A5SF_RV_DISC_DONE')), 60_000)
    const discRequests = world.mock?.requests ?? []
    const discRequest = discRequests.filter((r) => messagesOf(r).some((m) => textOf(m).includes(MK_DISC)) && surfaceNamesOf(r).length > 0).at(-1) ?? null
    const leaderSurface = discRequest === null ? [] : [...new Set(surfaceNamesOf(discRequest))].sort()
    writeFileSync(join(bootDir, 'leader-surface.json'), JSON.stringify({ at: new Date().toISOString(), tools: leaderSurface }, null, 2) + '\n')
    log(`leader surface (${String(leaderSurface.length)}): ${leaderSurface.join(',')}`)
    if (!leaderSurface.some((n) => n.startsWith('team_'))) throw new Error('the Leader surface carries no team tools')

    const mainText = mainBlueprintYaml({ laneA: out.paths.laneA, laneB: out.paths.laneB })
    assertBlueprintText(mainText, BP_MAIN_ID, 'main.yaml')
    writeFileSync(join(world.home, 'blueprints', 'main.yaml'), mainText)

    // ── team.create: TWO governed Members on TWO ceilings ──────────────────
    abortStage = 'team-create'
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5sfrv')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 600)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)

    abortStage = 'member-turns'
    let chainOk = false
    const chainDeadline = Date.now() + 300_000
    for (;;) {
      chainOk = (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith(DONE_L1))
      if (chainOk || Date.now() > chainDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    log(`leader chain closed (${DONE_L1})=${String(chainOk)}`)
    abortStage = 'evidence-collection'
    if (!chainOk) { collectDiagnostics('chain-timeout'); throw new Error('the Leader chain never closed') }

    const requests = world.mock?.requests ?? []
    writeFileSync(join(bootDir, 'leader-delegates.json'), JSON.stringify({
      delegateA: { call: toolCallFor(requests, 'call-a5sfrv-delegate-a'), result: toolResultFor(requests, 'call-a5sfrv-delegate-a') ?? null },
      delegateB: { call: toolCallFor(requests, 'call-a5sfrv-delegate-b'), result: toolResultFor(requests, 'call-a5sfrv-delegate-b') ?? null },
    }, null, 2) + '\n')

    const state = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const members = Array.isArray(state?.body?.members) ? state.body.members : []
    writeFileSync(join(bootDir, 'state.json'), JSON.stringify(state?.body ?? null, null, 2) + '\n')
    const pick = (templateId) => members.find((m) => String(m?.templateId ?? '') === templateId) ?? null
    const mA = pick('lane-a')
    const mB = pick('lane-b')
    log(`members=${JSON.stringify(members.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle })))}`)
    const childId = (m) => m?.childSessionId ?? (m?.instanceId === undefined ? null : `session-team-child-${createHash('sha256').update(`${ACCEPTANCE_ROOT}\u0000${m.instanceId}`).digest('hex').slice(0, 32)}`)

    const transcripts = {}
    for (const [key, m] of [['A', mA], ['B', mB]]) {
      const sid = childId(m)
      const t = sid === null ? null : readMemberTranscript(world.home, sid)
      transcripts[key] = t
      if (t !== null) {
        writeFileSync(join(bootDir, `member-${key}-transcript.json`), JSON.stringify(t, null, 2) + '\n')
        writeFileSync(join(bootDir, `member-${key}-transcript.txt`), renderTranscript(t) + '\n')
        try { writeFileSync(join(bootDir, `member-${key}-session.v4.jsonl.zstd`), readFileSync(t.file)) } catch { /* best effort */ }
      }
    }

    // ── the independent cross-dispatch: A's session, B's lane ─────────────
    abortStage = 'cross-dispatch'
    const cross = {}
    for (const [key, name, args] of [
      ['readB', 'read', { file_path: `${out.paths.laneB}/b.txt` }],
      ['bashB', 'bash', { command: `cat '${out.paths.laneB}/b.txt'`, description: 'cross-lane read through the governed face', workdir: out.paths.workspace }],
    ]) {
      const sid = childId(mA)
      cross[key] = sid === null ? { skipped: 'no child session for A' } : await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, args, as: sid, callId: `call-a5sfrv-cross-${key}` }),
      }, 120_000)
      log(`cross-dispatch ${key}: status=${String(cross[key]?.status)} body=${redact(JSON.stringify(cross[key]?.body ?? null)).slice(0, 500)}`)
    }
    writeFileSync(join(bootDir, 'cross-dispatch.json'), JSON.stringify(cross, null, 2) + '\n')

    // ── facts, surfaces, identity ───────────────────────────────────────────
    const factsAll = parseJsonl(out.paths.sink)
    writeFileSync(join(bootDir, 'guard-facts.json'), JSON.stringify(factsAll, null, 2) + '\n')
    const memberRequestOf = (token) => requests.filter((r) => firstUserText(r).includes('[team-work ') && firstUserText(r).includes(token) && surfaceNamesOf(r).length > 0).at(-1) ?? null
    const surfaceOf = (req) => {
      if (req === null) return { tools: [], schemas: [] }
      const names = surfaceNamesOf(req)
      const schemas = (req.body?.tools ?? []).map((t) => {
        const fn = t?.function ?? null
        return {
          name: String(t?.name ?? fn?.name ?? ''),
          description: t?.description ?? fn?.description ?? null,
          parameters: t?.parameters ?? fn?.parameters ?? t?.input_schema ?? t?.inputSchema ?? null,
        }
      })
      return { tools: names, schemas }
    }
    const surfaceA = surfaceOf(memberRequestOf(TOK_A))
    const surfaceB = surfaceOf(memberRequestOf(TOK_B))
    writeFileSync(join(bootDir, 'member-surface.json'), JSON.stringify({ A: surfaceA.tools, B: surfaceB.tools, bashA: surfaceA.schemas.find((s) => s.name === 'bash') ?? null }, null, 2) + '\n')

    const factsOf = (instanceId) => factsAll.filter((f) => String(f?.memberIdentity ?? '') === String(instanceId ?? '<null>'))
    const summary = {
      at: new Date().toISOString(),
      recordClass: 'DEV-LIVE',
      candidateClaimEligibility: { eligible: false, reason: 'DEV_LIVE_EVIDENCE_NOT_CANDIDATE' },
      host: { pin: TEST_USE_BASELINE_SHA, port: bootInfo.port, world: world.id },
      head,
      members: members.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle, policyRevision: m.policyRevision ?? m.row?.policyRevision ?? null })),
      lanes: { A: out.paths.laneA, B: out.paths.laneB },
      surfaces: { A: surfaceA.tools, B: surfaceB.tools },
      facts: {
        total: factsAll.length,
        byMethod: factsAll.reduce((acc, f) => { const k = String(f?.method); acc[k] = (acc[k] ?? 0) + 1; return acc }, {}),
        identities: Object.fromEntries([['A', mA?.instanceId ?? null], ['B', mB?.instanceId ?? null]].map(([k, id]) => [k, {
          instanceId: id,
          count: factsOf(id).length,
          facts: factsOf(id).map((f) => ({ method: f.method, locator: f.locator, decision: f.decision, decidedBy: f.decidedBy, sequence: f.sequence, policyRevision: f.policyRevision })),
        }])),
        crossLaneAllowFacts: factsAll.filter((f) => f?.decision === 'allow' && String(f?.locator ?? '').includes(out.paths.laneB)).map((f) => ({ method: f.method, locator: f.locator, memberIdentity: f.memberIdentity })),
      },
      crossDispatch: cross,
      transcripts: Object.fromEntries(['A', 'B'].map((k) => [k, transcripts[k] === null ? null : {
        sessionId: transcripts[k].sessionId, lineCount: transcripts[k].lineCount,
        calls: transcripts[k].calls.map((c) => ({ callId: c.callId, name: c.name, arguments: c.arguments, isError: c.result?.isError ?? null, result: String(c.result?.text ?? '').slice(0, 1200) })),
      }])),
    }
    writeFileSync(join(bootDir, 'recon-review.json'), JSON.stringify(summary, null, 2) + '\n')

    // ── judges (the review's own propositions) ─────────────────────────────
    const tA = transcripts.A
    const callA = (id) => tA?.calls.find((c) => String(c.callId) === String(id)) ?? null
    const FS_METHODS = new Set(['readText', 'readByteRange', 'readStream', 'stat', 'lstat', 'listDir', 'writeText', 'editText', 'fsRead', 'fsWrite'])
    const realmFsFactsAt = (instanceId, locatorSuffix) => factsOf(instanceId).filter((f) => FS_METHODS.has(String(f?.method)) && String(f?.locator ?? '').endsWith(locatorSuffix))
    const add = (id, verdict, detail) => {
      record.addCase(id, verdict, detail)
      log(`case ${id}: ${verdict}`)
    }
    add('rv:two-members-admitted', mA !== null && mB !== null && mA.instanceId !== mB.instanceId ? 'PASS' : 'FAIL', {
      detail: 'two Members, two templates, two instanceIds in one boot', members: summary.members,
    })
    const aAllow = callA(C.aBashAllow)
    add('rv:a-bash-own-lane-allow', aAllow?.result?.isError === false && String(aAllow?.result?.text ?? '').includes(TEXT_A) ? 'PASS' : 'FAIL', {
      detail: 'A reads its own lane through the governed bash face', result: aAllow?.result ?? null,
    })
    const aCross = callA(C.aBashCross)
    add('rv:a-bash-cross-lane-deny', aCross?.result?.isError === true && String(aCross?.result?.text ?? '').includes('IO_READ_DENIED') && !String(aCross?.result?.text ?? '').includes(TEXT_B) ? 'PASS' : 'FAIL', {
      detail: 'A reading B\'s lane through the governed bash face is refused with a typed code and zero B bytes', result: aCross?.result ?? null,
    })
    const aRead = callA(C.aReadCross)
    add('rv:a-native-read-cross-lane-no-fact', aRead?.result?.isError === false && String(aRead?.result?.text ?? '').includes(TEXT_B) && realmFsFactsAt(mA?.instanceId, 'b.txt').length === 0 ? 'PASS' : 'FAIL', {
      detail: 'A reading B\'s lane through the NATIVE read tool succeeds with ZERO guard facts (the ungoverned path crosses the lane in one boot)', result: aRead?.result ?? null,
    })
    const aGrep = callA(C.aGrepCross)
    add('rv:a-grep-cross-lane-no-fact', aGrep?.result?.isError === false && String(aGrep?.result?.text ?? '').includes(TEXT_B) && factsOf(mA?.instanceId).filter((f) => String(f?.locator ?? '').includes('lane-b') && f?.decision === 'allow').length === 0 ? 'PASS' : 'FAIL', {
      detail: 'A searching B\'s lane through grep returns B\'s bytes with ZERO guard facts', result: aGrep?.result ?? null,
    })
    const webFacts = factsAll.filter((f) => String(f?.method ?? '').startsWith('web'))
    const aWeb = callA(C.aWebFetch)
    // PROPOSITION: on the SHIPPED governed composition a model-visible
    // `web_fetch` is admitted through the confined web face and produces a
    // guard fact. It does not: zero web:* facts, and the refusal names the
    // BASE provider's SSRF policy, not a5sf. REFUTED => FAIL.
    add('rv:a-web-fetch-governed-fact', webFacts.length > 0 ? 'PASS' : 'FAIL', {
      detail: `web_fetch on the SHIPPED governed composition produced ${String(webFacts.length)} web:* guard fact(s); the model-visible refusal is "${String(aWeb?.result?.text ?? '').slice(0, 200)}" — a base-provider SSRF refusal, not an a5sf lane decision`,
      webFactCount: webFacts.length, webFacts, result: aWeb?.result ?? null,
    })
    const bFacts = factsOf(mB?.instanceId)
    add('rv:b-identity-separation', bFacts.length > 0 && bFacts.every((f) => String(f.memberIdentity) === String(mB?.instanceId)) && factsOf(mA?.instanceId).every((f) => String(f.memberIdentity) === String(mA?.instanceId)) ? 'PASS' : 'FAIL', {
      detail: 'every guard fact names its own Member; A\'s facts never carry B\'s identity', aFacts: factsOf(mA?.instanceId).length, bFacts: bFacts.length,
    })
    const crossReadOk = cross.readB?.status === 200 && cross.readB?.body?.ok === true && String(JSON.stringify(cross.readB?.body ?? {})).includes(TEXT_B)
    const crossBashDenied = cross.bashB?.status === 200 && cross.bashB?.body?.ok === false
      ? String(JSON.stringify(cross.bashB.body)).includes('IO_READ_DENIED')
      : false
    add('rv:cross-dispatch-as-a', crossReadOk && crossBashDenied ? 'PASS' : 'FAIL', {
      detail: 'independent dispatch with A\'s session id: native read of B\'s lane returns B\'s bytes; governed bash is refused — the difference is the TOOL, not the identity',
      crossReadOk, crossBashDenied,
    })

    const final = record.finalize()
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), formatSummary(final) + '\n')
    log(`SUMMARY ${formatSummary(final)}`)
    out.overall = final.overall
    out.cases = final.cases
    out.file = join(bootDir, 'recon-review.json')
  } catch (error) {
    failure = error
    if (world !== null) { try { collectDiagnostics('abort') } catch { /* best effort */ } }
    record.markAborted({ stage: abortStage, detail: `aborted at ${abortStage}`, error: String(error?.stack ?? error) })
    const final = record.finalize()
    mkdirSync(bootDir, { recursive: true })
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    log(`FAILED at ${abortStage}: ${String(error?.stack ?? error)}`)
  } finally {
    try { lease.releaseSlot() } catch { /* slot cleanup */ }
    if (world !== null) {
      try { teardown = await world.teardown({ keepHome: false }) } catch (error) { log(`teardown failed: ${String(error?.message ?? error)}`) }
    }
    mkdirSync(bootDir, { recursive: true })
    writeFileSync(join(bootDir, 'teardown.json'), JSON.stringify(teardown ?? { error: 'no teardown' }, null, 2) + '\n')
    try {
      lease.finish({ cases: (out.cases ?? []).map((c) => ({ id: c.id, verdict: c.verdict })), overall: out.overall ?? 'FAIL', teardown })
    } catch (error) { log(`lease.finish failed: ${String(error?.message ?? error)}`) }
  }
  if (failure !== null) throw failure
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  writeFileSync(RUN_LOG, '')
  const layer = shippedLayer()
  if (PLAN_ONLY) { planOnly(); return }
  const head = (await import('node:child_process')).execFileSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim()
  log(`HEAD=${head} pin=${TEST_USE_BASELINE_SHA} startedAt=${startedAt}`)
  if (RUN_TAG === 'boot01') {
    const archived = archivePriorRuns()
    if (archived !== null) log(`archived previous runs -> ${archived}`)
  }
  mkdirSync(RUNS, { recursive: true })
  if (!existsSync(GRANT_PATH)) throw new Error(`missing dev-live grant: ${GRANT_PATH}`)
  const result = await bootOnce({ head, layer })
  log(`DONE overall=${String(result.overall)} file=${String(result.file)}`)
}

await main()
