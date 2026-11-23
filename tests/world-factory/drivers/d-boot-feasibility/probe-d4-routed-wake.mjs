#!/usr/bin/env node
/**
 * tests/world-factory/drivers/d-boot-feasibility/probe-d4-routed-wake.mjs — the
 * D4 live probe for the ONE Alpha.6 gap round 84 left open: the ROUTED review
 * wake reaching a real Host.
 *
 * WHY THIS IS A PROBE AND NOT `run-boot-d4.mjs`. Round 87 measured, before
 * writing any driver, whether the product can CREATE the row the Alpha.6 router
 * routes: `createAlpha6RootRouter.route()` returns `null` unless the durable
 * request carries `approvalCaseId` AND `legOrdinal` (`alpha6/root-router.ts`),
 * and an ordinary tool ask is created by the centre's admission port
 * (`src/plugin/vnext/admission-port.mjs`) as a CASE-LESS `leader-approval` row
 * (`requestControl` with no `leg`). The only live producer of an approval case
 * leg is `packages/runtime/governance/service.ts` for `kind: envelope-mutation`,
 * which `isDelegableOrdinaryToolAsk` excludes by kind. The ordinary-operation
 * ask lane that minted `leader-approval` legs (`operation-permission/
 * pre-execute-adapter.ts` + `pa-control-bridge.ts`) was deleted by the A1 cut
 * (1617d5839); the survivors (`routeOperationApproval`,
 * `createOperationApprovalFactsReader`) are pure and have no production caller.
 *
 * So this probe authors the COHERENT v5 world the task specifies and measures,
 * live, which of the requested judges the product can actually answer and where
 * the routed wake stops. It never simulates the missing producer: no leg is
 * fabricated, no control route is added to the harness, and the scripted model
 * only plays turns.
 *
 * WHAT IT MEASURES (one command, `--boots N`, default 2, agreeing boots):
 *
 *   1. `d4:enablement` — a v5 Blueprint with an authored `reviewRouting`
 *      (`enabled`, `officerTemplateId: officer`, `ordinaryToolApprovals.default:
 *      officer`) plus `centreStatePath` and an ABSOLUTE `alpha6WakeIntentPath`
 *      is NOT refused (`alpha6EnablementRefusal` returns undefined), the host
 *      boots, the TeamSession exists and `/__p6t6/state` serves it.
 *   2. `d4:officer-up` — the Officer MemberTemplate is delegated to and its
 *      instance comes up (durable member row) with its own bound child session.
 *   3. `d4:officer-binding` — the Officer's OWN tool call is admitted by the
 *      centre under the OFFICER's binding: its `<instanceId>.facts.jsonl` holds
 *      an `invocation-authority` allow for ITS callId with ITS instanceId.
 *   4. `d4:routed-wake` — a worker call that the authored lane marks `ask`
 *      creates the durable control row the management plane notifies on. The
 *      probe records the row's REAL shape (no approvalCaseId / legOrdinal /
 *      reviewAuthority), the recipient the product actually wakes, and whether
 *      any `team-review-wake-routed` / `team-review-wake-delivered` fact or
 *      wake-intent file exists. A case-less row is the measured verdict: the
 *      route cannot be taken and the wake is NOT delivered through the governed
 *      delivery — never reported as a pass.
 *   5. `d4:refusal` — a second, negative boot: the SAME v5 document with the
 *      wake-intent path REMOVED is refused by the closed enablement rule and
 *      the refusal is recorded through the product's own host-surface point.
 *
 * BOOT DISCIPLINE (TEST_METHODS §2/§5/§7): DSH_HOME under the workspace
 * (`tests/homes/u5a5sfdev1-*`), ports from the 3180 family through WorldFactory
 * leases, the pinned host tree read-only (porcelain verified before and after),
 * <= 2 concurrent dev Hosts (`lib/dev-live-slots.mjs`), archive-before-start,
 * teardown by identity, one DEV-LIVE ledger row per start. The stable instance
 * on :3080 and its DSH_HOME are never touched.
 *
 * EVIDENCE HOME: `dev/agent-workflow/evidence/d-boot-feasibility/d4/`.
 *
 * WHAT IS FIXTURE (disclosed): the model is the shared scripted mock
 * (`packages/tools/harness/mock-deepseek.mjs`); its turns are SCRIPTED — this is
 * not a real model. The product path (preset row, realm provider, compiler,
 * centre, settlement store, control service, notifier) is the shipped code the
 * Host loads from `packages/runtime/dist`.
 *
 * CORE PATCH BUDGET = 0.
 *
 * @module tests/world-factory/drivers/d-boot-feasibility/probe-d4-routed-wake
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, writeFileSync,
} from 'node:fs'
import { createConnection } from 'node:net'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

import { apiPrompt, authenticate, emitPatchLayer, fetchJson } from '../../lib/world-factory.mjs'
import { createRunRecord, formatSummary, readAuthorityBinding } from '../../lib/run-record.mjs'
import { selectedHostPin, selectedHostTree } from '../../../next-host/host-select.mjs'
import { createA5sfHarness } from '../../lib/a5sf-harness.mjs'
import { settleDevLiveLease } from '../../lib/dev-live-slots.mjs'
import { preRegisterDevLiveBudget, resolveHeadCommit } from '../../suites/150-a5sf-read.mjs'
import { messagesOf, surfaceNamesOf, textOf } from '../../lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'd-boot-feasibility', 'd4')
const RUNS = join(EVIDENCE, 'runs')
const ARCHIVE = join(EVIDENCE, 'archive')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')
// The FS face's dev-live grant (scope DEV-LIVE, face 'FS Provider', world
// u5a5sfdev1) — a scope authorisation, never a candidate claim.
const GRANT_PATH = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-fs-devlive', 'dev-live-grant.json')

// The product's OWN settlement identity derivation — imported, never re-derived.
const { dispatchExecutionId } = await import(pathToFileURL(join(
  REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'settlement', 'dispatch-settlement.js',
)).href)

const LINE = 'u5a5sfdev1'
const ROOT = 'session-dboot-d4-root'
const BP_ID = 'team.dboot.d4.v5'
const PRESET_ID = 'a5sf-governed-member'
const CENTRE_DIR = 'centre'
const WAKE_DIR = 'alpha6-wake-intent'

const MK_DISC = 'DBOOT_D4_DISC'
const DONE_DISC = 'DBOOT_D4_DISC_DONE'
const MK_OFF = 'DBOOT_D4_DELEGATE_OFFICER'
const DONE_OFF = 'DBOOT_D4_OFFICER_DELEGATED'
const MK_WRK = 'DBOOT_D4_DELEGATE_WORKER'
const DONE_WRK = 'DBOOT_D4_WORKER_DELEGATED'
const MK_RESOLVE = 'DBOOT_D4_RESOLVE_ASK'
const DONE_RESOLVE = 'DBOOT_D4_RESOLVE_DONE'
const TOK_OFF = 'dboot-d4-officer-work'
const TOK_WRK = 'dboot-d4-worker-work'
const DONE_OFFICER_TURN = 'DBOOT_D4_OFFICER_TURN_DONE'
const DONE_WORKER_TURN = 'DBOOT_D4_WORKER_TURN_DONE'
const CALL_OFF_READ = 'call-d4-officer-read'
const CALL_WRK_WRITE = 'call-d4-worker-write'
const CALL_RESOLVE = 'call-d4-leader-resolve'
const OFFICER_TEXT = 'DBOOT_D4_OFFICER_READ_OK'
const WORKER_TEXT = 'DBOOT_D4_WORKER_ASK_CALLED'
const CASE_ID = {
  enablement: 'd4:enablement',
  officerUp: 'd4:officer-up',
  officerBinding: 'd4:officer-binding',
  routedWake: 'd4:routed-wake',
  refusal: 'd4:refusal',
}
const TEAM_TOOL_NAMES = [
  'team_delegate', 'team_collect', 'team_resolve_control', 'team_list_pending_control',
  'team_create_member', 'team_archive_member',
]

const PLAN_MODE = process.argv.includes('--plan')
function bootsWanted() {
  const i = process.argv.indexOf('--boots')
  if (i === -1) return 2
  const n = Number(process.argv[i + 1])
  return Number.isInteger(n) && n >= 1 && n <= 2 ? n : 2
}
const BOOTS_WANTED = bootsWanted()

const startedAt = new Date().toISOString()

function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  console.log(text)
  try {
    mkdirSync(EVIDENCE, { recursive: true })
    appendFileSync(join(EVIDENCE, PLAN_MODE ? 'plan.log' : 'probe.log'), `${text}\n`)
  } catch { /* a fresh clone may not have the evidence dir yet */ }
}

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const parseJsonl = (p) => {
  try {
    return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => {
      try { return JSON.parse(l) } catch { return null }
    }).filter((r) => r !== null)
  } catch { return [] }
}
const redact = (t) => String(t ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const utcStamp = () => new Date().toISOString().replace(/[:.]/gu, '-')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const HOST_PIN = selectedHostPin(REPO_ROOT)
const HOST_TREE = realpathSync(selectedHostTree(REPO_ROOT))
if (realpathSync(HOST_PIN.tree) !== HOST_TREE) {
  throw new Error(`host selector disagreement: tree ${HOST_TREE} != pin tree ${HOST_PIN.tree}`)
}
const require_ = createRequire(import.meta.url)

// ─────────────────────────────────────────────────────────────────────────────
// the shipped composition (the repo's own cordis.patch.yml, !!js evaluated)
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

const layer = shippedLayer()
const COMPOSITION_DROPS = []

// ─────────────────────────────────────────────────────────────────────────────
// the v5 world (host-free parse through the DIST domain facade)
// ─────────────────────────────────────────────────────────────────────────────
function parseBlueprintText(text) {
  const facade = require_(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js'))
  const parse = facade.parseBlueprint
  if (typeof parse !== 'function') throw new Error('the dist runtime bundle exposes no domain parseBlueprint')
  const parsed = parse(text)
  return parsed?.blueprint ?? parsed
}
function assertBlueprintText(text, wantId, label, requireRouting = true) {
  let parsed
  try {
    parsed = parseBlueprintText(text)
  } catch (error) {
    throw new Error(`${label} rejected by the host validator: ${String(error?.message ?? error)}`)
  }
  const schemaVersion = parsed?.schemaVersion ?? null
  const blueprintId = parsed?.blueprintId ?? null
  if (blueprintId !== wantId) throw new Error(`${label}: blueprintId ${JSON.stringify(blueprintId)} != ${JSON.stringify(wantId)}`)
  if (schemaVersion !== 5) throw new Error(`${label}: schemaVersion ${String(schemaVersion)} != 5`)
  const routing = parsed?.reviewRouting ?? null
  if (requireRouting && (routing?.enabled !== true || routing?.officerTemplateId !== 'officer')) {
    throw new Error(`${label}: the authored reviewRouting block did not survive the parse: ${JSON.stringify(routing)}`)
  }
  log(`blueprint ${label} accepted: schemaVersion=${String(schemaVersion)} id=${String(blueprintId)} reviewRouting=${JSON.stringify(routing)}`)
  return { ok: true, schemaVersion, routing }
}

function lane(allow, ask = []) {
  return { mode: 'restricted', allow: [...allow], ask: [...ask], deny: [] }
}

/** The v5 world: leader + officer + worker, an authored ordinary-ask default. */
function v5Doc({ blueprintId, dirs }) {
  return {
    schemaVersion: 5,
    blueprintId,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the dboot d4 probe team. ${MK_DISC} is the discovery marker; ${MK_OFF} delegates the officer; ${MK_WRK} delegates the worker; ${MK_RESOLVE} resolves one pending review ask.`,
    },
    members: [
      { templateId: 'officer', displayName: 'Review Officer', persona: `You are the team's Officer. When woken with a review request, decide it with team_resolve_control. ${TOK_OFF} is your own work marker.` },
      { templateId: 'worker', displayName: 'Governed Worker', persona: `You are governed worker. ${TOK_WRK} is your work marker; perform exactly the tool call your prompt names.` },
    ],
    requirements: [],
    // `resolve-control` is in the closed mutation vocabulary
    // (`admission/envelope.ts#ALL_MUTATION_OPS`): the Leader must be able to
    // settle the pending ask the product hands it (the plain C1 path).
    teamEnvelope: {
      allow: ['create-member', 'assign-task', 'send-message', 'report-progress', 'request-control', 'resolve-control', 'archive-member'],
      deny: [],
    },
    memberEnvelopes: [
      { templateId: 'officer', envelope: { allow: ['send-message', 'report-progress', 'request-control', 'resolve-control'], deny: [] } },
      { templateId: 'worker', envelope: { allow: ['send-message', 'report-progress', 'request-control'], deny: [] } },
    ],
    policyStates: [{ id: 'default', description: 'Default state.' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [
      { templateId: 'officer', io: { read: lane([dirs.dir]), write: lane([dirs.dir]), network: { mode: 'allow' } } },
      // THE DECLARED ORDINARY ASK: the worker's write lane ASKs for its own
      // directory (the shipped v4 grammar's `ask` arm), so one worker write is
      // an ordinary tool ask the control plane has to route.
      { templateId: 'worker', io: { read: lane([dirs.dir]), write: lane([], [dirs.dir]), network: { mode: 'allow' } } },
    ],
    reviewRouting: {
      enabled: true,
      officerTemplateId: 'officer',
      ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
      whenOfficerUnavailable: 'hold',
    },
  }
}
function mainBlueprintYaml({ dirs }) {
  return `---\n${JSON.stringify(v5Doc({ blueprintId: BP_ID, dirs }), null, 2)}\n---\n`
}
/** The SAME v5 core WITHOUT the family that makes the row coherent (negative arm). */
function incoherentBlueprintYaml({ dirs }) {
  const doc = v5Doc({ blueprintId: BP_ID, dirs })
  delete doc.reviewRouting
  return `---\n${JSON.stringify(doc, null, 2)}\n---\n`
}

function p6t6Directive({ worldId, logDir, rootSessionId = ROOT }) {
  return { boot: 1, phase: 'create', reportDir: logDir, runStamp: worldId, rootSessionId }
}

function composedRows({ home, mainYaml, alpha6 }) {
  const hostRow = layer.rows.find((r) => r?.id === 'dsh-agent-team')
  if (hostRow === undefined) throw new Error('the shipped layer carries no dsh-agent-team/host row')
  const presetRow = layer.rows.find((r) => r?.config?.id === PRESET_ID)
  if (presetRow === undefined) throw new Error(`the shipped composition lost the '${PRESET_ID}' preset row`)

  // DEAD SHIPPED SPECIFIER (round 62, still true at this HEAD): the A1 cut
  // deleted `confined-web-tool.mjs` but the preset still names
  // `dsh-agent-team/web-tool`; the row is dropped HERE (recorded verbatim) in
  // the probe's composition. The product file is not touched.
  const webToolTarget = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'confined-web-tool.mjs')
  const presetConfig = JSON.parse(JSON.stringify(presetRow.config))
  if (!existsSync(webToolTarget)) {
    presetConfig.plugins = (presetConfig.plugins ?? []).filter((p) => {
      const dead = p?.name === 'dsh-agent-team/web-tool'
      if (dead) COMPOSITION_DROPS.push({ id: p?.id ?? null, name: p?.name ?? null, reason: 'the cut deleted the module this export targets', target: webToolTarget })
      return dead === false
    })
  }

  const config = {
    ...hostRow.config,
    rootSessionId: ROOT,
    blueprintSource: mainYaml,
    blueprintDir: join(home, 'blueprints'),
    bootPhase: 'create',
    generation: 1,
    seedMembers: [],
    memberPresetId: PRESET_ID,
    a5sfGovernedRealm: true,
    centreStatePath: join(home, CENTRE_DIR),
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    mcpServers: [],
    mcpServer: null,
    a5sfNativeToolModules: [],
    ...(alpha6.enabled
      ? {
          alpha6ReviewRouting: true,
          // ABSOLUTE and inside the owned home: the durable wake-intent
          // directory the enablement rule requires.
          ...(alpha6.wakeIntentPath === undefined ? {} : { alpha6WakeIntentPath: alpha6.wakeIntentPath }),
        }
      : {}),
  }
  return [
    { id: 'dsh-agent-team', name: pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')).href, config },
    { id: 'preset-a5sf-governed-member', name: '@deepseek-ai/dsh-agent-preset', config: presetConfig },
    { id: 'persistent-shell-terminals', name: '@deepseek-ai/dsh-terminal' },
    { id: 'p6t6-team-tools', name: pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// the scripted model (DISCLOSED: scripted, not a real model)
// ─────────────────────────────────────────────────────────────────────────────
function memberTokenOf(record) {
  const users = messagesOf(record).filter((m) => m?.role === 'user')
  for (let i = users.length - 1; i >= 0; i -= 1) {
    const text = textOf(users[i])
    if (!text.includes('[team-work ')) continue
    return [TOK_OFF, TOK_WRK].find((token) => text.includes(token)) ?? null
  }
  return null
}
/**
 * The Leader's CURRENT turn marker. The newest user message is not good
 * enough: after a tool call the loop appends the tool result as a user-role
 * message, so the marker prompt is not always last. Scan the user messages
 * newest-first for the first one that carries one of OUR markers; markers are
 * unique per driver prompt, so the newest marker-bearing text is the turn's.
 */
function lastLeaderMarkerText(record) {
  const markers = [MK_DISC, MK_OFF, MK_WRK, MK_RESOLVE]
  const users = messagesOf(record).filter((m) => m?.role === 'user')
  for (let i = users.length - 1; i >= 0; i -= 1) {
    const text = textOf(users[i])
    if (markers.some((marker) => text.includes(marker))) {
      // Return only the marker's own prompt line: a tool-result body must never
      // be mistaken for a marker's instruction.
      for (const marker of markers) if (text.includes(marker)) return marker
    }
  }
  return ''
}
function isMemberRequest(record) {
  return memberTokenOf(record) !== null
}
function resultIdsOf(record) {
  const ids = new Set()
  for (const message of messagesOf(record)) {
    if (!Array.isArray(message?.content)) continue
    for (const block of message.content) {
      if (block?.type === 'tool_result' && block?.tool_use_id !== undefined) ids.add(String(block.tool_use_id))
    }
  }
  return ids
}
function makeDecide({ paths, ids }) {
  const text = (content) => ({ kind: 'text', content })
  const readCall = (id, filePath) => ({ kind: 'tool-call', toolCalls: [{ id, name: 'read', arguments: { file_path: filePath } }] })
  const writeCall = (id, filePath, content) => ({ kind: 'tool-call', toolCalls: [{ id, name: 'write', arguments: { file_path: filePath, content } }] })
  const resolveCall = (id, requestId) => ({
    kind: 'tool-call',
    toolCalls: [{
      id,
      name: 'team_resolve_control',
      arguments: { rootSessionId: ROOT, requestToken: `dboot-d4-resolve-${String(requestId)}`, requestId, decision: 'allow' },
    }],
  })
  // The SHIPPED `team_delegate` argument shape (packages/tools/src/tools.ts
  // delegateSpec: rootSessionId + requestToken + label + prompt, exactly one of
  // delegationTemplateId / delegationInstanceId; async is the surface default).
  const delegateCall = (id, marker, token, templateId) => ({
    kind: 'tool-call',
    toolCalls: [{
      id,
      name: 'team_delegate',
      arguments: {
        rootSessionId: ROOT,
        requestToken: `dboot-d4-delegate-${templateId}`,
        delegationTemplateId: templateId,
        label: `dboot-d4-${templateId}`,
        prompt: `${token} ${marker}: perform the ONE tool call your instructions name, then report ${marker}.`,
        taskSummary: `dboot d4 probe: ${templateId} work unit`,
      },
    }],
  })

  return function decide({ req }) {
    const token = memberTokenOf(req)
    if (token !== null) {
      const seen = resultIdsOf(req)
      if (token === TOK_OFF) {
        if (!seen.has(CALL_OFF_READ)) return readCall(CALL_OFF_READ, paths.officerFile)
        return text(DONE_OFFICER_TURN)
      }
      if (token === TOK_WRK) {
        if (!seen.has(CALL_WRK_WRITE)) return writeCall(CALL_WRK_WRITE, paths.workerFile, `${WORKER_TEXT}\n`)
        return text(DONE_WORKER_TURN)
      }
      return text('DBOOT_D4_MEMBER_NOOP')
    }

    // Leader turns. The marker is read from the LAST user message only: a
    // marker already spent stays in the conversation history, so scanning the
    // whole transcript would re-fire it on every later turn.
    const leaderText = lastLeaderMarkerText(req)
    const seen = resultIdsOf(req)
    if (leaderText.includes(MK_RESOLVE) && !seen.has(CALL_RESOLVE)) {
      if (ids.pendingRequestId === null) return text('DBOOT_D4_NO_PENDING_REQUEST')
      return resolveCall(CALL_RESOLVE, ids.pendingRequestId)
    }
    // One delegate per marker: after the call's result is in the transcript,
    // the NEXT step of the same turn answers the done marker (the work unit is
    // async, so the Leader is not waiting on the member).
    if (leaderText.includes(MK_WRK)) {
      return seen.has('call-d4-delegate-worker') ? text(DONE_WRK) : delegateCall('call-d4-delegate-worker', DONE_WRK, TOK_WRK, 'worker')
    }
    if (leaderText.includes(MK_OFF)) {
      return seen.has('call-d4-delegate-officer') ? text(DONE_OFF) : delegateCall('call-d4-delegate-officer', DONE_OFF, TOK_OFF, 'officer')
    }
    if (leaderText.includes(MK_DISC)) return text(DONE_DISC)
    // A product-delivered Leader notification (a case-less leader-approval ask
    // under Alpha.6) carries no marker: answer with a text no-op so the turn
    // ends, and let the driver prompt the explicit resolve turn.
    return text('DBOOT_D4_NOOP')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FRESH durable readers (files only, no live process state)
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
    let first = null
    try {
      first = zstdDecompressSync(buf).toString('utf8').split('\n').find((l) => l !== '')
    } catch { first = null }
    if (first === null) continue
    let header = null
    try { header = JSON.parse(first) } catch { header = null }
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
      })
    }
    if (type === 'tool/result') {
      const src = data?.message?.source ?? data?.source ?? {}
      results.push({
        callId: src.callId ?? data?.callId ?? null,
        isError: data?.isError === true || data?.message?.isError === true,
        text: contentText(data?.message?.content ?? data?.content ?? data?.result ?? ''),
      })
    }
  }
  const paired = calls.map((call) => {
    let args = null
    try { args = JSON.parse(call.arguments) } catch { args = null }
    return { callId: call.callId, name: call.name, arguments: args, result: results.find((r) => String(r.callId) === String(call.callId)) ?? null }
  })
  return { sessionId, file: found.file, header: found.header, lineCount: lines.length, user, calls: paired, assistant, finalAssistant: assistant.at(-1) ?? null }
}

function centreDirOf(home) { return join(home, CENTRE_DIR) }
function readLedger(home, instanceId) { return parseJsonl(join(centreDirOf(home), `${instanceId}.facts.jsonl`)) }
function factsFor(ledger, callId, kind = null) {
  return ledger.filter((r) => String(r?.callId ?? '') === String(callId) && (kind === null || r?.kind === kind))
}
function settlementOf(home, instanceId, callId) {
  const executionId = dispatchExecutionId({ rootSessionId: ROOT, agentInstanceId: String(instanceId) }, callId)
  const file = join(centreDirOf(home), 'settlement', String(instanceId), `${executionId}.settlement.json`)
  let envelope = null
  try { envelope = JSON.parse(readFileSync(file, 'utf8')) } catch { envelope = null }
  const record = envelope === null ? null : (envelope.payload ?? envelope)
  return {
    executionId, file, present: record !== null,
    state: record?.state ?? null,
    transitions: Array.isArray(record?.transitions) ? record.transitions.map((t) => t?.to ?? t) : [],
  }
}
/**
 * The TEAMDOMAIN ledger of the booted world, read from disk
 * (`<home>/storages/team_domain.json#tables.ledger`): the facts are stored as
 * JSON strings keyed by sequence. This is where a control request's REAL
 * durable row lives — the `/__p6t6/state` projection omits the case fields, so
 * a judgement about routing identity must read THIS.
 */
function readTeamDomainLedger(home) {
  let doc = null
  try { doc = JSON.parse(readFileSync(join(home, 'storages', 'team_domain.json'), 'utf8')) } catch { return [] }
  const ledger = doc?.tables?.ledger ?? {}
  const rows = []
  for (const [key, value] of Object.entries(ledger)) {
    if (key === '__ledger_sequence_counter') continue
    try { rows.push(typeof value === 'string' ? JSON.parse(value) : value) } catch { /* skip */ }
  }
  return rows.sort((a, b) => Number(a?.sequence ?? 0) - Number(b?.sequence ?? 0))
}
/** The durable control-request row for one requestId (the fact payload as stored). */
function durableControlRow(home, requestId) {
  for (const fact of readTeamDomainLedger(home)) {
    if (fact?.factType !== 'control-request-recorded') continue
    if (String(fact?.payload?.requestId ?? '') === String(requestId)) return { fact, row: fact.payload }
  }
  return null
}
/**
 * Every durable row under the home that carries a given `factType`.
 *
 * TWO stores must be read, or a wake fact would be a false negative:
 *  - `<home>/storages/team_domain.json#tables.ledger` — the TeamDomain ledger,
 *    where `control-request-recorded` and any `team-review-wake-*` fact lands
 *    (each row is a JSON string keyed by sequence);
 *  - the per-instance centre ledgers (`<home>/centre/*.facts.jsonl`), which is
 *    where the admission facts live.
 * A scan of `*.jsonl` alone would MISS every TeamDomain fact — the exact
 * false-negative a wake judgement cannot afford.
 */
function factsOfType(home, factType) {
  const hits = []
  const ledgerFile = join(home, 'storages', 'team_domain.json')
  // TeamDomain rows name the fact `factType`; a CENTRE admission fact names it
  // `kind` (that is the field `factsFor()` filters on). Both are the same
  // durable-fact vocabulary seen from two stores, so both are matched.
  const nameOf = (row) => row?.factType ?? row?.kind ?? row?.type ?? row?.fact?.factType ?? null
  for (const row of readTeamDomainLedger(home)) {
    if (nameOf(row) === factType) hits.push({ file: ledgerFile, row })
  }
  for (const entry of walkFiles(home)) {
    if (!entry.name.endsWith('.jsonl')) continue
    for (const row of parseJsonl(entry.path)) {
      if (nameOf(row) === factType) hits.push({ file: entry.path, row })
    }
  }
  return hits
}
/** Fresh disk scan: which files under the home carry this literal? */
function diskFilesContaining(home, needle) {
  const hits = []
  const bufNeedle = Buffer.from(needle, 'utf8')
  for (const entry of walkFiles(home)) {
    let buf
    try {
      const bytes = readFileSync(entry.path)
      if (bytes.length > 64 * 1024 * 1024) continue
      buf = bytes
    } catch { continue }
    if (buf.includes(bufNeedle)) hits.push({ path: entry.path, bytes: buf.length })
  }
  return hits
}

// ─────────────────────────────────────────────────────────────────────────────
// judges
// ─────────────────────────────────────────────────────────────────────────────
function verdictOf(proposition, clauses) {
  const failing = clauses.filter((c) => c.ok !== true)
  return { proposition, verdict: failing.length === 0 ? 'PROVEN' : 'REFUTED', clauses, failing: failing.map((c) => c.id) }
}
function judgeEnablement({ configGate, booted, state, hostLogText, refusalFacts }) {
  const teamSession = state?.teamSession ?? null
  return verdictOf(
    'a COHERENT Alpha.6 row (v5 reviewRouting + centreStatePath + absolute alpha6WakeIntentPath) is ENABLED — the host boots, the TeamSession exists, and the row is not refused',
    [
      { id: 'enablement-rule-admits', ok: configGate === undefined, detail: `alpha6EnablementRefusal=${JSON.stringify(configGate ?? null)}` },
      { id: 'host-process-boots', ok: booted === true, detail: `booted=${String(booted)}` },
      { id: 'team-session-served', ok: teamSession !== null && String(teamSession?.rootSessionId ?? '') === ROOT && typeof teamSession?.contentHash === 'string', detail: `teamSession=${JSON.stringify(teamSession)}` },
      { id: 'no-alpha6-refusal-in-host-log', ok: !String(hostLogText).includes('ADMISSION_ALPHA6_UNAVAILABLE'), detail: `hostLog has ADMISSION_ALPHA6_UNAVAILABLE=${String(String(hostLogText).includes('ADMISSION_ALPHA6_UNAVAILABLE'))}` },
      { id: 'no-alpha6-refusal-fact', ok: refusalFacts.length === 0, detail: `alpha6 deny facts=${String(refusalFacts.length)}` },
    ],
  )
}
function judgeOfficerUp({ members, officerRow, transcript }) {
  return verdictOf(
    'the Officer MemberTemplate comes up as its own Member instance with a bound child session, and the Officer session actually runs',
    [
      { id: 'officer-member-row', ok: officerRow !== null, detail: `officer template row=${JSON.stringify(officerRow)}; members=${JSON.stringify(members.map((m) => `${m?.templateId}:${m?.instanceId}`))}` },
      { id: 'officer-child-session', ok: typeof officerRow?.childSessionId === 'string' && officerRow.childSessionId.length > 0, detail: `childSessionId=${String(officerRow?.childSessionId)}` },
      { id: 'officer-session-ran', ok: transcript !== null && transcript.calls.some((c) => String(c.name) === 'read'), detail: `calls=${JSON.stringify((transcript?.calls ?? []).map((c) => c.name))}` },
      { id: 'officer-turn-completed', ok: String(transcript?.finalAssistant ?? '').includes(DONE_OFFICER_TURN), detail: `final=${String(transcript?.finalAssistant ?? '').slice(0, 200)}` },
    ],
  )
}
function judgeOfficerBinding({ member, facts, settlement }) {
  const allow = facts.filter((f) => f?.kind === 'invocation-authority' && f?.decision === 'allow')
  const rightInstance = allow.every((f) => String(f?.callId) === CALL_OFF_READ)
  return verdictOf(
    'the Officer\'s OWN tool call is admitted by the ONE centre under the OFFICER\'s binding: an allow invocation-authority fact for ITS callId in the OFFICER\'s own ledger, settled COMPLETED',
    [
      { id: 'officer-ledger-fact', ok: allow.length === 1, detail: `allow facts=${JSON.stringify(allow.map((f) => ({ axis: f.axis, callId: f.callId, decision: f.decision })))}` },
      { id: 'fact-names-officer-call', ok: rightInstance, detail: `callIds=${JSON.stringify(allow.map((f) => f.callId))}` },
      { id: 'officer-settlement-completed', ok: settlement?.state === 'COMPLETED', detail: `settlement state=${String(settlement?.state)} transitions=${JSON.stringify(settlement?.transitions ?? [])}` },
      { id: 'officer-not-the-leader', ok: String(member?.instanceId ?? '') !== '' && String(member?.templateId ?? '') === 'officer', detail: `instanceId=${String(member?.instanceId)} template=${String(member?.templateId)}` },
    ],
  )
}
function judgeRoutedWake({ durableRow, routeProbe, wakeFacts, wakeIntentFiles, officerTranscript, leaderTranscript, leaderNotificationText }) {
  const row = durableRow?.row ?? null
  const rowShape = row === null ? null : {
    requestId: row?.requestId ?? null,
    kind: row?.kind ?? null,
    actionName: row?.actionName ?? null,
    targetInstanceId: row?.targetInstanceId ?? null,
    toolName: row?.toolName ?? null,
    summary: row?.summary ?? null,
    approvalCaseId: row?.approvalCaseId ?? null,
    legOrdinal: row?.legOrdinal ?? null,
    reviewAuthority: row?.reviewAuthority ?? null,
    operationFingerprint: row?.operationFingerprint ?? null,
    requestedEffect: row?.requestedEffect ?? null,
    blueprintContentHash: row?.blueprintContentHash ?? null,
  }
  const officerWoken = String(officerTranscript?.userText ?? '').includes('[team-review-wake')
  return verdictOf(
    'the routed review decision is taken from the durable control row and the wake is DELIVERED through the governed delivery (team-review-wake-routed intent + team-review-wake-delivered confirmation, machine attribution), with the Officer woken in its own session',
    [
      { id: 'ordinary-tool-ask-created', ok: row !== null && row?.kind === 'leader-approval', detail: `durable row=${JSON.stringify(rowShape)}` },
      // THE CASE IDENTITY IS THE ROUTE'S PRECONDITION (`alpha6/root-router.ts`):
      // without it `route()` answers null and the notifier takes the case-less
      // Leader branch, so no Alpha.6 route can exist for this row.
      { id: 'row-carries-approval-case', ok: typeof row?.approvalCaseId === 'string' && row.approvalCaseId.length > 0 && typeof row?.legOrdinal === 'number', detail: `approvalCaseId=${JSON.stringify(row?.approvalCaseId ?? null)} legOrdinal=${JSON.stringify(row?.legOrdinal ?? null)} reviewAuthority=${JSON.stringify(row?.reviewAuthority ?? null)}` },
      // THE PRODUCT'S OWN ROUTER, evaluated in-process on the durable row it
      // just wrote: null means the ONE policy declines to route it at all.
      { id: 'product-router-declines-the-durable-row', ok: routeProbe?.route === null, detail: `createAlpha6RootRouter.route()=${JSON.stringify(routeProbe?.route ?? null)} memberListCalls=${String(routeProbe?.memberListCalls)} error=${String(routeProbe?.error ?? null)}` },
      { id: 'wake-intent-fact-routed', ok: wakeFacts.some((entry) => entry.factType === 'team-review-wake-routed'), detail: `wake facts=${JSON.stringify(wakeFacts.map((w) => w.factType))}` },
      { id: 'wake-confirmed-delivered', ok: wakeFacts.some((entry) => entry.factType === 'team-review-wake-delivered'), detail: `wake facts=${JSON.stringify(wakeFacts.map((w) => w.factType))}` },
      { id: 'wake-intent-file-written', ok: wakeIntentFiles.length > 0, detail: `intent files=${JSON.stringify(wakeIntentFiles)}` },
      { id: 'officer-woken-in-its-session', ok: officerWoken, detail: `officer user text=${JSON.stringify(String(officerTranscript?.userText ?? '').slice(0, 300))}` },
      // The delivered wake would have to be a MACHINE input (A56). With zero
      // wakes there is no input to attribute: the clause is NOT_REACHED, and it
      // stays a failing clause because the judge's proposition is not met.
      { id: 'wake-has-machine-attribution', ok: wakeFacts.length > 0 && wakeFacts.every((entry) => entry?.payload?.source === 'plugin:dsh-agent-team'), detail: `wake facts=${String(wakeFacts.length)}; no wake ⇒ no machine input to attribute` },
      // THE MEASURED BRANCH: the plain C1 ask reached the LEADER instead.
      { id: 'leader-received-the-plain-c1-ask', ok: String(leaderNotificationText).includes('[team-control') && String(leaderNotificationText).includes('Leader approval'), detail: `leader notification=${JSON.stringify(String(leaderNotificationText).slice(0, 300))}` },
      { id: 'no-review-wake-to-the-leader', ok: !String(leaderTranscript?.userText ?? '').includes('[team-review-wake'), detail: `leader got a review wake=${String(String(leaderTranscript?.userText ?? '').includes('[team-review-wake'))}` },
    ],
  )
}
function judgeRefusal({ configGate, booted, hostLogText, refusalFacts, wakeIntentFiles }) {
  const deny = refusalFacts.filter((f) => f?.decision === 'deny' && f?.refusalCode === 'ADMISSION_ALPHA6_UNAVAILABLE')
  return verdictOf(
    'the refusal side still works for an incoherent row: the SAME v5 document WITHOUT the absolute wake-intent path is refused by the closed enablement rule, the refusal is recorded, the team is absent and no wake exists',
    [
      { id: 'refusal-rule-fires', ok: typeof configGate === 'string' && configGate.startsWith('ADMISSION_ALPHA6_UNAVAILABLE'), detail: `alpha6EnablementRefusal/centreConfigViolation=${JSON.stringify(String(configGate ?? '').slice(0, 400))}` },
      { id: 'refusal-recorded', ok: deny.length >= 1, detail: `deny facts=${JSON.stringify(deny.map((f) => ({ refusalCode: f.refusalCode, axis: f.axis, callId: f.callId })))}` },
      { id: 'refusal-is-not-a-route', ok: wakeIntentFiles.length === 0, detail: `intent files=${JSON.stringify(wakeIntentFiles)}` },
      { id: 'host-log-carries-code', ok: String(hostLogText).includes('ADMISSION_ALPHA6_UNAVAILABLE'), detail: `host log carries the code=${String(String(hostLogText).includes('ADMISSION_ALPHA6_UNAVAILABLE'))} (host=${String(booted)})` },
    ],
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// port / health helpers
// ─────────────────────────────────────────────────────────────────────────────
async function waitHealthy(origin, cookie, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let last = null
  for (;;) {
    try {
      const res = await fetchJson(`${origin}/__p6t6/health`, { headers: { cookie } }, 5000)
      last = res?.body ?? null
      if (res?.status === 200 && last?.ok === true) return { ok: true, body: last }
      if (res?.status === 200 && last?.ok === false && last?.setupError !== undefined) return { ok: false, body: last }
    } catch { /* still starting */ }
    if (Date.now() >= deadline) return { ok: false, body: last, timeout: true }
    await sleep(250)
  }
}
async function readState(origin, cookie) {
  const res = await fetchJson(`${origin}/__p6t6/state`, { headers: { cookie } }, 20_000)
  return res?.body ?? null
}
function membersOf(state) {
  const list = state?.members ?? []
  return Array.isArray(list) ? list : []
}
function pendingAskOf(state, instanceId) {
  const raw = state?.control?.requests ?? []
  const list = Array.isArray(raw) ? raw : Object.values(raw)
  return list.find((r) => String(r?.targetInstanceId ?? '') === String(instanceId) && String(r?.status ?? 'pending') === 'pending') ?? null
}
function hostPorcelain() {
  try {
    return execFileSync('git', ['-C', HOST_TREE, 'status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch { return ['git status failed'] }
}
function hostDigest() {
  try { return execFileSync('git', ['-C', HOST_TREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// plan (host-free)
// ─────────────────────────────────────────────────────────────────────────────
async function planOnly() {
  log(`PLAN repo=${REPO_ROOT} hostTree=${HOST_TREE} pin=${HOST_PIN.sha}`)
  const dirs = { dir: join(EVIDENCE, 'plan-workspace', 'team') }
  const main = assertBlueprintText(mainBlueprintYaml({ dirs }), BP_ID, 'main.yaml')
  const incoherent = assertBlueprintText(incoherentBlueprintYaml({ dirs }), BP_ID, 'incoherent.yaml', false)
  log(`incoherent doc reviewRouting=${JSON.stringify(incoherent.routing ?? null)} (must be absent)`)
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), mainYaml: mainBlueprintYaml({ dirs }), alpha6: { enabled: true, wakeIntentPath: join(EVIDENCE, 'plan-home', WAKE_DIR) } })
  mkdirSync(join(EVIDENCE, 'plan'), { recursive: true })
  writeFileSync(join(EVIDENCE, 'plan', 'plan-patch.yml'), `${emitPatchLayer(['dboot d4 probe plan (no World)'], rows)}\n`)
  const hostRow = rows[0]
  log(`host row config keys: ${JSON.stringify(Object.keys(hostRow.config ?? {}))}`)
  for (const key of ['alpha6ReviewRouting', 'alpha6WakeIntentPath', 'centreStatePath']) {
    if (hostRow.config?.[key] === undefined) throw new Error(`the planned row lost '${key}'`)
  }
  log(`row: alpha6ReviewRouting=${String(hostRow.config.alpha6ReviewRouting)} wakeIntent=${hostRow.config.alpha6WakeIntentPath} centre=${hostRow.config.centreStatePath}`)
  // The PRODUCT's own closed enablement rule, evaluated HOST-FREE on the exact
  // two documents this probe boots: the coherent row must be admitted (no
  // violation) and the incoherent row must be refused BY NAME. This is the rule
  // the live rows are measured against, not a re-implementation of it.
  const { centreConfigViolation } = await import(pathToFileURL(join(
    REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'vnext', 'centre-config.js',
  )).href)
  const absoluteWake = join(EVIDENCE, 'plan-home', WAKE_DIR)
  const positiveGate = centreConfigViolation({
    alpha6ReviewRouting: true,
    centreStatePath: join(EVIDENCE, 'plan-home', CENTRE_DIR),
    alpha6WakeIntentPath: absoluteWake,
    blueprintSource: mainBlueprintYaml({ dirs }),
  })
  const negativeGate = centreConfigViolation({
    alpha6ReviewRouting: true,
    centreStatePath: join(EVIDENCE, 'plan-home', CENTRE_DIR),
    blueprintSource: incoherentBlueprintYaml({ dirs }),
  })
  const negativeRoutingGate = centreConfigViolation({
    alpha6ReviewRouting: true,
    centreStatePath: join(EVIDENCE, 'plan-home', CENTRE_DIR),
    blueprintSource: mainBlueprintYaml({ dirs }),
  })
  const rule = {
    positive: positiveGate ?? null,
    negativeNoRoutingNoWakePath: negativeGate ?? null,
    negativeNoWakePath: negativeRoutingGate ?? null,
  }
  writeFileSync(join(EVIDENCE, 'plan', 'enablement-rule.json'), `${JSON.stringify(rule, null, 2)}\n`)
  log(`enablement rule: ${JSON.stringify(rule)}`)
  if (rule.positive !== null) throw new Error(`the coherent row is REFUSED by the product rule: ${JSON.stringify(rule.positive)}`)
  if (rule.negativeNoRoutingNoWakePath === null || rule.negativeNoWakePath === null) {
    throw new Error('the incoherent rows are NOT refused by the product rule — the negative arm would be vacuous')
  }
  log(`blueprints accepted: ${JSON.stringify({ main, incoherent: incoherent.ok })}`)
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// one boot
// ─────────────────────────────────────────────────────────────────────────────
async function probeOnce({ index, head, grant }) {
  const bootDir = join(RUNS, `boot${String(index).padStart(2, '0')}`)
  mkdirSync(bootDir, { recursive: true })
  const phase = `a5sf-live-d4-boot${String(index)}`
  const runId = `a5sf-live-d4-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId,
    suite: 'a5sf-live-d4-probe',
    selectedCases: ['d4:enablement', 'd4:officer-up', 'd4:officer-binding', 'd4:routed-wake', 'd4:refusal'],
    bindings: runBindings(head, grant),
    ledgerPath: LEDGER_PATH,
    recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-live-d4-probe', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const lease = await preRegisterDevLiveBudget({
    grantPath: GRANT_PATH, headCommit: head, runRecord: record,
    face: 'FS Provider', world: LINE, leaseRoot: factory.leaseRoot, // TWO host starts per probe iteration: the coherent row and the refusal row.
    requiredBoots: 2,
  })
  log(`[boot${String(index)}] dev-live lease grant=${lease.grant.grantId} world=${LINE} head=${head}`)

  const { centreConfigViolation } = await import(pathToFileURL(join(
    REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'vnext', 'centre-config.js',
  )).href)

  const dirs = { dir: join(EVIDENCE, 'runs-workspace', `boot${String(index)}`) }
  mkdirSync(dirs.dir, { recursive: true })
  const paths = {
    dir: dirs.dir,
    officerFile: join(dirs.dir, 'officer-read.txt'),
    workerFile: join(dirs.dir, 'worker-ask.txt'),
  }
  writeFileSync(paths.officerFile, 'DBOOT_D4_OFFICER_READ_SOURCE\n', 'utf8')

  const ids = { officer: null, worker: null, pendingRequestId: null }
  let world = null
  let refusalWorld = null
  let teardown = null
  let refusalTeardown = null
  let result = null
  let failure = null
  const startedBoot = Date.now()

  try {
    // ── the POSITIVE world: one coherent v5 row ──
    const boot = await lease.boot(async () => {
      const wakeIntentPath = join(join(EVIDENCE, 'runs-workspace', `boot${String(index)}`), WAKE_DIR)
      const main = mainBlueprintYaml({ dirs })
      assertBlueprintText(main, BP_ID, 'main.yaml')
      const configGate = centreConfigViolation({
        alpha6ReviewRouting: true,
        centreStatePath: join(EVIDENCE, 'runs-workspace', `boot${String(index)}`, "centre"),
        alpha6WakeIntentPath: wakeIntentPath,
        blueprintSource: main,
      })
      log(`[boot${String(index)}] alpha6 config gate (positive): ${JSON.stringify(configGate ?? null)}`)
      writeFileSync(join(bootDir, 'enablement.json'), `${JSON.stringify({ configGate: configGate ?? null, wakeIntentPath, centreStatePath: join(EVIDENCE, 'runs-workspace', `boot${String(index)}`, 'centre') }, null, 2)}\n`)
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      mkdirSync(world.workspaceDir, { recursive: true })
      mkdirSync(join(world.home, 'blueprints'), { recursive: true })
      writeFileSync(join(world.home, 'blueprints', 'main.yaml'), main)
      writeFileSync(join(world.home, 'p6t6-directive.json'), `${JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2)}\n`)
      world.u6Fs.rows.push(...composedRows({ home: world.home, mainYaml: main, alpha6: { enabled: true, wakeIntentPath: join(world.home, WAKE_DIR) } }))
      record.record.bindings.compositionDrops = COMPOSITION_DROPS
      writeFileSync(join(bootDir, 'composition-drops.json'), `${JSON.stringify(COMPOSITION_DROPS, null, 2)}\n`)
      await world.startMock({ decide: makeDecide({ paths, ids }) })
      return harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })
    const origin = new URL(boot.url).origin
    const cookie = await authenticate(origin, world.token)
    const health = await waitHealthy(origin, cookie, 120_000)
    if (health?.ok !== true) throw new Error(`the booted host never became ready: ${JSON.stringify(health?.body ?? null).slice(0, 800)}`)
    log(`[boot${String(index)}] host ready on ${origin}`)

    const requests = () => world.mock?.requests ?? []
    const replyOf = (r) => String(r?.reply?.content ?? '')
    const sawReply = (marker) => requests().some((r) => replyOf(r).trim().startsWith(marker))
    const waitFor = async (predicate, timeoutMs, everyMs = 200) => {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        let hit = false
        try { hit = (await predicate()) === true } catch { hit = false }
        if (hit) return true
        if (Date.now() >= deadline) return false
        await sleep(everyMs)
      }
    }
    const promptTurn = async (marker, tag) => {
      const res = await apiPrompt(origin, cookie, ROOT, marker, tag)
      log(`[boot${String(index)}] prompt(${tag}) status=${String(res?.status)}`)
      if (res?.status !== 200) throw new Error(`session/prompt(${tag}) failed: status=${String(res?.status)} body=${redact(JSON.stringify(res?.body ?? null)).slice(0, 500)}`)
    }

    // ── discovery ──
    await promptTurn(MK_DISC, 'd4disc')
    if (!(await waitFor(() => sawReply(DONE_DISC), 120_000))) throw new Error('the Leader discovery turn never answered')
    log(`[boot${String(index)}] discovery answered (mock requests=${String(requests().length)})`)
    const discovery = requests().filter((r) => surfaceNamesOf(r).length > 0 && !isMemberRequest(r)).at(-1) ?? null
    const leaderSurface = discovery === null ? [] : surfaceNamesOf(discovery)
    writeFileSync(join(bootDir, 'leader-surface.json'), `${JSON.stringify(leaderSurface, null, 2)}\n`)
    for (const required of TEAM_TOOL_NAMES) {
      if (!leaderSurface.includes(required)) throw new Error(`the Leader surface lost '${required}'`)
    }

    // ── the Officer: delegated, up, and its own call admitted ──
    await promptTurn(MK_OFF, 'd4off')
    if (!(await waitFor(() => sawReply(DONE_OFF), 120_000))) throw new Error('the officer delegation turn never answered the delegate call')
    log(`[boot${String(index)}] officer delegated`)
    const officerRowFound = await waitFor(async () => {
      const st = await readState(origin, cookie)
      return membersOf(st).some((m) => String(m?.templateId ?? '') === 'officer')
    }, 120_000, 300)
    if (!officerRowFound) throw new Error('the Officer MemberTemplate never came up as an instance')
    let state = await readState(origin, cookie)
    const officerRow = membersOf(state).find((m) => String(m?.templateId ?? '') === 'officer') ?? null
    ids.officer = String(officerRow.instanceId)
    writeFileSync(join(bootDir, 'members-officer.json'), `${JSON.stringify(membersOf(state), null, 2)}\n`)
    log(`[boot${String(index)}] officer instance=${ids.officer} childSession=${String(officerRow.childSessionId)}`)
    const officerReady = await waitFor(() => {
      const tx = readMemberTranscript(world.home, String(officerRow.childSessionId))
      return String(tx?.finalAssistant ?? '').includes(DONE_OFFICER_TURN)
    }, 180_000, 500)
    if (!officerReady) throw new Error('the Officer session never finished its own tool turn')
    const officerTranscript = readMemberTranscript(world.home, String(officerRow.childSessionId))
    writeFileSync(join(bootDir, 'officer-transcript.json'), `${JSON.stringify(officerTranscript, null, 2)}\n`)
    const officerLedger = readLedger(world.home, ids.officer)
    writeFileSync(join(bootDir, 'officer-ledger.json'), `${JSON.stringify(officerLedger, null, 2)}\n`)
    const officerSettlement = settlementOf(world.home, ids.officer, CALL_OFF_READ)
    writeFileSync(join(bootDir, 'officer-settlement.json'), `${JSON.stringify(officerSettlement, null, 2)}\n`)
    const officerVerdict = judgeOfficerBinding({
      member: officerRow, facts: factsFor(officerLedger, CALL_OFF_READ), settlement: officerSettlement,
    })
    const officerUpVerdict = judgeOfficerUp({ members: membersOf(state), officerRow, transcript: officerTranscript })
    writeFileSync(join(bootDir, 'verdicts-officer.json'), `${JSON.stringify({ officerUp: officerUpVerdict, officerBinding: officerVerdict }, null, 2)}\n`)
    log(`[boot${String(index)}] d4:officer-up=${officerUpVerdict.verdict} d4:officer-binding=${officerVerdict.verdict}`)

    // ── the worker ask: the ordinary tool ask the router would have to route ──
    await promptTurn(MK_WRK, 'd4wrk')
    if (!(await waitFor(() => sawReply(DONE_WRK), 120_000))) throw new Error('the worker delegation turn never answered the delegate call')
    log(`[boot${String(index)}] worker delegated`)
    const workerUp = await waitFor(async () => {
      const st = await readState(origin, cookie)
      return membersOf(st).some((m) => String(m?.templateId ?? '') === 'worker')
    }, 120_000, 300)
    if (!workerUp) throw new Error('the worker MemberTemplate never came up as an instance')
    state = await readState(origin, cookie)
    const workerRow = membersOf(state).find((m) => String(m?.templateId ?? '') === 'worker') ?? null
    ids.worker = String(workerRow.instanceId)
    const askAppeared = await waitFor(async () => {
      const st = await readState(origin, cookie)
      const row = pendingAskOf(st, ids.worker)
      if (row !== null && ids.pendingRequestId === null) ids.pendingRequestId = String(row.requestId)
      return row !== null
    }, 180_000, 300)
    state = await readState(origin, cookie)
    const askRow = pendingAskOf(state, ids.worker)
    writeFileSync(join(bootDir, 'control-ask.json'), `${JSON.stringify({ askAppeared, ids, askRow, requests: state?.control?.requests ?? [] }, null, 2)}\n`)
    log(`[boot${String(index)}] worker ask appeared=${String(askAppeared)} requestId=${String(ids.pendingRequestId)}`)

    // The durable row's REAL shape, read from the TeamDomain ledger (the state
    // route does not expose the case fields). This is the fact the router
    // routes on; it is read from disk, never inferred.
    const durable = ids.pendingRequestId === null ? null : durableControlRow(world.home, ids.pendingRequestId)
    const ledgerRows = readTeamDomainLedger(world.home)
    writeFileSync(join(bootDir, 'control-row-durable.json'), `${JSON.stringify({
      requestId: ids.pendingRequestId,
      durable,
      ledger: ledgerRows,
    }, null, 2)}\n`)

    // ── the Leader resolves the pending ask exactly as a human/leader would ──
    let resolveOutcome = null
    if (ids.pendingRequestId !== null) {
      await promptTurn(MK_RESOLVE, 'd4res')
      await waitFor(() => sawReply(DONE_RESOLVE), 120_000)
      // The Leader's OWN team tool result is the answer: it says whether the
      // plain C1 ask could be settled at all.
      const leaderTxNow = readMemberTranscript(world.home, ROOT)
      const resolveCall = (leaderTxNow?.calls ?? []).find((c) => String(c.callId) === CALL_RESOLVE) ?? null
      resolveOutcome = { call: resolveCall?.arguments ?? null, result: resolveCall?.result?.text?.slice(0, 800) ?? null, isError: resolveCall?.result?.isError ?? null }
      log(`[boot${String(index)}] leader resolve result: ${String(resolveOutcome.result).slice(0, 200)}`)
    }

    // ── the governed delivery should have happened by now: measure it ──
    await sleep(1500)
    const officerTxAfter = readMemberTranscript(world.home, String(officerRow.childSessionId))
    const leaderTx = readMemberTranscript(world.home, ROOT)
    const leaderUserText = (leaderTx?.user ?? []).join('\n')
    const officerUserText = (officerTxAfter?.user ?? []).join('\n')
    const wakeFacts = [
      ...factsOfType(world.home, 'team-review-wake-routed'),
      ...factsOfType(world.home, 'team-review-wake-delivered'),
    ].map((h) => ({ factType: h.row.factType ?? h.row.type, file: h.file, payload: h.row.payload ?? null }))
    // The scan's own positive control: the fact types the SAME reader found in
    // the SAME stores. A reader that finds nothing at all is broken, not proof.
    const factTypeCensus = {}
    for (const fact of readTeamDomainLedger(world.home)) {
      const key = String(fact?.factType ?? fact?.type ?? 'unknown')
      factTypeCensus[key] = (factTypeCensus[key] ?? 0) + 1
    }
    const wakeIntentDir = join(world.home, WAKE_DIR)
    let wakeIntentFiles = []
    try { wakeIntentFiles = readdirSync(wakeIntentDir) } catch { wakeIntentFiles = [] }
    const reviewWakeHits = diskFilesContaining(world.home, '[team-review-wake')
    // THE BRANCH EVIDENCE: the product delivered the plain C1 ask to the Leader
    // (`[team-control … waiting for Leader approval`), which is exactly the
    // case-less branch of `createComposedControlNotifier`.
    const leaderNotification = (leaderTx?.user ?? []).find((text) => String(text).includes('[team-control')) ?? ''
    writeFileSync(join(bootDir, 'leader-notification.txt'), `${String(leaderNotification)}\n`)

    // ── THE PRODUCT'S OWN ROUTER, on the durable row it just wrote ──
    // `createAlpha6RootRouter.route()` is the ONE shared policy entry point; it
    // is evaluated in-process against the SAME durable facts and the SAME v5
    // policy the boot used. `memberListCalls` proves the member view was never
    // consulted (the row is rejected before the officer query).
    let routeProbe = null
    try {
      const { createAlpha6RootRouter } = await import(pathToFileURL(join(
        REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'alpha6', 'root-router.js',
      )).href)
      const { parseAlpha6Routing } = await import(pathToFileURL(join(
        REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'alpha6', 'composition.js',
      )).href)
      const parsed = parseAlpha6Routing(mainBlueprintYaml({ dirs }))
      if (parsed === null) throw new Error('the v5 policy did not parse for the router probe')
      let memberListCalls = 0
      const router = createAlpha6RootRouter({
        rootSessionId: ROOT,
        routing: parsed.routing,
        leaderTemplateId: parsed.blueprint.leader.templateId,
        control: {
          readControlState: async () => ({
            requests: ledgerRows
              .filter((fact) => fact?.factType === 'control-request-recorded')
              .map((fact) => fact.payload),
            decisions: [],
            consumptions: [],
            transfers: [],
          }),
        },
        members: {
          list: async () => { memberListCalls += 1; return [] },
          get: async () => { memberListCalls += 1; return undefined },
        },
        fixedLeaderOrHumanCategory: () => false,
      })
      const route = await router.route(String(ids.pendingRequestId))
      routeProbe = { route, memberListCalls }
    } catch (error) {
      routeProbe = { route: 'ERROR', memberListCalls: 0, error: String(error?.message ?? error) }
    }
    writeFileSync(join(bootDir, 'route-probe.json'), `${JSON.stringify(routeProbe, null, 2)}\n`)

    // Was the ask resolvable at all through the plain C1 path?
    const workerTxAfter = readMemberTranscript(world.home, String(workerRow.childSessionId))
    const workerWrite = (workerTxAfter?.calls ?? []).find((c) => String(c.callId) === CALL_WRK_WRITE) ?? null
    writeFileSync(join(bootDir, 'wake-measurement.json'), `${JSON.stringify({
      ids, resolveOutcome,
      durableRowShape: durable?.row ?? null,
      routeProbe,
      factTypeCensus,
      wakeFacts, wakeIntentFiles,
      reviewWakeHits: reviewWakeHits.map((h) => h.path),
      officerUserText: officerUserText.slice(0, 4000),
      leaderUserTextHead: leaderUserText.slice(0, 2000),
      leaderNotification: leaderNotification.slice(0, 1200),
      workerWrite: { arguments: workerWrite?.arguments ?? null, result: workerWrite?.result?.text?.slice(0, 600) ?? null, isError: workerWrite?.result?.isError ?? null },
      workerFileExists: existsSync(paths.workerFile),
    }, null, 2)}\n`)

    if (factTypeCensus['control-request-recorded'] !== 1) {
      throw new Error(`the durable reader is not reading the TeamDomain ledger: control-request-recorded count=${String(factTypeCensus['control-request-recorded'])} census=${JSON.stringify(factTypeCensus)}`)
    }
    const routedVerdict = judgeRoutedWake({
      durableRow: durable,
      routeProbe,
      wakeFacts,
      wakeIntentFiles,
      officerTranscript: { userText: officerUserText },
      leaderTranscript: { userText: leaderUserText },
      leaderNotificationText: leaderNotification,
    })
    log(`[boot${String(index)}] d4:routed-wake=${routedVerdict.verdict} failing=${JSON.stringify(routedVerdict.failing)}`)
    fnWriteVerdict(bootDir, 'routed', routedVerdict)

    // ── the NEGATIVE world: the same v5 doc without the absolute wake path ──
    const refusalDepart = await lease.boot(async () => {
      const incoherent = incoherentBlueprintYaml({ dirs })
      assertBlueprintText(incoherent, BP_ID, 'incoherent.yaml', false)
      const gate = centreConfigViolation({
        alpha6ReviewRouting: true,
        centreStatePath: join(EVIDENCE, 'runs-workspace', `boot${String(index)}`, 'refusal-centre'),
        blueprintSource: incoherent,
      })
      writeFileSync(join(bootDir, 'refusal-enablement.json'), `${JSON.stringify({ configGate: gate ?? null }, null, 2)}\n`)
      refusalWorld = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      mkdirSync(refusalWorld.workspaceDir, { recursive: true })
      mkdirSync(join(refusalWorld.home, 'blueprints'), { recursive: true })
      writeFileSync(join(refusalWorld.home, 'blueprints', 'main.yaml'), incoherent)
      writeFileSync(join(refusalWorld.home, 'p6t6-directive.json'), `${JSON.stringify(p6t6Directive({ worldId: refusalWorld.id, logDir: refusalWorld.logDir }), null, 2)}\n`)
      refusalWorld.u6Fs.rows.push(...composedRows({ home: refusalWorld.home, mainYaml: incoherent, alpha6: { enabled: true } }))
      await refusalWorld.startMock({ decide: () => ({ kind: 'text', content: 'the refusal arm never reaches a model call' }) })
      let threw = false
      let errorText = ''
      let url = null
      try {
        const booted = await harness.boot({ world: refusalWorld, phase: `${phase}-refusal`, bootTimeoutMs: 180_000 })
        url = booted.url
      } catch (error) {
        threw = true
        errorText = String(error?.message ?? error)
      }
      return { refusedBoot: { threw, errorText, url } }
    })
    let refusalLogText = ''
    try { refusalLogText = readFileSync(refusalWorld.instance?.logPath ?? '', 'utf8') } catch { refusalLogText = '' }
    const refusalFacts = factsOfType(refusalWorld.home, 'invocation-authority')
      .map((h) => h.row)
      .filter((row) => String(row?.refusalCode ?? '') === 'ADMISSION_ALPHA6_UNAVAILABLE')
    const refusalIntentDir = join(refusalWorld.home, WAKE_DIR)
    let refusalIntentFiles = []
    try { refusalIntentFiles = readdirSync(refusalIntentDir) } catch { refusalIntentFiles = [] }
    writeFileSync(join(bootDir, 'refusal-arm.json'), `${JSON.stringify({
      configGate: centreConfigViolation({
        alpha6ReviewRouting: true,
        centreStatePath: join(EVIDENCE, 'runs-workspace', `boot${String(index)}`, 'refusal-centre'),
        blueprintSource: incoherentBlueprintYaml({ dirs }),
      }) ?? null,
      boot: refusalDepart?.refusedBoot ?? null,
      refusalFacts,
      wakeIntentFiles: refusalIntentFiles,
      hostLogTail: refusalLogText.slice(-4000),
    }, null, 2)}\n`)
    const refusalVerdict = judgeRefusal({
      configGate: centreConfigViolation({
        alpha6ReviewRouting: true,
        centreStatePath: join(EVIDENCE, 'runs-workspace', `boot${String(index)}`, 'refusal-centre'),
        blueprintSource: incoherentBlueprintYaml({ dirs }),
      }),
      booted: refusalDepart?.refusedBoot?.threw !== true,
      hostLogText: refusalLogText,
      refusalFacts,
      wakeIntentFiles: refusalIntentFiles,
    })
    log(`[boot${String(index)}] d4:refusal=${refusalVerdict.verdict} failing=${JSON.stringify(refusalVerdict.failing)}`)

    // ── enablement verdict (positive) ──
    let positiveLogText = ''
    try { positiveLogText = readFileSync(world.instance?.logPath ?? '', 'utf8') } catch { positiveLogText = '' }
    const positiveRefusalFacts = factsOfType(world.home, 'invocation-authority')
      .map((h) => h.row)
      .filter((row) => String(row?.refusalCode ?? '') === 'ADMISSION_ALPHA6_UNAVAILABLE')
    const enablementVerdict = judgeEnablement({
      configGate: null,
      booted: true,
      state,
      hostLogText: positiveLogText,
      refusalFacts: positiveRefusalFacts,
    })
    // `configGate` in the judge is the in-process rule answer captured above;
    // re-read it so the verdict clause is the rule's own output.
    const gate = centreConfigViolation({
      alpha6ReviewRouting: true,
      centreStatePath: join(world.home, CENTRE_DIR),
      alpha6WakeIntentPath: join(world.home, WAKE_DIR),
      blueprintSource: mainBlueprintYaml({ dirs }),
    })
    enablementVerdict.clauses[0] = { id: 'enablement-rule-admits', ok: gate === undefined, detail: `alpha6EnablementRefusal=${JSON.stringify(gate ?? null)}` }
    enablementVerdict.verdict = enablementVerdict.clauses.every((c) => c.ok === true) ? 'PROVEN' : 'REFUTED'
    enablementVerdict.failing = enablementVerdict.clauses.filter((c) => c.ok !== true).map((c) => c.id)
    log(`[boot${String(index)}] d4:enablement=${enablementVerdict.verdict} failing=${JSON.stringify(enablementVerdict.failing)}`)

    const verdicts = {
      enablement: enablementVerdict,
      officerUp: officerUpVerdict,
      officerBinding: officerVerdict,
      routedWake: routedVerdict,
      refusal: refusalVerdict,
    }
    const overall = Object.values(verdicts).every((v) => v.verdict === 'PROVEN') ? 'PASS' : 'BLOCKED'
    result = {
      boot: index,
      overall,
      verdicts,
      counters: {
        askAppeared,
        pendingRequestId: ids.pendingRequestId,
        wakeFacts: wakeFacts.length,
        wakeIntentFiles: wakeIntentFiles.length,
        reviewWakeHits: reviewWakeHits.length,
        officerAllowFacts: factsFor(officerLedger, CALL_OFF_READ).filter((f) => f?.kind === 'invocation-authority' && f?.decision === 'allow').length,
      },
      ids: { ...ids },
      worldId: world.id,
      home: world.home,
      port: boot.port,
      logPath: boot.logPath,
      refusalWorldId: refusalWorld.id,
      bootedAt: startedBoot,
      elapsedMs: Date.now() - startedBoot,
    }
    writeFileSync(join(bootDir, 'verdicts.json'), `${JSON.stringify(verdicts, null, 2)}\n`)
    writeFileSync(join(bootDir, 'summary.txt'), `${renderSummary(result)}\n`)
    // The RUN record carries the shipped verdict vocabulary; the probe's own
    // PROVEN/REFUTED proposition stays in `verdicts.json` and each case's detail.
    for (const [id, v] of Object.entries(verdicts)) {
      record.addCase(CASE_ID[id], v.verdict === 'PROVEN' ? 'PASS' : 'FAIL', {
        proposition: v.proposition,
        probeVerdict: v.verdict,
        failing: v.failing,
        clauses: v.clauses,
      })
    }
    log(`[boot${String(index)}] overall=${overall} (${String(result.elapsedMs)}ms)`)
  } catch (error) {
    failure = error
    log(`[boot${String(index)}] PROBE FAILED: ${String(error?.stack ?? error)}`)
    record.markAborted({ stage: 'probe', detail: String(error?.message ?? error).slice(0, 800) })
  } finally {
    if (refusalWorld !== null) {
      try { refusalTeardown = await refusalWorld.teardown({ keepHome: failure !== null }) } catch { refusalTeardown = null }
    }
    if (world !== null) {
      try { teardown = await world.teardown({ keepHome: failure !== null }) } catch (error) { log(`teardown note: ${String(error?.message ?? error)}`) }
    }
    try {
      const settled = settleDevLiveLease(lease)
      log(`[boot${String(index)}] dev-live slot released (released=${String(settled?.released)} held=${String(settled?.held)})`)
    } catch (error) {
      log(`lease settle note: ${String(error?.message ?? error)}`)
    }
    writeFileSync(join(bootDir, 'teardown.json'), `${JSON.stringify({ teardown, refusalTeardown }, null, 2)}\n`)
    try {
      const final = record.finalize()
      writeFileSync(join(bootDir, 'run-record.json'), `${JSON.stringify(final, null, 2)}\n`)
      writeFileSync(join(bootDir, 'run-record.txt'), `${formatSummary(final)}\n`)
    } catch { /* record write is best-effort on abort */ }
  }
  return result ?? { boot: index, overall: 'ERROR', failed: true, error: String(failure?.message ?? failure) }
}

function fnWriteVerdict(bootDir, name, verdict) {
  writeFileSync(join(bootDir, `verdict-${name}.json`), `${JSON.stringify(verdict, null, 2)}\n`)
}

function renderSummary(result) {
  const lines = []
  lines.push(`# D4 routed-wake probe — boot ${String(result.boot)}`)
  lines.push(`world=${String(result.worldId)} home=${String(result.home)} port=${String(result.port)} elapsedMs=${String(result.elapsedMs)}`)
  lines.push('')
  lines.push('judge                verdict    failing')
  for (const [name, v] of Object.entries(result.verdicts)) {
    lines.push(`${name.padEnd(20)} ${String(v.verdict).padEnd(10)} ${JSON.stringify(v.failing)}`)
  }
  lines.push('')
  lines.push(`counters: ${JSON.stringify(result.counters)}`)
  return lines.join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// bindings, agreement, main
// ─────────────────────────────────────────────────────────────────────────────
function runBindings(head, grant) {
  return {
    authority: readAuthorityBinding(REPO_ROOT),
    candidate: { head, hostSha: HOST_PIN.sha, baseline: HOST_PIN.sha },
    grant: { grantId: grant.grantId, scope: 'DEV-LIVE', face: grant.face, world: grant.world },
    recordClass: 'DEV-LIVE',
    compositionDrops: COMPOSITION_DROPS,
    layout: 'centre',
    teamSha: head,
    hostSha: HOST_PIN.sha,
    note: 'DEV-LIVE probe: a blocker measurement, never a candidate claim and never an acceptance driver',
    driver: 'probe-d4-routed-wake',
  }
}
function archivePriorRuns() {
  if (existsSync(RUNS)) {
    const entries = readdirSync(RUNS)
    if (entries.length > 0) {
      mkdirSync(ARCHIVE, { recursive: true })
      const target = join(ARCHIVE, utcStamp())
      renameSync(RUNS, target)
      log(`archived previous runs -> ${target}`)
    }
  }
  mkdirSync(RUNS, { recursive: true })
}

async function main() {
  archivePriorRuns()
  const head = resolveHeadCommit(REPO_ROOT)
  const grant = JSON.parse(readFileSync(GRANT_PATH, 'utf8'))
  const porcelainBefore = hostPorcelain()
  if (porcelainBefore.length !== 0) throw new Error(`the pinned host tree is not porcelain-clean: ${JSON.stringify(porcelainBefore)}`)
  log(`host tree=${HOST_TREE} HEAD=${String(hostDigest())} pin=${HOST_PIN.sha} porcelain=[]`)
  log(`started ${startedAt} boots=${String(BOOTS_WANTED)}`)

  const results = []
  for (let i = 1; i <= BOOTS_WANTED; i += 1) {
    results.push(await probeOnce({ index: i, head, grant }))
  }
  const porcelainAfter = hostPorcelain()
  log(`host porcelain after: ${JSON.stringify(porcelainAfter)}`)

  const ok = results.filter((r) => r?.failed !== true)
  const agreement = buildAgreement(ok)
  writeFileSync(join(EVIDENCE, 'agreement.json'), `${JSON.stringify(agreement, null, 2)}\n`)
  writeFileSync(join(EVIDENCE, 'agreement.txt'), `${agreement.text}\n`)
  writeFileSync(join(EVIDENCE, 'results.json'), `${JSON.stringify(results, null, 2)}\n`)
  writeFileSync(join(EVIDENCE, 'probe-digest.json'), `${JSON.stringify({
    at: new Date().toISOString(),
    head,
    hostTree: HOST_TREE,
    hostSha: HOST_PIN.sha,
    pin: HOST_PIN.sha,
    probeSha256: sha256(fileURLToPath(import.meta.url)),
    jsSubstitutions: layer.jsSubstitutions,
    boots: BOOTS_WANTED,
  }, null, 2)}\n`)
  log(agreement.text)
  if (porcelainAfter.length !== 0) process.exitCode = 1
  const allRan = results.length === BOOTS_WANTED && results.every((r) => r?.failed !== true)
  const pairOk = BOOTS_WANTED < 2 || agreement.agreeing === true
  const blocked = results.every((r) => r?.overall === 'BLOCKED')
  log(`RESULT evidence-complete=${String(allRan && pairOk)} allBooted=${String(allRan)} blocked=${String(blocked)} (${String(results.length)}/${String(BOOTS_WANTED)} boots; agreeing pair=${String(agreement.agreeing)})`)
  // A BLOCKED probe is the intended honest outcome of this round; it is not a
  // green acceptance. The exit code separates "the probe ran and measured the
  // blocker" (3) from "the probe itself failed" (1).
  if (!allRan || !pairOk) process.exitCode = 1
  else if (blocked) process.exitCode = 3
}

function buildAgreement(results) {
  const rows = []
  const pick = (r) => ({
    overall: r.overall,
    ...Object.fromEntries(Object.entries(r.verdicts ?? {}).map(([k, v]) => [k, v.verdict])),
    ...Object.fromEntries(Object.entries(r.counters ?? {}).map(([k, v]) => [k, v])),
  })
  const table = results.map(pick)
  const keys = [...new Set(table.flatMap((row) => Object.keys(row)))]
  let agreeing = true
  for (const key of keys) {
    const values = table.map((row) => JSON.stringify(row[key] ?? null))
    if (new Set(values).size > 1) agreeing = false
    rows.push({ key, values })
  }
  const lines = ['TWO-RUN AGREEMENT (the same probe, two boots; every measured row must be identical)']
  lines.push(`fact${' '.repeat(34 - 4)}${table.map((_t, i) => `boot${String(i + 1)}`.padEnd(36)).join('')}`)
  for (const row of rows) {
    lines.push(`${row.key.padEnd(36)} ${row.values.map((v) => String(v).slice(0, 34).padEnd(36)).join(' ')}`)
  }
  lines.push('')
  lines.push(`agreeing=${String(agreeing)} differing=${JSON.stringify(rows.filter((r) => new Set(r.values).size > 1).map((r) => r.key))}`)
  return { agreeing, rows, text: lines.join('\n') }
}

if (PLAN_MODE) {
  try {
    await planOnly()
  } catch (error) {
    log(`PLAN FAILED: ${String(error?.stack ?? error)}`)
    process.exitCode = 1
  }
} else {
  main().catch((error) => {
    log(`PROBE FAILED (outside the run): ${String(error?.stack ?? error)}`)
    process.exitCode = 1
  })
}
