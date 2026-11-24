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
 *      probe records the row's REAL shape (round 93: whether it carries
 *      `approvalCaseId` / `legOrdinal` / `reviewAuthority`), the recipient the
 *      product actually wakes, and whether any `team-review-wake-routed` /
 *      `team-review-wake-delivered` fact or wake-intent file exists. ROUND 93
 *      AMENDED THE JUDGE (disclosed in the clauses): the two clauses that
 *      asserted the DEFECT (`route() === null`, "the Leader received the plain
 *      ask") now assert the REQUIREMENT (the product's router selects the
 *      Officer instance, and the plain case-less ask is ABSENT). Nothing else
 *      is relaxed. The world is the PRODUCTION shape by default (the ask on the
 *      Member ceiling, no declared `toolBindings[]`); `D4_BINDING_WORLD=1`
 *      reaches the declared-binding arm that measures finding G3 — an ask and a
 *      trusted ToolBinding are mutually exclusive today, because the Alpha.5
 *      compiler's hard intersection collapses an `ask` path to an EMPTY lane.
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

import { apiPrompt, apiSessionCancel, authenticate, emitPatchLayer, fetchJson } from '../../lib/world-factory.mjs'
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
const D4_BINDING_WORLD = process.env['D4_BINDING_WORLD'] ?? ''
const BASELINE_TOOL_FS = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'fs', 'tool-fs', 'lib', 'index.js')
if (!existsSync(BASELINE_TOOL_FS)) throw new Error(`the pinned host tool-fs module must exist (${BASELINE_TOOL_FS})`)

const TOK_OFF = 'dboot-d4-officer-work'
const TOK_WRK = 'dboot-d4-worker-work'
const DONE_OFFICER_TURN = 'DBOOT_D4_OFFICER_TURN_DONE'
const DONE_OFFICER_WAKE_TURN = 'DBOOT_D4_OFFICER_WAKE_DONE'
const DONE_WORKER_TURN = 'DBOOT_D4_WORKER_TURN_DONE'
const CALL_OFF_READ = 'call-d4-officer-read'
const CALL_WRK_WRITE = 'call-d4-worker-write'
const CALL_WRK_WRITE2 = 'call-d4-worker-write-2'
const CALL_RESOLVE2 = 'call-d4-leader-resolve-2'
const CALL_RESOLVE = 'call-d4-leader-resolve'
// ROUND 97 — the OFFICER's OWN decision calls. The call id NAMES the durable leg it decides, so a
// second wake cannot be mistaken for the first one already answered (round 96's lesson: a suffix-style
// marker was read as the older ask). The probe derives the same id from the durable requestId.
const CALL_OFF_RESOLVE = (requestId) => `call-d4-officer-resolve-${String(requestId)}`
// NOT a prefix of MK_RESOLVE: `lastLeaderMarkerText` returns the first DECLARED marker contained
// in the prompt text, so a suffix-style name would be read as the older ask (measured: the second
// resolve turn answered NO_PENDING because the mock matched MK_RESOLVE).
const MK_RESOLVE2 = 'DBOOT_D4_SECOND_ASK_RESOLVE'
const DONE_RESOLVE2 = 'DBOOT_D4_RESOLVE_DONE_2'
const OFFICER_TEXT = 'DBOOT_D4_OFFICER_READ_OK'
const WORKER_TEXT = 'DBOOT_D4_WORKER_ASK_CALLED'
// The SECOND live mutation: a DIFFERENT approval writing DIFFERENT bytes. It proves the content
// binding across two real approvals (each receipt covers its own sha256), not just one happy path.
const WORKER_TEXT2 = 'DBOOT_D4_WORKER_ASK_CALLED_2'
// ROUND 97 — Sticky Stop. A HUMAN prompt holds the Officer's turn open long enough for a REAL user
// cancel to reach the host (the only producer of the Sticky Stop marker), and a THIRD worker ask is
// raised while the Officer is stopped. The bytes of that third call are the resume's proof.
const CALL_WRK_WRITE3 = 'call-d4-worker-write-3'
const WORKER_TEXT3 = 'DBOOT_D4_WORKER_ASK_CALLED_3'
const MK_HOLD = 'DBOOT_D4_OFFICER_HOLD'
const MK_RESUME = 'DBOOT_D4_OFFICER_RESUME'
const MK_WORK3 = 'DBOOT_D4_WORKER_THIRD_ASK'
const HOLD_STEPS = 40
const CALL_OFF_HOLD = (step) => `call-d4-officer-hold-${String(step)}`
const CASE_ID = {
  enablement: 'd4:enablement',
  officerUp: 'd4:officer-up',
  officerBinding: 'd4:officer-binding',
  routedWake: 'd4:routed-wake',
  refusal: 'd4:refusal',
  askExecute: 'd4:ask-execute',
  askDenied: 'd4:ask-denied',
  askStopped: 'd4:ask-stopped',
  askExecute2: 'd4:ask-execute-2',
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
    // R1 (round 93, owner ruling on review 20261124-0151 §1) — THE DECLARED OPERATION TOOL.
    //
    // R1's case identity must freeze a TRUSTED ToolBinding coordinate, so the world DECLARES the
    // operation tool: `<owner>/<name>` = `dsh.fs/write`, with the disposition `ask` and a PURE-ASK write
    // lane inside the worker's own workspace lane. That is the authoring shape a real Team uses when it
    // wants a governed operation: the tool is declared (Q1), the lane is an ask (so the call is an
    // ordinary ask), and the compiler's lane algebra keeps the ask (G11, fixed in round 94 —
    // `intersectPathRuleSets` no longer collapses a pure-ask lane).
    //
    // ROUND 97: this declaration is the DEFAULT world, not an env-gated experiment. Round 93 measured
    // that an ask and a declared ToolBinding were mutually exclusive because the compiler collapsed the
    // ask to deny-all; round 94 fixed the lane algebra, and this round measures the resulting live
    // `ask → case → Officer wake → decision → execute` chain.
    toolBindings: [
      {
        owner: 'dsh.fs',
        name: 'write',
        // THE DECLARED DISPOSITION the task names: `ask`. It rides the compiled binding as the
        // tool's authorization; the per-call lane disposition is the `write` lane below.
        authorization: 'ask',
        io: {
          read: lane([dirs.dir]),
          // PURE ask: nothing is pre-authorised, the worker's own lane is ask-gated. The intersection
          // with the worker's ceiling (also a pure ask for the same lane) stays an ask.
          write: lane([], [dirs.dir]),
          network: { mode: 'allow' },
        },
        execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' },
      },
    ],
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
    // THE TOOL MODULE THE DECLARED BINDING IS MOUNTED FROM (round 93). A Team-scoped
    // `toolBindings[]` entry names a tool; the realm can only shadow a name it can mount, so a
    // world that DECLARES the operation tool must also mount the module that provides it. This is
    // the pinned host `tool-fs` package (read-only, from the pristine test tree), not a product mock.
    a5sfNativeToolModules: [BASELINE_TOOL_FS],
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
  const markers = [MK_DISC, MK_OFF, MK_WRK, MK_RESOLVE, MK_RESOLVE2]
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
/**
 * The NEWEST product-delivered review wake in a transcript (round 97).
 *
 * A wake is an ordinary attributed input, so it lands as a `user` role message. After the mock's own
 * tool call the loop appends the tool RESULT as a user-role message too, so scanning "the last user
 * message" would miss the wake; scan newest-first for the wake's own token instead. Returns the wake
 * text plus the requestIds it names (merged wakes name several).
 */
function lastReviewWake(record) {
  const users = messagesOf(record).filter((m) => m?.role === 'user')
  for (let i = users.length - 1; i >= 0; i -= 1) {
    // `contentText` (not `textOf`) — the wake carries newlines and the model request holds content
    // blocks, so a JSON-escaped scan would miss the `requestId` bullet line.
    const text = contentText(users[i]?.content)
    if (!text.includes('[team-review-wake')) continue
    const requestIds = [...text.matchAll(/requestId[:=]\s*(?:-\s*)?([A-Za-z0-9_-]+)/gu)].map((match) => match[1])
    return { text, requestIds: [...new Set(requestIds)] }
  }
  return null
}
/** Which review-wake legs this session has ALREADY answered (by the deterministic call id). */
function resolvedWakeIds(record) {
  const done = new Set()
  for (const row of messagesOf(record)) {
    if (!Array.isArray(row?.content)) continue
    for (const block of row.content) {
      if (block?.type !== 'tool_result' || block?.tool_use_id === undefined) continue
      const match = /^call-d4-officer-resolve-(.+)$/u.exec(String(block.tool_use_id))
      if (match !== null) done.add(match[1])
    }
  }
  return done
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
function makeDecide({ paths, ids, resolveDecision = 'allow' }) {
  const text = (content) => ({ kind: 'text', content })
  const readCall = (id, filePath) => ({ kind: 'tool-call', toolCalls: [{ id, name: 'read', arguments: { file_path: filePath } }] })
  const writeCall = (id, filePath, content) => ({ kind: 'tool-call', toolCalls: [{ id, name: 'write', arguments: { file_path: filePath, content } }] })
  const resolveCall = (id, requestId) => ({
    kind: 'tool-call',
    toolCalls: [{
      id,
      name: 'team_resolve_control',
      arguments: { rootSessionId: ROOT, requestToken: `dboot-d4-resolve-${String(requestId)}`, requestId, decision: resolveDecision },
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
    // ── ROUND 97: the OFFICER's wake turn ─────────────────────────────────────────────────────────
    // The product delivers the routed review wake as attributed input into the Officer's OWN session.
    // This is the only surface that can answer it, and the answer is the Officer's OWN
    // `team_resolve_control` (admitted under ITS binding by the ONE centre). Each leg is decided with
    // the EXACT requestId the wake names; a leg already answered is not answered twice.
    // ROUND 97 — WHICH TURN IS THIS? A wake message and a human marker both live in the history
    // forever, so neither "any wake exists" nor "the last user message" is the right test. The turn is
    // decided by the NEWEST of the two: a marker appended after the newest wake makes this a human
    // turn; a wake appended after the newest marker makes it a wake turn.
    const users = messagesOf(req).filter((m) => m?.role === 'user')
    const wakeIndex = (() => {
      for (let index = users.length - 1; index >= 0; index -= 1) {
        if (contentText(users[index]?.content).includes('[team-review-wake')) return index
      }
      return -1
    })()
    const markerIndex = (() => {
      for (let index = users.length - 1; index >= 0; index -= 1) {
        const text = contentText(users[index]?.content)
        if ([MK_HOLD, MK_RESUME, MK_WORK3].some((marker) => text.includes(marker))) return index
      }
      return -1
    })()
    const wake = markerIndex > wakeIndex ? null : lastReviewWake(req)
    if (wake !== null) {
      const answered = resolvedWakeIds(req)
      for (const requestId of wake.requestIds) {
        if (answered.has(requestId)) continue
        return resolveCall(CALL_OFF_RESOLVE(requestId), requestId)
      }
      return text(DONE_OFFICER_WAKE_TURN)
    }
    // ── ROUND 97: the HUMAN-driven turns used by the Sticky-Stop arm ─────────────────────────────
    // A human prompt appended after the newest wake owns the turn. The hold turn issues one `read`
    // per step so a real `session/cancel` can land mid-turn; the third worker ask is an ask.
    const humanTurn = newestMarkerText(req, [MK_HOLD, MK_RESUME, MK_WORK3])
    if (humanTurn === MK_HOLD) {
      const seen = resultIdsOf(req)
      for (let step = 1; step <= HOLD_STEPS; step += 1) {
        const id = CALL_OFF_HOLD(step)
        if (!seen.has(id)) return readCall(id, paths.officerFile)
      }
      return text('DBOOT_D4_OFFICER_HOLD_DONE')
    }
    if (humanTurn === MK_WORK3) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_WRK_WRITE3)) return writeCall(CALL_WRK_WRITE3, paths.workerFile3, `${WORKER_TEXT3}\n`)
      return text('DBOOT_D4_WORK3_DONE')
    }
    const token = memberTokenOf(req)
    if (token !== null) {
      const seen = resultIdsOf(req)
      if (token === TOK_OFF) {
        if (!seen.has(CALL_OFF_READ)) return readCall(CALL_OFF_READ, paths.officerFile)
        return text(DONE_OFFICER_TURN)
      }
      if (token === TOK_WRK) {
        if (!seen.has(CALL_WRK_WRITE)) return writeCall(CALL_WRK_WRITE, paths.workerFile, `${WORKER_TEXT}\n`)
        // The SECOND ask, on a DIFFERENT path with DIFFERENT bytes, only after the first call RETURNED
        // (its result arrives only once the Leader resolved it). Each ask is its own durable request.
        if (!seen.has(CALL_WRK_WRITE2)) return writeCall(CALL_WRK_WRITE2, paths.workerFile2, `${WORKER_TEXT2}\n`)
        return text(DONE_WORKER_TURN)
      }
      return text('DBOOT_D4_MEMBER_NOOP')
    }

    // Leader turns. The marker is read from the LAST user message only: a
    // marker already spent stays in the conversation history, so scanning the
    // whole transcript would re-fire it on every later turn.
    const leaderText = lastLeaderMarkerText(req)
    const seen = resultIdsOf(req)
    if (leaderText.includes(MK_RESOLVE2)) {
      if (!seen.has(CALL_RESOLVE2)) {
        if (ids.pendingRequestId2 === null || ids.pendingRequestId2 === undefined) return text('DBOOT_D4_NO_PENDING_REQUEST')
        return resolveCall(CALL_RESOLVE2, ids.pendingRequestId2)
      }
      // The turn's own done marker: the driver waits for THIS text, so the wait is a real signal
      // (before, it waited 120s for a reply the plan never produced).
      return text(DONE_RESOLVE2)
    }
    if (leaderText.includes(MK_RESOLVE)) {
      if (!seen.has(CALL_RESOLVE)) {
        if (ids.pendingRequestId === null) return text('DBOOT_D4_NO_PENDING_REQUEST')
        return resolveCall(CALL_RESOLVE, ids.pendingRequestId)
      }
      return text(DONE_RESOLVE)
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
/**
 * The NEWEST human-turn marker in the conversation (round 97).
 *
 * The officer's session carries workspace/system-reminder user messages AFTER the human prompt, so
 * "the last user message" is not the marker. Scan newest-first for a message carrying one of the
 * declared markers — the same rule `lastLeaderMarkerText` uses for Leader turns. The FIRST marker
 * found wins, so a later resume marker supersedes an earlier hold marker.
 */
function newestMarkerText(req, markers) {
  const users = messagesOf(req).filter((m) => m?.role === 'user')
  for (let index = users.length - 1; index >= 0; index -= 1) {
    const text = contentText(users[index]?.content)
    for (const marker of markers) {
      if (text.includes(marker)) return marker
    }
  }
  return ''
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
  const userSources = []
  for (const row of lines) {
    const data = row?.data ?? row
    const type = row?.type ?? row?.kind ?? null
    if (type === 'user/message') {
      user.push(contentText((data?.message ?? data)?.content))
      // ROUND 97 — the A56 machine-attribution surface: who PRODUCED this input. The review wake is
      // delivered with the producer-owned `plugin:dsh-agent-team` source; a HUMAN input carries
      // `kind:'user'`. This is the live witness the Sticky-Stop law reads.
      userSources.push(String((data?.message ?? data)?.source?.kind ?? ''))
    }
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
  return { sessionId, file: found.file, header: found.header, lineCount: lines.length, user, userSources, calls: paired, assistant, finalAssistant: assistant.at(-1) ?? null }
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
    bodyOutcome: record?.observation?.bodyOutcome ?? null,
    dispatch: record?.observation?.dispatch ?? null,
    transitions: Array.isArray(record?.transitions) ? record.transitions.map((t) => t?.to ?? t) : [],
    // The wall-clock the settlement reached its terminal state (the LAST transition's `at`), used by
    // the ordering clause ("the granted call executed AFTER the review decision").
    terminalAt: Array.isArray(record?.transitions) && record.transitions.length > 0
      ? (record.transitions[record.transitions.length - 1]?.at ?? null)
      : (record?.updatedAt ?? null),
  }
}
/**
 * Every execution settlement under the home that NAMES a literal (round 97).
 *
 * Used for the "the management plane executes NO tool" clause: the delivery is a governed INPUT, so
 * no settlement may exist that carries the wake's own token. A reader that finds nothing at all is
 * controlled by the settlements the member calls DID write (the judges read those separately).
 */
function settlementsMentioning(home, needle) {
  if (!nonEmpty(needle)) return []
  const root = join(centreDirOf(home), 'settlement')
  const hits = []
  for (const entry of walkFiles(root)) {
    if (!entry.name.endsWith('.settlement.json')) continue
    try { if (readFileSync(entry.path, 'utf8').includes(needle)) hits.push(entry.path) } catch { /* unreadable is not a hit */ }
  }
  return hits
}
/** Read the REAL bytes the boot left on the host filesystem (outside the Member sandbox). */
function fileEvidence(filePath) {
  if (!existsSync(filePath)) return { path: filePath, exists: false, content: null, bytes: null, sha256: null }
  const content = readFileSync(filePath, 'utf8')
  return {
    path: filePath,
    exists: true,
    content,
    bytes: Buffer.byteLength(content),
    sha256: createHash('sha256').update(content).digest('hex'),
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
/**
 * ROUND 97 — the routed-wake judges.
 *
 * Round 84 named the ONE missing piece as "the routed review wake reaching a real Host". Round 93's
 * single monolithic `d4:routed-wake` judge encoded the pre-R1 gap and was REFUTED. Round 97 measures
 * the finished chain as SEVEN independent propositions, each answerable from durable bytes on disk:
 *
 *   d4:case-created              the ask opened a REAL durable approval case (case id + leg), read back
 *   d4:router-officer            the product router selects the unique lawful Officer (self-ask refused)
 *   d4:wake-delivered            governed intent + confirmation + machine attribution, zero management
 *                                tool executions
 *   d4:officer-decides           the Officer is woken in ITS session and its own resolve is admitted
 *                                under ITS binding
 *   d4:ask-executes-after-review the worker's granted call executes AFTER the review decision
 *   d4:duplicate-route           a duplicate route produces ONE wake
 *   d4:sticky-stop               a machine-delivered wake does not clear a human Sticky Stop
 *
 * `d4:routed-wake` is the CONJUNCTION of all seven (see `judgeRoutedWake`), so the capability cell
 * is PROVEN only when every clause is. None of the pre-existing judges is touched.
 */
const WAKE_MACHINE_SOURCE = 'plugin:dsh-agent-team'

function nonEmpty(value) {
  return typeof value === 'string' && value.trim().length > 0
}

function judgeCaseCreated({ durableRow, ledgerRows }) {
  const row = durableRow?.row ?? null
  const fact = durableRow?.fact ?? null
  const scope = row?.reviewPayload?.authorityScope ?? row?.authorityScope ?? null
  const decisionFacts = (ledgerRows ?? []).filter((entry) => entry?.factType === 'control-decision-recorded'
    && String(entry?.payload?.requestId ?? '') === String(row?.requestId ?? ''))
  return verdictOf(
    'a qualifying ordinary admission ask opened a REAL durable Alpha.6 approval CASE (server-derived case id + leg ordinal + frozen operation/tool/blueprint identity), read back from the TeamDomain ledger on disk',
    [
      { id: 'read-back-from-the-ledger', ok: fact !== null && fact?.factType === 'control-request-recorded' && Number.isInteger(fact?.sequence), detail: `factFile=${JSON.stringify(durableRow?.file ?? null)} sequence=${String(fact?.sequence ?? null)}` },
      { id: 'durable-row-is-an-approval-ask', ok: row?.kind === 'leader-approval' && row?.actionName === 'admission-ask', detail: `kind=${JSON.stringify(row?.kind ?? null)} actionName=${JSON.stringify(row?.actionName ?? null)}` },
      { id: 'approval-case-id-present', ok: nonEmpty(row?.approvalCaseId) && String(row.approvalCaseId).startsWith('case-'), detail: `approvalCaseId=${JSON.stringify(row?.approvalCaseId ?? null)}` },
      { id: 'leg-ordinal-present', ok: Number.isInteger(row?.legOrdinal) && row.legOrdinal >= 1, detail: `legOrdinal=${JSON.stringify(row?.legOrdinal ?? null)}` },
      { id: 'case-rung-is-the-leader', ok: row?.reviewAuthority === 'leader' && row?.requiredAuthorityAtCreation === 'leader', detail: `reviewAuthority=${JSON.stringify(row?.reviewAuthority ?? null)} requiredAuthorityAtCreation=${JSON.stringify(row?.requiredAuthorityAtCreation ?? null)}` },
      {
        id: 'frozen-operation-identity',
        ok: nonEmpty(row?.operationFingerprint) && String(row.operationFingerprint).startsWith('sha256:')
          && row?.requestedEffect === 'allow'
          && scope !== null && scope?.operationClass === 'write'
          && scope?.matcher?.kind === 'exact' && nonEmpty(scope?.matcher?.resource),
        detail: `operationFingerprint=${JSON.stringify(row?.operationFingerprint ?? null)} requestedEffect=${JSON.stringify(row?.requestedEffect ?? null)} authorityScope=${JSON.stringify(scope)}`,
      },
      { id: 'frozen-tool-coordinate', ok: row?.operationToolOwner === 'dsh.fs' && row?.operationToolName === 'write' && row?.operationToolDefinitionIdentity === 'dsh.fs/write', detail: `coordinate=${JSON.stringify([row?.operationToolOwner ?? null, row?.operationToolName ?? null, row?.operationToolDefinitionIdentity ?? null])}` },
      { id: 'frozen-blueprint-and-generation', ok: nonEmpty(row?.blueprintContentHash) && String(row.blueprintContentHash).startsWith('sha256:') && nonEmpty(row?.blueprintRevision) && Number.isInteger(row?.authorityGeneration), detail: `blueprintContentHash=${JSON.stringify(row?.blueprintContentHash ?? null)} revision=${JSON.stringify(row?.blueprintRevision ?? null)} authorityGeneration=${JSON.stringify(row?.authorityGeneration ?? null)}` },
      { id: 'case-has-no-decision-yet', ok: decisionFacts.length === 0, detail: `decision facts at capture time=${String(decisionFacts.length)}` },
    ],
  )
}

function judgeRouterOfficer({ routeProbe, officerInstanceId, requesterInstanceId, officerCandidateCount }) {
  const route = routeProbe?.route ?? null
  const selfAsk = routeProbe?.selfAskRoute ?? null
  const selfAskPicksOfficer = selfAsk?.kind === 'recipient'
    && selfAsk?.target?.routeRole === 'officer'
    && String(selfAsk?.target?.instanceId ?? '') === String(officerInstanceId ?? '')
  return verdictOf(
    'the product router selects the UNIQUE lawful Officer for the case leg, and a self-ask (the operation owner is the Officer) is never routed to that Officer',
    [
      {
        id: 'route-is-the-officer-instance',
        ok: route?.kind === 'recipient' && route?.target?.kind === 'instance'
          && route?.target?.routeRole === 'officer'
          && String(route?.target?.instanceId ?? '') === String(officerInstanceId ?? ''),
        detail: `route=${JSON.stringify(route)} expectedOfficer=${JSON.stringify(officerInstanceId ?? null)} memberListCalls=${String(routeProbe?.memberListCalls)}`,
      },
      { id: 'exactly-one-lawful-officer', ok: Number(officerCandidateCount) === 1, detail: `active officer candidates=${JSON.stringify(officerCandidateCount ?? null)}` },
      { id: 'requester-is-not-the-reviewer', ok: nonEmpty(requesterInstanceId) && String(requesterInstanceId) !== String(officerInstanceId ?? ''), detail: `requester=${JSON.stringify(requesterInstanceId ?? null)} officer=${JSON.stringify(officerInstanceId ?? null)}` },
      { id: 'self-ask-never-routed-to-the-officer', ok: selfAskPicksOfficer === false && selfAsk !== null, detail: `self-ask route=${JSON.stringify(selfAsk ?? null)}` },
    ],
  )
}

function judgeWakeDelivered({ requestId, wakeFacts, officerTranscript, intentFiles, managementExecutions }) {
  const routed = wakeFacts.filter((entry) => entry.factType === 'team-review-wake-routed'
    && String(entry?.payload?.requestId ?? '') === String(requestId ?? ''))
  const delivered = wakeFacts.filter((entry) => entry.factType === 'team-review-wake-delivered')
  const token = routed.length === 1 ? String(routed[0]?.payload?.requestToken ?? '') : ''
  const confirmed = token === '' ? [] : delivered.filter((entry) => String(entry?.payload?.requestToken ?? '') === token)
  const correlation = routed.length === 1 && confirmed.length === 1
    && Number(confirmed[0]?.payload?.factSequence) === Number(routed[0]?.sequence)
  const wakeSources = (officerTranscript?.userSources ?? []).filter((_source, index) =>
    String(officerTranscript?.user?.[index] ?? '').includes('[team-review-wake'))
  return verdictOf(
    'the routed review wake is DELIVERED through the governed delivery: exactly one durable `team-review-wake-routed` intent, one correlated `team-review-wake-delivered` confirmation, the input is machine-attributed (never human), and the management plane executed ZERO tools',
    [
      { id: 'one-routed-intent-for-the-leg', ok: routed.length === 1, detail: `routed facts for requestId=${JSON.stringify(requestId ?? null)}: ${JSON.stringify(wakeFacts.filter((e) => e.factType === 'team-review-wake-routed').map((e) => e?.payload?.requestId ?? null))}` },
      { id: 'one-correlated-confirmation', ok: confirmed.length === 1 && correlation, detail: `requestToken=${JSON.stringify(token)} confirmations=${String(confirmed.length)} correlation=${String(correlation)}` },
      { id: 'intent-names-the-officer-session', ok: routed.length === 1 && nonEmpty(routed[0]?.payload?.deliveredToSessionId) && routed[0]?.payload?.routeRole === 'officer', detail: `intent payload=${JSON.stringify(routed[0]?.payload ?? null)}` },
      // The wake-INTENT directory row is a TRANSIENT queue entry: the latch clears it once the
      // delivery is confirmed (the directory is empty after a successful wake, measured). The
      // SURVIVING intent artifact is the durable `team-review-wake-routed` fact (clause 1); this
      // clause pins its semantic shape instead of asserting a file that is correctly gone.
      { id: 'intent-carries-the-review-action', ok: routed.length === 1 && routed[0]?.payload?.action === 'review-wake' && nonEmpty(routed[0]?.payload?.at), detail: `intent payload action=${JSON.stringify(routed[0]?.payload?.action ?? null)} at=${JSON.stringify(routed[0]?.payload?.at ?? null)} intentDirFiles=${JSON.stringify(intentFiles ?? [])}` },
      { id: 'machine-attribution-not-human', ok: wakeSources.length > 0 && wakeSources.every((source) => source === WAKE_MACHINE_SOURCE), detail: `wake input sources=${JSON.stringify(wakeSources)} expected=${JSON.stringify(WAKE_MACHINE_SOURCE)}` },
      { id: 'zero-management-plane-tool-executions', ok: Number(managementExecutions) === 0, detail: `settlements naming the wake token or the review-wake tool=${JSON.stringify(managementExecutions ?? null)}` },
    ],
  )
}

function judgeOfficerDecides({ requestId, officerTranscript, officerFacts, settlement, leaderTranscript, officerInstanceId }) {
  const callId = CALL_OFF_RESOLVE(requestId)
  const call = (officerTranscript?.calls ?? []).find((entry) => String(entry?.callId) === callId) ?? null
  const allowed = (officerFacts ?? []).filter((fact) => fact?.kind === 'invocation-authority' && fact?.decision === 'allow')
  const boundToItself = allowed.some((fact) => String(fact?.instanceId ?? fact?.agentId ?? '') === String(officerInstanceId ?? ''))
  const leaderDecided = (leaderTranscript?.calls ?? []).some((entry) => String(entry?.name ?? '') === 'team_resolve_control'
    && String(entry?.arguments?.requestId ?? '') === String(requestId ?? ''))
  return verdictOf(
    'the Officer is woken in ITS OWN session and its OWN `team_resolve_control` is admitted under ITS binding (a durable invocation-authority allow for its call, in its centre ledger), settling the case',
    [
      {
        id: 'officer-woken-in-its-own-session',
        ok: (officerTranscript?.userSources ?? []).some((source, index) => source === WAKE_MACHINE_SOURCE
          && String(officerTranscript?.user?.[index] ?? '').includes('[team-review-wake')
          && String(officerTranscript?.user?.[index] ?? '').includes(String(requestId ?? ''))),
        detail: `officer session=${JSON.stringify(officerTranscript?.sessionId ?? null)} wake-for-this-leg=${String((officerTranscript?.user ?? []).some((text) => String(text).includes(String(requestId ?? '\u0000'))))}`,
      },
      { id: 'officer-issued-its-own-resolve', ok: call !== null && call?.name === 'team_resolve_control' && call?.result !== null && call?.result?.isError !== true, detail: `callId=${JSON.stringify(callId)} found=${String(call !== null)} result=${JSON.stringify(call?.result?.text?.slice(0, 300) ?? null)}` },
      { id: 'resolve-admitted-under-its-own-binding', ok: allowed.length >= 1 && boundToItself, detail: `invocation-authority allow facts for ${JSON.stringify(callId)}=${JSON.stringify(allowed.map((f) => ({ instanceId: f.instanceId, axis: f.axis, decision: f.decision })))}` },
      { id: 'settlement-completed', ok: settlement?.state === 'COMPLETED', detail: `settlement=${JSON.stringify({ state: settlement?.state ?? null, bodyOutcome: settlement?.bodyOutcome ?? null })}` },
      { id: 'leader-did-not-decide', ok: leaderDecided === false, detail: `leader resolve calls for the leg=${String(leaderDecided)}` },
    ],
  )
}

function judgeAskExecutesAfterReview({ requestId, decisionFact, file, expectedBytes, facts, settlement, writeCall, reviewDecisionAt }) {
  const decisionAt = reviewDecisionAt ?? decisionFact?.createdAt ?? null
  const terminalAt = settlement?.terminalAt ?? null
  const ordered = nonEmpty(decisionAt) && nonEmpty(terminalAt)
    && Date.parse(String(terminalAt)) >= Date.parse(String(decisionAt))
  const allow = (facts ?? []).find((fact) => fact?.kind === 'invocation-authority' && fact?.decision === 'allow') ?? null
  return verdictOf(
    'the worker\'s granted call EXECUTES AFTER the review decision: the durable decision precedes the tool settlement, the receipt let REAL bytes through, and the admission allow is on the ask lane',
    [
      { id: 'review-decision-is-durable', ok: nonEmpty(decisionFact?.payload?.requestId) && nonEmpty(decisionAt), detail: `decision fact=${JSON.stringify({ requestId: decisionFact?.payload?.requestId ?? null, decision: decisionFact?.payload?.decision ?? null, at: decisionAt })}` },
      { id: 'decision-precedes-execution', ok: ordered, detail: `decisionAt=${JSON.stringify(decisionAt)} settlementTerminalAt=${JSON.stringify(terminalAt)}` },
      { id: 'real-bytes-on-disk', ok: file?.exists === true && file?.content === expectedBytes && file?.bytes === Buffer.byteLength(expectedBytes), detail: `file=${JSON.stringify({ path: file?.path ?? null, exists: file?.exists ?? null, bytes: file?.bytes ?? null, sha256: file?.sha256 ?? null })} expectedBytes=${String(Buffer.byteLength(expectedBytes))}` },
      { id: 'worker-tool-result-not-an-error', ok: writeCall?.result !== null && writeCall?.result !== undefined && writeCall?.result?.isError !== true, detail: `write result=${JSON.stringify(writeCall?.result?.text?.slice(0, 300) ?? null)}` },
      { id: 'admission-allow-on-the-ask-lane', ok: allow !== null, detail: `allow fact=${JSON.stringify(allow === null ? null : { callId: allow.callId, axis: allow.axis, decision: allow.decision })}` },
      { id: 'settlement-completed', ok: settlement?.state === 'COMPLETED' && settlement?.bodyOutcome === 'completed', detail: `settlement=${JSON.stringify({ state: settlement?.state ?? null, bodyOutcome: settlement?.bodyOutcome ?? null })}` },
    ],
  )
}

function judgeDuplicateRoute({ duplicate }) {
  const d = duplicate ?? {}
  return verdictOf(
    'a duplicate route for the SAME leg produces exactly ONE wake: one delivery intent, one confirmation, one input accepted by the Officer session, and the duplicate attempt is reported as a convergent no-op (never a second model-visible wake)',
    [
      { id: 'duplicate-attempt-was-made', ok: d?.attempted === true, detail: `attempted=${String(d?.attempted)} via=${JSON.stringify(d?.via ?? null)}` },
      { id: 'one-delivery-intent', ok: Number(d?.intentFacts) === 1, detail: `routed intent facts for the token=${JSON.stringify(d?.intentFacts ?? null)}` },
      { id: 'one-confirmation', ok: Number(d?.deliveredFacts) === 1, detail: `delivered confirmation facts for the token=${JSON.stringify(d?.deliveredFacts ?? null)}` },
      { id: 'one-model-visible-wake', ok: Number(d?.wakeInputs) === 1, detail: `wake inputs in the Officer session=${JSON.stringify(d?.wakeInputs ?? null)}` },
      { id: 'duplicate-is-a-no-op', ok: d?.converged === true, detail: `converged=${String(d?.converged)} detail=${JSON.stringify(d?.detail ?? null)}` },
    ],
  )
}

function judgeStickyStop({ sticky }) {
  const s = sticky ?? {}
  return verdictOf(
    'a machine-delivered review wake does NOT clear a HUMAN Sticky Stop: the stop marker survives a machine wake attempt, the stopped Officer receives NO wake input from it, and only an explicit human interaction resumes the latch',
    [
      { id: 'human-sticky-stop-marked', ok: s?.stoppedBefore === true, detail: `stop markers before the machine attempt=${JSON.stringify(s?.stoppedMarkersBefore ?? null)}` },
      { id: 'machine-wake-attempted', ok: s?.machineAttempted === true, detail: `machine attempt=${JSON.stringify(s?.machineAttempt ?? null)}` },
      { id: 'stop-survives-the-machine-wake', ok: s?.stoppedAfter === true, detail: `stop markers after the machine attempt=${JSON.stringify(s?.stoppedMarkersAfter ?? null)}` },
      { id: 'no-wake-input-while-stopped', ok: Number(s?.wakeInputsWhileStopped) === 0, detail: `wake inputs between the stop and the human resume=${JSON.stringify(s?.wakeInputsWhileStopped ?? null)}` },
      { id: 'human-resume-is-the-only-clear', ok: s?.humanResumeCleared === true, detail: `human resume cleared the marker=${JSON.stringify(s?.humanResume ?? null)}` },
    ],
  )
}

/**
 * `d4:routed-wake` — the ROUND-84 CASE, as the conjunction of the seven measured propositions above.
 * It is PROVEN only when every one of them is PROVEN; a single REFUTED sub-judge refutes the case.
 */
function judgeRoutedWake({ caseCreated, routerOfficer, wakeDelivered, officerDecides, askExecutesAfterReview, duplicateRoute, stickyStop }) {
  const parts = [
    ['d4:case-created', caseCreated],
    ['d4:router-officer', routerOfficer],
    ['d4:wake-delivered', wakeDelivered],
    ['d4:officer-decides', officerDecides],
    ['d4:ask-executes-after-review', askExecutesAfterReview],
    ['d4:duplicate-route', duplicateRoute],
    ['d4:sticky-stop', stickyStop],
  ]
  return verdictOf(
    'the Alpha.6 ROUTED review wake reaches a real Host end to end: a qualifying worker ask opens a durable case, the product router selects the unique Officer, the governed wake reaches the Officer\'s own session, the Officer settles it under its own binding, and the worker\'s granted call executes — with the duplicate and Sticky-Stop laws intact',
    parts.map(([id, verdict]) => ({
      id: `${id}-proven`,
      ok: verdict?.verdict === 'PROVEN',
      detail: `${String(verdict?.verdict)}${(verdict?.failing ?? []).length === 0 ? '' : ` failing=${JSON.stringify(verdict.failing)}`}`,
    })),
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
// R3 judges — the live ask → grant → execute chain for ONE native `write`
// ─────────────────────────────────────────────────────────────────────────────
/**
 * `d4:ask-execute` — THE POSITIVE LIVE CHAIN.
 *
 * The worker's `write` is admitted with lane disposition `ask`, the product
 * raises a real durable Control request, the Leader settles it through the real
 * control path (`team_resolve_control`), the centre rechecks, the host Tool
 * Guard consumes the one-shot grant, mints the ApprovedAskReceipt, opens the
 * execution scope, and the confined Provider verifies it and writes REAL bytes.
 *
 * Byte-level evidence: the file is read AFTER the boot from the world workspace
 * on the host filesystem (outside the Member sandbox), and its sha256/length
 * are recorded. The settlement must be COMPLETED with `bodyOutcome: completed`.
 */
function judgeAskExecute({ requestRaised, resolveOutcome, file, expectedBytes, facts, settlement, writeCall }) {
  const allowFacts = facts.filter((f) => f?.kind === 'invocation-authority' && f?.decision === 'allow')
  const hash = file.content === null ? null : createHash('sha256').update(file.content).digest('hex')
  const expectedHash = createHash('sha256').update(expectedBytes).digest('hex')
  return verdictOf(
    'a Member `write` whose disposition is `ask` raises a REAL Control request, is approved through the REAL control path, and then executes: the confined Provider verifies the minted receipt and writes the exact approved bytes, settled COMPLETED',
    [
      { id: 'control-request-raised', ok: requestRaised === true, detail: `requestRaised=${String(requestRaised)}` },
      {
        id: 'approved-through-real-control-path',
        ok: resolveOutcome?.isError !== true && typeof resolveOutcome?.result === 'string' && /resolved|allow|success/iu.test(resolveOutcome.result),
        detail: `leader team_resolve_control result=${JSON.stringify(String(resolveOutcome?.result ?? '').slice(0, 500))}`,
      },
      {
        id: 'admission-fact-allow-lane-ask',
        ok: allowFacts.length === 1 && allowFacts[0]?.laneDecision === 'ask',
        detail: `allow facts=${JSON.stringify(allowFacts.map((f) => ({ callId: f.callId, decision: f.decision, laneDecision: f.laneDecision, axis: f.axis })))}`,
      },
      { id: 'write-tool-result-not-an-error', ok: writeCall?.result?.isError === false, detail: `write result isError=${String(writeCall?.result?.isError)} text=${JSON.stringify(String(writeCall?.result?.text ?? '').slice(0, 400))}` },
      { id: 'real-bytes-on-disk', ok: file.content === expectedBytes, detail: `file exists=${String(file.exists)} bytes=${String(file.content === null ? null : Buffer.byteLength(file.content))} sha256=${String(hash)} expectedSha256=${expectedHash}` },
      { id: 'settlement-completed', ok: settlement?.state === 'COMPLETED' && settlement?.bodyOutcome === 'completed', detail: `state=${String(settlement?.state)} bodyOutcome=${String(settlement?.bodyOutcome)} transitions=${JSON.stringify(settlement?.transitions ?? [])}` },
    ],
  )
}

/**
 * `d4:ask-execute-2` — THE SECOND LIVE MUTATION, and the CONTENT-BINDING arm.
 *
 * A SECOND `write` from the SAME worker, on a DIFFERENT path and with DIFFERENT bytes, raises its
 * OWN durable Control request, is approved, and executes. Two things are judged that the first arm
 * cannot judge:
 *
 *  * every receipt is bound to ITS OWN operation — the second approval covers the second path and
 *    the second bytes, and the first file is byte-identical to what the first approval wrote (no
 *    cross-approval reuse, no torn state);
 *  * the receipt check is a CONTENT check, not a "some allow exists" check: the two files hold two
 *    different sha256 digests, each equal to the bytes of ITS OWN approval.
 */
function judgeAskExecute2({ requestRaised, requestIsNew, resolveOutcome, file, firstFile, expectedBytes, firstExpectedBytes, facts, settlement, writeCall }) {
  const allowFacts = facts.filter((f) => f?.kind === 'invocation-authority' && f?.decision === 'allow')
  const hash = file.content === null ? null : createHash('sha256').update(file.content).digest('hex')
  const expectedHash = createHash('sha256').update(expectedBytes).digest('hex')
  const firstHash = firstFile.content === null ? null : createHash('sha256').update(firstFile.content).digest('hex')
  const firstExpectedHash = createHash('sha256').update(firstExpectedBytes).digest('hex')
  return verdictOf(
    'a SECOND Member `write` (different path, different bytes) raises its OWN Control request, is approved, and executes: the receipt is bound to THAT operation, both files hold the bytes of their own approval, settled COMPLETED',
    [
      { id: 'second-control-request-raised', ok: requestRaised === true && requestIsNew === true, detail: `requestRaised=${String(requestRaised)} requestIsNew=${String(requestIsNew)}` },
      {
        id: 'second-approved-through-real-control-path',
        ok: resolveOutcome?.isError !== true && typeof resolveOutcome?.result === 'string' && /resolved|allow|success/iu.test(resolveOutcome.result),
        detail: `leader team_resolve_control result=${JSON.stringify(String(resolveOutcome?.result ?? '').slice(0, 500))}`,
      },
      {
        id: 'second-admission-fact-allow-lane-ask',
        ok: allowFacts.length === 1 && allowFacts[0]?.laneDecision === 'ask',
        detail: `allow facts=${JSON.stringify(allowFacts.map((f) => ({ callId: f.callId, decision: f.decision, laneDecision: f.laneDecision, axis: f.axis })))}`,
      },
      { id: 'second-write-tool-result-not-an-error', ok: writeCall?.result?.isError === false, detail: `write result isError=${String(writeCall?.result?.isError)} text=${JSON.stringify(String(writeCall?.result?.text ?? '').slice(0, 400))}` },
      { id: 'second-real-bytes-on-disk', ok: file.content === expectedBytes, detail: `file exists=${String(file.exists)} bytes=${String(file.content === null ? null : Buffer.byteLength(file.content))} sha256=${String(hash)} expectedSha256=${expectedHash}` },
      { id: 'first-file-unchanged-by-second-approval', ok: firstFile.content === firstExpectedBytes, detail: `first sha256=${String(firstHash)} expectedSha256=${firstExpectedHash}` },
      { id: 'content-binding-distinguishes-the-two-approvals', ok: hash !== null && firstHash !== null && hash !== firstHash, detail: `second=${String(hash)} first=${String(firstHash)}` },
      { id: 'second-settlement-completed', ok: settlement?.state === 'COMPLETED' && settlement?.bodyOutcome === 'completed', detail: `state=${String(settlement?.state)} bodyOutcome=${String(settlement?.bodyOutcome)} transitions=${JSON.stringify(settlement?.transitions ?? [])}` },
    ],
  )
}

/**
 * `d4:ask-denied` — the NEGATIVE live arm: the SAME ask, denied through the
 * real control path. No grant is minted, so no receipt can exist: zero bytes,
 * a deny fact with `ADMISSION_APPROVAL_DENIED`, and a REFUSED / not-started
 * settlement (the body never started).
 */
function judgeAskDenied({ requestRaised, resolveOutcome, file, facts, settlement }) {
  const denyFacts = facts.filter((f) => f?.kind === 'invocation-authority' && f?.decision === 'deny')
  const denied = denyFacts.find((f) => String(f?.refusalCode ?? f?.code ?? '').includes('ADMISSION_APPROVAL_DENIED')) ?? null
  return verdictOf(
    'the SAME live `write` ask denied through the real control path mints nothing and writes nothing: zero bytes on disk, a recorded deny fact, and a REFUSED / not-started settlement',
    [
      { id: 'control-request-raised', ok: requestRaised === true, detail: `requestRaised=${String(requestRaised)}` },
      { id: 'denied-through-real-control-path', ok: resolveOutcome?.isError !== true, detail: `leader team_resolve_control result=${JSON.stringify(String(resolveOutcome?.result ?? '').slice(0, 500))}` },
      { id: 'deny-fact-recorded', ok: denied !== null, detail: `deny facts=${JSON.stringify(denyFacts.map((f) => ({ callId: f.callId, refusalCode: f.refusalCode ?? f.code ?? null, decision: f.decision })))}` },
      { id: 'zero-bytes', ok: file.exists === false && file.content === null, detail: `file exists=${String(file.exists)} bytes=${String(file.content === null ? null : Buffer.byteLength(file.content))}` },
      { id: 'settlement-refused-not-started', ok: settlement?.state === 'REFUSED' && settlement?.bodyOutcome === 'not-started', detail: `state=${String(settlement?.state)} bodyOutcome=${String(settlement?.bodyOutcome)} transitions=${JSON.stringify(settlement?.transitions ?? [])}` },
    ],
  )
}

/**
 * `d4:ask-stopped` — the Stop-while-pending live arm: the ask is raised, the
 * worker's own session is cancelled BEFORE any decision, the wait aborts, and
 * the product refuses with its own Stop vocabulary. Zero bytes; the settlement
 * is REFUSED / not-started (no allow decision was ever recorded for this call).
 */
function judgeAskStopped({ requestRaised, cancelStatus, file, facts, settlement }) {
  const denyFacts = facts.filter((f) => f?.kind === 'invocation-authority' && f?.decision === 'deny')
  const stopped = denyFacts.find((f) => String(f?.refusalCode ?? f?.code ?? '').includes('ADMISSION_STOPPED')) ?? null
  return verdictOf(
    'a live `write` ask that is STOPPED while pending is refused with the product Stop code: zero bytes on disk and a REFUSED / not-started settlement, never an execution',
    [
      { id: 'control-request-raised', ok: requestRaised === true, detail: `requestRaised=${String(requestRaised)}` },
      { id: 'cancel-reached-the-host', ok: typeof cancelStatus === 'number' && cancelStatus >= 200 && cancelStatus < 300, detail: `session/cancel status=${String(cancelStatus)}` },
      { id: 'stop-fact-recorded', ok: stopped !== null, detail: `deny facts=${JSON.stringify(denyFacts.map((f) => ({ callId: f.callId, refusalCode: f.refusalCode ?? f.code ?? null, decision: f.decision })))}` },
      { id: 'zero-bytes', ok: file.exists === false && file.content === null, detail: `file exists=${String(file.exists)} bytes=${String(file.content === null ? null : Buffer.byteLength(file.content))}` },
      { id: 'settlement-refused-not-started', ok: settlement?.state === 'REFUSED' && settlement?.bodyOutcome === 'not-started', detail: `state=${String(settlement?.state)} bodyOutcome=${String(settlement?.bodyOutcome)} transitions=${JSON.stringify(settlement?.transitions ?? [])}` },
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
// R3 NEGATIVE LIVE ARMS — deny while pending, and Stop while pending
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Boot ONE world whose only job is the negative side of the SAME live ask the
 * positive arm proves: the worker's `write` is disposition `ask`, a real
 * Control request is raised, and then the call is either DENIED through the
 * real control path or STOPPED (its own session cancelled) while pending.
 *
 * Both arms must leave ZERO bytes and a REFUSED / not-started settlement — a
 * deny/Stop is not an execution, and no receipt may exist because no grant was
 * consumed. Nothing here shortens the positive judges; it is a separate judge.
 */
async function runAskNegativeArm({ kind, harness, record, index, bootDir, phase, lease, head }) {
  const label = kind === 'deny' ? 'ask-denied' : 'ask-stopped'
  const ids = { officer: null, worker: null, pendingRequestId: null }
  let world = null
  let target = null
  let cancelStatus = null
  let settleAttempts = 0
  try {
    // The target lives INSIDE the Member's own workspace (the host sandbox root), so the ONLY
    // reason no byte exists in this arm is the deny/Stop the judge measures.
    world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
    mkdirSync(world.workspaceDir, { recursive: true })
    const dir = join(world.workspaceDir, 'lane')
    mkdirSync(dir, { recursive: true })
    target = join(dir, `${label}.txt`)
    const dirs = { dir }
    const paths = { dir, officerFile: join(dir, 'officer.txt'), workerFile: target }
    const main = mainBlueprintYaml({ dirs })
    assertBlueprintText(main, BP_ID, `${label}.yaml`, false)
    mkdirSync(join(world.home, 'blueprints'), { recursive: true })
    writeFileSync(join(world.home, 'blueprints', 'main.yaml'), main)
    writeFileSync(join(world.home, 'p6t6-directive.json'), `${JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2)}\n`)
    // Alpha.6 is NOT enabled here: this arm measures the ordinary Control ask path, and a wake
    // route would add a recipient that has nothing to do with the deny/Stop question.
    world.u6Fs.rows.push(...composedRows({ home: world.home, mainYaml: main, alpha6: { enabled: false } }))
    await world.startMock({ decide: makeDecide({ paths, ids, resolveDecision: kind === 'deny' ? 'deny' : 'allow' }) })
    const boot = await lease.boot(async () => {
      return harness.boot({ world, phase: `${phase}-${label}`, bootTimeoutMs: 300_000 })
    })
    const origin = new URL(boot.url).origin
    const cookie = await authenticate(origin, world.token)
    const health = await waitHealthy(origin, cookie, 120_000)
    if (health?.ok !== true) throw new Error(`the ${label} host never became ready: ${JSON.stringify(health?.body ?? null).slice(0, 500)}`)
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
      try { writeFileSync(join(bootDir, `prompt-${tag}.json`), `${JSON.stringify({ status: res?.status ?? null, body: redact(JSON.stringify(res?.body ?? null)) }, null, 2)}\n`) } catch { /* diagnostic */ }
      if (res?.status !== 200) throw new Error(`session/prompt(${tag}) failed: status=${String(res?.status)}`)
    }

    await promptTurn(MK_WRK, `d4wrk-${label}`)
    if (!(await waitFor(() => sawReply(DONE_WRK), 120_000))) throw new Error(`the ${label} worker delegation never answered`)
    const workerUp = await waitFor(async () => {
      const st = await readState(origin, cookie)
      return membersOf(st).some((m) => String(m?.templateId ?? '') === 'worker')
    }, 120_000, 300)
    if (!workerUp) throw new Error(`the ${label} worker instance never came up`)
    const state = await readState(origin, cookie)
    const workerRow = membersOf(state).find((m) => String(m?.templateId ?? '') === 'worker') ?? null
    ids.worker = String(workerRow.instanceId)
    const askAppeared = await waitFor(async () => {
      const st = await readState(origin, cookie)
      const row = pendingAskOf(st, ids.worker)
      if (row !== null && ids.pendingRequestId === null) ids.pendingRequestId = String(row.requestId)
      return row !== null
    }, 180_000, 300)
    if (!askAppeared) throw new Error(`the ${label} arm never raised a pending Control request`)
    writeFileSync(join(bootDir, `${label}-ask.json`), `${JSON.stringify({ requestId: ids.pendingRequestId, worker: ids.worker }, null, 2)}\n`)

    let resolveOutcome = null
    if (kind === 'deny') {
      // Deny through the SAME real control path the positive arm uses.
      await promptTurn(MK_RESOLVE, `d4res-${label}`)
      await waitFor(() => sawReply(DONE_RESOLVE), 120_000)
      const leaderTx = readMemberTranscript(world.home, ROOT)
      const resolveCall = (leaderTx?.calls ?? []).find((c) => String(c.callId) === CALL_RESOLVE) ?? null
      resolveOutcome = { call: resolveCall?.arguments ?? null, result: resolveCall?.result?.text?.slice(0, 800) ?? null, isError: resolveCall?.result?.isError ?? null }
    } else {
      // STOP WHILE PENDING: cancel the WORKER's own session (the host's turn abort). The admission
      // port combines this signal with its own close and the ONE wait bridge abandons the inline ask.
      const cancel = await apiSessionCancel(origin, cookie, String(workerRow.childSessionId), `d4stop-${label}`)
      cancelStatus = cancel?.status ?? null
    }

    // Wait for the product to settle the call; never a fixed sleep as the evidence.
    const terminal = await waitFor(() => {
      const settled = settlementOf(world.home, ids.worker, CALL_WRK_WRITE)
      settleAttempts += 1
      return settled.present === true && (settled.state === 'REFUSED' || settled.state === 'CANCELLED' || settled.state === 'COMPLETED' || settled.state === 'FAILED')
    }, 120_000, 400)
    await sleep(700)
    const file = fileEvidence(target)
    const settlement = settlementOf(world.home, ids.worker, CALL_WRK_WRITE)
    const facts = factsFor(readLedger(world.home, ids.worker), CALL_WRK_WRITE)
    const verdict = kind === 'deny'
      ? judgeAskDenied({ requestRaised: ids.pendingRequestId !== null, resolveOutcome, file, facts, settlement })
      : judgeAskStopped({ requestRaised: ids.pendingRequestId !== null, cancelStatus, file, facts, settlement })
    writeFileSync(join(bootDir, `${label}.json`), `${JSON.stringify({
      kind, terminal, resolveOutcome, cancelStatus, file, settlement, facts, verdict,
    }, null, 2)}\n`)
    fnWriteVerdict(bootDir, label, verdict)
    log(`[boot${String(index)}] d4:${label}=${verdict.verdict} failing=${JSON.stringify(verdict.failing)}`)
    return { verdict, worldId: world.id, requestId: ids.pendingRequestId, cancelStatus, file: { exists: file.exists, bytes: file.bytes, sha256: file.sha256 }, settlement: { state: settlement.state, bodyOutcome: settlement.bodyOutcome }, resolveOutcome }
  } catch (error) {
    const verdict = verdictOf(`${kind} arm must run`, [{ id: 'arm-ran', ok: false, detail: String(error?.message ?? error) }])
    log(`[boot${String(index)}] d4:${label} ARM FAILED: ${String(error?.message ?? error)}`)
    writeFileSync(join(bootDir, `${label}-failure.json`), `${JSON.stringify({ error: String(error?.stack ?? error) }, null, 2)}\n`)
    fnWriteVerdict(bootDir, label, verdict)
    return { verdict, error: String(error?.message ?? error) }
  } finally {
    if (world !== null) {
      try { await world.teardown({ keepHome: false }) } catch (error) { log(`[boot${String(index)}] ${label} teardown note: ${String(error?.message ?? error)}`) }
    }
  }
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
    selectedCases: ['d4:enablement', 'd4:officer-up', 'd4:officer-binding', 'd4:routed-wake', 'd4:refusal', 'd4:ask-execute', 'd4:ask-denied', 'd4:ask-stopped'],
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

  // The Member's OWN workspace is the host sandbox's root, so the probe's target MUST live inside it:
  // a target outside would be refused by the HOST's workspace-write sandbox and would prove nothing
  // about the lane or the receipt. The world is created before the blueprint is authored so the
  // authored ask lane and the bytes it approves are both inside that root.
  let dirs = null
  let paths = null
  const ids = { officer: null, worker: null, pendingRequestId: null, pendingRequestId2: null, pendingRequestId3: null }
  // ROUND 97 — the duplicate-route and Sticky-Stop measurements are filled by their own arms below;
  // a judge that never got its arm is REFUTED (it must never default to "passed").
  let duplicateMeasurement = null
  let stickyMeasurement = null
  let world = null
  let refusalWorld = null
  let teardown = null
  let refusalTeardown = null
  let result = null
  let failure = null
  const startedBoot = Date.now()

  try {
    // ── the POSITIVE world: one coherent v5 row ──
    world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
    mkdirSync(world.workspaceDir, { recursive: true })
    dirs = { dir: join(world.workspaceDir, 'lane') }
    mkdirSync(dirs.dir, { recursive: true })
    paths = {
      dir: dirs.dir,
      officerFile: join(dirs.dir, 'officer-read.txt'),
      workerFile: join(dirs.dir, 'worker-ask.txt'),
      // The second mutation's target: a DIFFERENT file, inside the same Member workspace lane.
      workerFile2: join(dirs.dir, 'worker-ask-2.txt'),
      workerFile3: join(dirs.dir, 'worker-ask-3.txt'),
    }
    writeFileSync(paths.officerFile, 'DBOOT_D4_OFFICER_READ_SOURCE\n', 'utf8')
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
    mkdirSync(join(world.home, 'blueprints'), { recursive: true })
    writeFileSync(join(world.home, 'blueprints', 'main.yaml'), main)
    writeFileSync(join(world.home, 'p6t6-directive.json'), `${JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2)}\n`)
    world.u6Fs.rows.push(...composedRows({ home: world.home, mainYaml: main, alpha6: { enabled: true, wakeIntentPath: join(world.home, WAKE_DIR) } }))
    record.record.bindings.compositionDrops = COMPOSITION_DROPS
    writeFileSync(join(bootDir, 'composition-drops.json'), `${JSON.stringify(COMPOSITION_DROPS, null, 2)}\n`)
    await world.startMock({ decide: makeDecide({ paths, ids }) })
    const boot = await lease.boot(async () => {
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
      // DIAGNOSTIC (kept): the turn's own answer text, redacted, so a delegation that the Leader could
      // not complete is visible in the boot artefacts instead of only as a timeout.
      try {
        writeFileSync(join(bootDir, `prompt-${tag}.json`), `${JSON.stringify({ status: res?.status ?? null, body: redact(JSON.stringify(res?.body ?? null)) }, null, 2)}\n`)
      } catch { /* diagnostic only */ }
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

    // ── ROUND 97: the OFFICER decides — the product wakes it, not the Leader ─────────────────────
    //
    // The case-bearing ask is routed by the product's own notifier to the Officer's session. The
    // Officer's OWN `team_resolve_control` is the decision; the Leader is not prompted and receives no
    // plain C1 ask (the judge asserts that absence). `resolveOutcome` below therefore carries the
    // OFFICER's call — the existing R3 judge's clause ("approved through the real control path") is
    // unchanged and is now satisfied by the lawful reviewer.
    const officerResolveOf = async (requestId, label) => {
      const callId = CALL_OFF_RESOLVE(requestId)
      const seen = await waitFor(() => {
        const tx = readMemberTranscript(world.home, String(officerRow.childSessionId))
        return (tx?.calls ?? []).some((c) => String(c.callId) === callId && c.result !== null && c.result !== undefined)
      }, 180_000, 400)
      const tx = readMemberTranscript(world.home, String(officerRow.childSessionId))
      const call = (tx?.calls ?? []).find((c) => String(c.callId) === callId) ?? null
      const settlement = settlementOf(world.home, ids.officer, callId)
      const outcome = { seen, callId, call: call?.arguments ?? null, result: call?.result?.text?.slice(0, 800) ?? null, isError: call?.result?.isError ?? null, settlement }
      writeFileSync(join(bootDir, `officer-resolve-${label}.json`), `${JSON.stringify(outcome, null, 2)}\n`)
      log(`[boot${String(index)}] officer resolve(${label}) seen=${String(seen)} settlement=${String(settlement?.state)} result=${String(outcome.result).slice(0, 160)}`)
      return outcome
    }
    let resolveOutcome = null
    if (ids.pendingRequestId !== null) {
      const officerResolve = await officerResolveOf(ids.pendingRequestId, 'first')
      resolveOutcome = officerResolve.seen ? { call: officerResolve.call, result: officerResolve.result, isError: officerResolve.isError } : null
    }

    // ── R3 POSITIVE: the approved worker `write` must now EXECUTE through the confined Provider ──
    //
    // The write was admitted with disposition `ask`; the Leader's allow is the durable decision; the
    // centre rechecks, consumes the one-shot grant, mints the receipt and delivers it only inside the
    // tool body. The Provider verifies it and writes REAL bytes. Wait for the worker's tool RESULT and
    // the settlement — never for a fixed sleep — then read the bytes from the HOST filesystem.
    const writeSettled = await waitFor(() => {
      const tx = readMemberTranscript(world.home, String(workerRow.childSessionId))
      const call = (tx?.calls ?? []).find((c) => String(c.callId) === CALL_WRK_WRITE) ?? null
      const settled = settlementOf(world.home, ids.worker, CALL_WRK_WRITE)
      return call?.result !== null && call?.result !== undefined && settled.present === true
    }, 120_000, 400)
    await sleep(500)
    const workerTxFinal = readMemberTranscript(world.home, String(workerRow.childSessionId))
    const workerWriteCall = (workerTxFinal?.calls ?? []).find((c) => String(c.callId) === CALL_WRK_WRITE) ?? null
    const askFile = fileEvidence(paths.workerFile)
    const askSettlement = settlementOf(world.home, ids.worker, CALL_WRK_WRITE)
    const workerLedgerFinal = readLedger(world.home, ids.worker)
    const askFacts = factsFor(workerLedgerFinal, CALL_WRK_WRITE)
    const askExecuteVerdict = judgeAskExecute({
      requestRaised: ids.pendingRequestId !== null,
      resolveOutcome,
      file: askFile,
      expectedBytes: `${WORKER_TEXT}\n`,
      facts: askFacts,
      settlement: askSettlement,
      writeCall: workerWriteCall,
    })
    writeFileSync(join(bootDir, 'ask-execute.json'), `${JSON.stringify({
      writeSettled,
      requestId: ids.pendingRequestId,
      resolveOutcome,
      workerWriteCall,
      file: askFile,
      settlement: askSettlement,
      facts: askFacts,
      verdict: askExecuteVerdict,
    }, null, 2)}\n`)
    fnWriteVerdict(bootDir, 'ask-execute', askExecuteVerdict)
    log(`[boot${String(index)}] d4:ask-execute=${askExecuteVerdict.verdict} failing=${JSON.stringify(askExecuteVerdict.failing)}`)

    // ── R3 SECOND LIVE MUTATION: the SAME worker asks again, for DIFFERENT bytes on a DIFFERENT path ──
    //
    // The worker model issues its second `write` only after the first call RETURNED, so the request
    // measured here is a genuinely NEW approval, not the first one re-read. This is the live half of
    // the content-binding judge: two approvals, two receipts, two files, two digests.
    // Read the SECOND ask from the DURABLE ledger, not from the pending projection: the officer can
    // settle a leg in well under one poll interval, and a projection that only lists PENDING rows then
    // misses the ask entirely (round 97 measured exactly that miss — the ask and its decision existed
    // on disk while the poll saw nothing). The durable fact cannot be missed.
    const ask2Appeared = await waitFor(() => {
      const asks = readTeamDomainLedger(world.home)
        .filter((fact) => fact?.factType === 'control-request-recorded')
        .map((fact) => fact.payload)
        .filter((row) => String(row?.requestId ?? '') !== String(ids.pendingRequestId ?? ''))
      if (asks.length === 0) return false
      ids.pendingRequestId2 = String(asks[asks.length - 1].requestId)
      return true
    }, 180_000, 300)
    log(`[boot${String(index)}] second worker ask appeared=${String(ask2Appeared)} requestId=${String(ids.pendingRequestId2)}`)
    let resolveOutcome2 = null
    if (ids.pendingRequestId2 !== null && ids.pendingRequestId2 !== undefined) {
      const officerResolve2 = await officerResolveOf(ids.pendingRequestId2, 'second')
      resolveOutcome2 = officerResolve2.seen ? { call: officerResolve2.call, result: officerResolve2.result, isError: officerResolve2.isError } : null
    }
    const write2Settled = await waitFor(() => {
      const tx = readMemberTranscript(world.home, String(workerRow.childSessionId))
      const call = (tx?.calls ?? []).find((c) => String(c.callId) === CALL_WRK_WRITE2) ?? null
      const settled = settlementOf(world.home, ids.worker, CALL_WRK_WRITE2)
      return call?.result !== null && call?.result !== undefined && settled.present === true
    }, 180_000, 400)
    await sleep(500)
    const workerTxFinal2 = readMemberTranscript(world.home, String(workerRow.childSessionId))
    const workerWriteCall2 = (workerTxFinal2?.calls ?? []).find((c) => String(c.callId) === CALL_WRK_WRITE2) ?? null
    const askFile2 = fileEvidence(paths.workerFile2)
    const askSettlement2 = settlementOf(world.home, ids.worker, CALL_WRK_WRITE2)
    const askFacts2 = factsFor(readLedger(world.home, ids.worker), CALL_WRK_WRITE2)
    const askExecute2Verdict = judgeAskExecute2({
      requestRaised: ask2Appeared === true,
      requestIsNew: ids.pendingRequestId2 !== null && ids.pendingRequestId2 !== undefined && ids.pendingRequestId2 !== ids.pendingRequestId,
      resolveOutcome: resolveOutcome2,
      file: askFile2,
      firstFile: askFile,
      expectedBytes: `${WORKER_TEXT2}\n`,
      firstExpectedBytes: `${WORKER_TEXT}\n`,
      facts: askFacts2,
      settlement: askSettlement2,
      writeCall: workerWriteCall2,
    })
    writeFileSync(join(bootDir, 'ask-execute-2.json'), `${JSON.stringify({
      writeSettled: write2Settled,
      requestId: ids.pendingRequestId2,
      resolveOutcome: resolveOutcome2,
      workerWriteCall: workerWriteCall2,
      file: askFile2,
      firstFile: askFile,
      settlement: askSettlement2,
      facts: askFacts2,
      verdict: askExecute2Verdict,
    }, null, 2)}\n`)
    fnWriteVerdict(bootDir, 'ask-execute-2', askExecute2Verdict)
    log(`[boot${String(index)}] d4:ask-execute-2=${askExecute2Verdict.verdict} failing=${JSON.stringify(askExecute2Verdict.failing)}`)

    // ── ROUND 97: Sticky Stop — a HUMAN stop outranks a MACHINE wake ─────────────────────────────
    //
    // The product writes the Sticky Stop ONLY from a real user cancel of a RUNNING turn of a session
    // the latch already watches (host.ts maps `turn/end` + aborted/user to `alpha6WakeUserStop`). So
    // the arm is: (1) a HUMAN prompt starts a long Officer turn, (2) the host's own `session/cancel`
    // aborts it, (3) a THIRD worker ask is admitted while stopped and the product routes it, (4) no
    // wake input may reach the stopped Officer, (5) a HUMAN prompt to the Officer is the only resume,
    // and (6) the held wake is then delivered and its decision executes the third write.
    const intentDir = join(world.home, 'alpha6-wake-intent')
    const stopMarkers = () => {
      try { return readdirSync(intentDir).filter((name) => name.startsWith('stopped-') && name.endsWith('.json')).sort() }
      catch { return [] }
    }
    const officerWakeInputs = () => (readMemberTranscript(world.home, String(officerRow.childSessionId))?.user ?? [])
      .filter((text) => String(text).includes('[team-review-wake')).length
    const wakeInputsBeforeStop = officerWakeInputs()
    const holdPrompt = await apiPrompt(origin, cookie, String(officerRow.childSessionId), `${MK_HOLD} hold the turn open for a real human cancel`, 'd4hold')
    // Two independent witnesses: the prompt LANDED as a user message of the Officer session, and the
    // turn is RUNNING (it has issued hold reads). A prompt that never lands is a different defect from
    // a turn that never starts.
    const holdLanded = await waitFor(() => (readMemberTranscript(world.home, String(officerRow.childSessionId))?.user ?? [])
      .some((text) => String(text).includes(MK_HOLD)), 20_000, 100)
    const holdRunning = await waitFor(() => (readMemberTranscript(world.home, String(officerRow.childSessionId))?.calls ?? [])
      .filter((call) => String(call.callId).startsWith('call-d4-officer-hold-')).length >= 2, 30_000, 100)
    const stopCancel = await apiSessionCancel(origin, cookie, String(officerRow.childSessionId), 'd4sticky')
    const stopSeen = await waitFor(() => stopMarkers().length > 0, 30_000, 100)
    const stopMarkersBefore = stopMarkers()
    log(`[boot${String(index)}] sticky: holdLanded=${String(holdLanded)} hold=${String(holdRunning)} cancelStatus=${String(stopCancel?.status ?? null)} stopSeen=${String(stopSeen)} markers=${JSON.stringify(stopMarkersBefore)}`)

    // (3) THE MACHINE ATTEMPT: a THIRD admission ask from the worker while the Officer is stopped.
    const thirdAskPrompt = await apiPrompt(origin, cookie, String(workerRow.childSessionId), `${MK_WORK3} issue the third write`, 'd4work3')
    const thirdAskAppeared = await waitFor(() => {
      const asks = readTeamDomainLedger(world.home)
        .filter((fact) => fact?.factType === 'control-request-recorded')
        .map((fact) => fact.payload)
        .filter((row) => ![ids.pendingRequestId, ids.pendingRequestId2].map(String).includes(String(row?.requestId ?? '')))
      if (asks.length === 0) return false
      ids.pendingRequestId3 = String(asks[asks.length - 1].requestId)
      return true
    }, 120_000, 300)
    // Give the fire-and-forget notifier its turn: the latch must REFUSE to deliver to a stopped
    // reviewer. Then measure.
    await sleep(2000)
    const stopMarkersAfter = stopMarkers()
    const wakeInputsAfterAttempt = officerWakeInputs()
    const wakeInputsWhileStopped = wakeInputsAfterAttempt - wakeInputsBeforeStop
    log(`[boot${String(index)}] sticky: thirdAsk=${String(thirdAskAppeared)} requestId=${String(ids.pendingRequestId3)} markersAfter=${JSON.stringify(stopMarkersAfter)} wakeInputsWhileStopped=${String(wakeInputsWhileStopped)}`)

    // (5) THE ONLY RESUME: an explicit HUMAN prompt to the stopped Officer.
    const resumePrompt = await apiPrompt(origin, cookie, String(officerRow.childSessionId), `${MK_RESUME} resume`, 'd4resume')
    const resumeCleared = await waitFor(() => stopMarkers().length === 0, 30_000, 100)
    let resolveOutcome3 = null
    if (ids.pendingRequestId3 !== null && ids.pendingRequestId3 !== undefined) {
      const officerResolve3 = await officerResolveOf(ids.pendingRequestId3, 'third')
      resolveOutcome3 = officerResolve3.seen ? { call: officerResolve3.call, result: officerResolve3.result, isError: officerResolve3.isError } : null
    }
    const write3Settled = await waitFor(() => {
      const tx = readMemberTranscript(world.home, String(workerRow.childSessionId))
      const call = (tx?.calls ?? []).find((c) => String(c.callId) === CALL_WRK_WRITE3) ?? null
      const settled = settlementOf(world.home, ids.worker, CALL_WRK_WRITE3)
      return call?.result !== null && call?.result !== undefined && settled.present === true
    }, 180_000, 400)
    const workerTxFinal3 = readMemberTranscript(world.home, String(workerRow.childSessionId))
    const workerWriteCall3 = (workerTxFinal3?.calls ?? []).find((c) => String(c.callId) === CALL_WRK_WRITE3) ?? null
    const askFile3 = fileEvidence(paths.workerFile3)
    const askSettlement3 = settlementOf(world.home, ids.worker, CALL_WRK_WRITE3)
    stickyMeasurement = {
      stoppedBefore: stopSeen === true,
      stoppedMarkersBefore: stopMarkersBefore,
      machineAttempted: thirdAskAppeared === true,
      machineAttempt: { holdLanded: holdLanded === true, holdStatus: holdPrompt?.status ?? null, cancelStatus: stopCancel?.status ?? null, resumeStatus: resumePrompt?.status ?? null, thirdRequestId: ids.pendingRequestId3 ?? null },
      stoppedAfter: stopMarkersAfter.length > 0,
      stoppedMarkersAfter: stopMarkersAfter,
      wakeInputsWhileStopped: Math.max(0, wakeInputsWhileStopped),
      humanResumeCleared: resumeCleared === true,
      humanResume: { status: resumePrompt?.status ?? null, markersAfterResume: stopMarkers().length },
      resumedWakeDelivered: resolveOutcome3 !== null,
      write3: { settled: write3Settled === true, file: { exists: askFile3.exists, bytes: askFile3.bytes, sha256: askFile3.sha256 }, settlement: askSettlement3.state, result: workerWriteCall3?.result?.isError ?? null },
    }
    writeFileSync(join(bootDir, 'sticky-stop.json'), `${JSON.stringify(stickyMeasurement, null, 2)}\n`)
    log(`[boot${String(index)}] sticky: resumeCleared=${String(resumeCleared)} resolve3=${String(resolveOutcome3 !== null)} write3Settled=${String(write3Settled)}`)

    const wakeFacts = [
      ...factsOfType(world.home, 'team-review-wake-routed'),
      ...factsOfType(world.home, 'team-review-wake-delivered'),
    ].map((h) => ({ factType: h.row.factType ?? h.row.type, sequence: h.row.sequence ?? null, file: h.file, payload: h.row.payload ?? null }))
    // ── ROUND 97: duplicate route — the SAME leg must produce ONE wake ───────────────────────────
    //
    // The product re-collects pending legs at EVERY reviewer turn end (`alpha6ReviewWakeTurnEnd`)
    // and routes them through the same notifier the request-creation path uses. The second leg was
    // ALREADY delivered when the Officer's first wake turn ended (its intent is sequence 14, its
    // decision sequence 16), so the turn-end re-collection necessarily presented the same leg while
    // it was still pending: a real duplicate route attempt. The latch must converge it — one intent,
    // one confirmation, ONE model-visible input for that leg.
    const leg2Token = String(wakeFacts.find((entry) => entry.factType === 'team-review-wake-routed'
      && String(entry?.payload?.requestId ?? '') === String(ids.pendingRequestId2 ?? ''))?.payload?.requestToken ?? '')
    const leg2IntentFacts = wakeFacts.filter((entry) => entry.factType === 'team-review-wake-routed'
      && String(entry?.payload?.requestToken ?? '') === leg2Token).length
    const leg2DeliveredFacts = wakeFacts.filter((entry) => entry.factType === 'team-review-wake-delivered'
      && String(entry?.payload?.requestToken ?? '') === leg2Token).length
    const leg2WakeInputs = (readMemberTranscript(world.home, String(officerRow.childSessionId))?.user ?? [])
      .filter((text) => String(text).includes('[team-review-wake') && String(text).includes(String(ids.pendingRequestId2 ?? '\u0000'))).length
    const leg2Decision = readTeamDomainLedger(world.home).find((fact) => fact?.factType === 'control-decision-recorded'
      && String(fact?.payload?.requestId ?? '') === String(ids.pendingRequestId2 ?? '')) ?? null
    const leg2Intent = wakeFacts.find((entry) => entry.factType === 'team-review-wake-routed'
      && String(entry?.payload?.requestToken ?? '') === leg2Token) ?? null
    duplicateMeasurement = {
      attempted: leg2Intent !== null && leg2Decision !== null,
      via: 'request-creation notifier + reviewer turn/end re-collection (the product\'s own two route call sites)',
      intentFacts: leg2IntentFacts,
      deliveredFacts: leg2DeliveredFacts,
      wakeInputs: leg2WakeInputs,
      converged: leg2IntentFacts === 1 && leg2DeliveredFacts === 1 && leg2WakeInputs === 1,
      detail: { requestId: ids.pendingRequestId2 ?? null, requestToken: leg2Token || null, intentAt: leg2Intent?.payload?.at ?? null, decisionAt: leg2Decision?.createdAt ?? null },
    }
    writeFileSync(join(bootDir, 'duplicate-route.json'), `${JSON.stringify(duplicateMeasurement, null, 2)}\n`)
    log(`[boot${String(index)}] duplicate: intents=${String(leg2IntentFacts)} delivered=${String(leg2DeliveredFacts)} inputs=${String(leg2WakeInputs)}`)

    // ── the governed delivery should have happened by now: measure it ──
    await sleep(1500)
    const officerTxAfter = readMemberTranscript(world.home, String(officerRow.childSessionId))
    const leaderTx = readMemberTranscript(world.home, ROOT)
    const leaderUserText = (leaderTx?.user ?? []).join('\n')
    const officerUserText = (officerTxAfter?.user ?? []).join('\n')
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
      // THE REAL DURABLE MEMBER VIEW. The pre-R1 probe answered `[]` on purpose: with a case-less row
      // the router refuses BEFORE the officer query, so an empty view could not change the verdict.
      // A routed verdict needs the product's own member snapshot, so the probe now serves the SAME
      // members `/__p6t6/state` serves (no invented rows: the officer row below came from the boot).
      const memberSnapshot = membersOf(await readState(origin, cookie))
      const memberList = memberSnapshot.map((m) => ({
        ...m,
        // `/__p6t6/state` serializes absent fields as the string 'undefined'; the router reads the
        // durable snapshot shape, so restore absence (never invent a lifecycle).
        ...(String(m?.childSessionId ?? '') === 'undefined' ? { childSessionId: undefined } : {}),
        ...(String(m?.lifecycle ?? '') === 'undefined' ? { lifecycle: undefined } : {}),
      }))
      // THE ROUTE IS EVALUATED ON THE ROW AS IT WAS WHEN IT WAS PENDING. `ledgerRows` is the snapshot
      // the probe took BEFORE any decision (and it is the same snapshot `d4:case-created` reads), so
      // every request in it is pending by construction — derive nothing from the later ledger state,
      // which by now has settled every leg. Routing a decided row would return null and measure
      // nothing; routing the captured row measures the real router's decision for the real leg.
      const requests = ledgerRows
        .filter((fact) => fact?.factType === 'control-request-recorded')
        .map((fact) => ({ ...fact.payload, status: 'pending' }))
      const router = createAlpha6RootRouter({
        rootSessionId: ROOT,
        routing: parsed.routing,
        leaderTemplateId: parsed.blueprint.leader.templateId,
        control: {
          readControlState: async () => ({
            requests,
            decisions: [],
            consumptions: [],
            transfers: [],
          }),
        },
        members: {
          list: async () => { memberListCalls += 1; return memberList },
          get: async (_rootSessionId, instanceId) => { memberListCalls += 1; return memberList.find((m) => String(m?.instanceId ?? '') === String(instanceId)) },
        },
        fixedLeaderOrHumanCategory: () => false,
      })
      const route = await router.route(String(ids.pendingRequestId))
      // SELF-ASK NEGATIVE CONTROL (round 97): the SAME product router, the SAME durable row, with the
      // ONLY field that defines a self-ask changed to the Officer's own template — the operation owner
      // IS the Officer. The router must NEVER select that Officer to review itself. Nothing else about
      // the row is altered, and no verdict here depends on the fact that the control input was
      // synthesized: it is the policy's answer to the self-ask condition.
      const selfAskRouter = createAlpha6RootRouter({
        rootSessionId: ROOT,
        routing: parsed.routing,
        leaderTemplateId: parsed.blueprint.leader.templateId,
        control: {
          readControlState: async () => ({
            requests: requests.map((row) => (String(row.requestId) === String(ids.pendingRequestId)
              ? { ...row, operationOwnerTemplateId: String(officerRow?.templateId ?? 'officer') }
              : row)),
            decisions: [],
            consumptions: [],
            transfers: [],
          }),
        },
        members: {
          list: async () => memberList,
          get: async (_rootSessionId, instanceId) => memberList.find((m) => String(m?.instanceId ?? '') === String(instanceId)),
        },
        fixedLeaderOrHumanCategory: () => false,
      })
      const selfAskRoute = await selfAskRouter.route(String(ids.pendingRequestId))
      routeProbe = {
        route,
        selfAskRoute,
        memberListCalls,
        officerInstanceId: String(officerRow?.instanceId ?? ''),
        officerCandidateCount: memberList.filter((m) => String(m?.templateId ?? '') === String(parsed.routing.officerTemplateId)
          && String(m?.childSessionId ?? '') !== ''
          && ['CREATED', 'RUNNING', 'SETTLED'].includes(String(m?.lifecycle ?? ''))).length,
        requesterInstanceId: String(durable?.row?.requester?.instanceId ?? ''),
      }
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

    // The reader's own positive control. It used to assert exactly ONE control request, which was
    // right when the world raised one ask; round 96 raises a SECOND (different path, different
    // bytes). The honest control is "the ledger holds exactly the asks this world OBSERVED", so a
    // reader that misses one still fails, and a second real ask is not mistaken for a broken reader.
    const observedRequests = [ids.pendingRequestId, ids.pendingRequestId2, ids.pendingRequestId3]
      .filter((value) => value !== null && value !== undefined).length
    const observedDecisions = [resolveOutcome, resolveOutcome2, resolveOutcome3]
      .filter((value) => value !== null && value !== undefined).length
    if (factTypeCensus['control-request-recorded'] !== observedRequests || factTypeCensus['control-decision-recorded'] !== observedDecisions) {
      throw new Error(`the durable reader is not reading the TeamDomain ledger: control-request-recorded count=${String(factTypeCensus['control-request-recorded'])} (observed ${String(observedRequests)}), control-decision-recorded count=${String(factTypeCensus['control-decision-recorded'])} (observed ${String(observedDecisions)}) census=${JSON.stringify(factTypeCensus)}`)
    }
    // ── ROUND 97 — the seven routed-wake judges, each over durable bytes ──
    const ledgerFinal = readTeamDomainLedger(world.home)
    const decisionFact = ledgerFinal.find((fact) => fact?.factType === 'control-decision-recorded'
      && String(fact?.payload?.requestId ?? '') === String(ids.pendingRequestId ?? '')) ?? null
    const routedFact = wakeFacts.find((entry) => entry.factType === 'team-review-wake-routed'
      && String(entry?.payload?.requestId ?? '') === String(ids.pendingRequestId ?? '')) ?? null
    const managementExecutions = settlementsMentioning(world.home, String(routedFact?.payload?.requestToken ?? ''))
    // Captured while the world is alive: the counters block is assembled AFTER teardown.
    const officerResolveSettlementState = settlementOf(world.home, ids.officer, CALL_OFF_RESOLVE(ids.pendingRequestId)).state
    const caseCreatedVerdict = judgeCaseCreated({ durableRow: durable, ledgerRows })
    const routerOfficerVerdict = judgeRouterOfficer({
      routeProbe,
      officerInstanceId: ids.officer,
      requesterInstanceId: String(durable?.row?.requester?.instanceId ?? ''),
      officerCandidateCount: routeProbe?.officerCandidateCount ?? null,
    })
    const wakeDeliveredVerdict = judgeWakeDelivered({
      requestId: ids.pendingRequestId,
      wakeFacts,
      officerTranscript: officerTxAfter,
      intentFiles: wakeIntentFiles,
      managementExecutions: managementExecutions.length,
    })
    const officerDecidesVerdict = judgeOfficerDecides({
      requestId: ids.pendingRequestId,
      officerTranscript: officerTxAfter,
      officerFacts: factsFor(readLedger(world.home, ids.officer), CALL_OFF_RESOLVE(ids.pendingRequestId)),
      settlement: settlementOf(world.home, ids.officer, CALL_OFF_RESOLVE(ids.pendingRequestId)),
      leaderTranscript: leaderTx,
      officerInstanceId: ids.officer,
    })
    const askAfterReviewVerdict = judgeAskExecutesAfterReview({
      requestId: ids.pendingRequestId,
      decisionFact,
      file: askFile,
      expectedBytes: `${WORKER_TEXT}\n`,
      facts: askFacts,
      settlement: askSettlement,
      writeCall: workerWriteCall,
      reviewDecisionAt: decisionFact?.createdAt ?? null,
    })
    const duplicateVerdict = judgeDuplicateRoute({ duplicate: duplicateMeasurement })
    const stickyVerdict = judgeStickyStop({ sticky: stickyMeasurement })
    const routedVerdict = judgeRoutedWake({
      caseCreated: caseCreatedVerdict,
      routerOfficer: routerOfficerVerdict,
      wakeDelivered: wakeDeliveredVerdict,
      officerDecides: officerDecidesVerdict,
      askExecutesAfterReview: askAfterReviewVerdict,
      duplicateRoute: duplicateVerdict,
      stickyStop: stickyVerdict,
    })
    const routedJudges = {
      caseCreated: caseCreatedVerdict,
      routerOfficer: routerOfficerVerdict,
      wakeDelivered: wakeDeliveredVerdict,
      officerDecides: officerDecidesVerdict,
      askExecutesAfterReview: askAfterReviewVerdict,
      duplicateRoute: duplicateVerdict,
      stickyStop: stickyVerdict,
    }
    writeFileSync(join(bootDir, 'routed-judges.json'), `${JSON.stringify({
      decisionFact, routedFact, managementExecutions, judges: routedJudges, routedWake: routedVerdict,
    }, null, 2)}\n`)
    for (const [name, verdict] of Object.entries(routedJudges)) {
      log(`[boot${String(index)}] d4:${name.replace(/[A-Z]/gu, (ch) => `-${ch.toLowerCase()}`)}=${verdict.verdict} failing=${JSON.stringify(verdict.failing)}`)
    }
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

    // ── R3 NEGATIVE LIVE ARMS ──
    //
    // The positive and refusal worlds still hold the two dev-live slots, so they are torn down
    // BEFORE the negative arms boot. Everything measured from them is captured first; nothing is
    // re-booted and no positive judge is shortened.
    const positiveWorldId = world.id
    const positiveHome = world.home
    const refusalWorldId = refusalWorld.id
    if (refusalWorld !== null) {
      try { refusalTeardown = await refusalWorld.teardown({ keepHome: false }) } catch (error) { log(`refusal teardown note: ${String(error?.message ?? error)}`) }
      refusalWorld = null
    }
    if (world !== null) {
      try { teardown = await world.teardown({ keepHome: false }) } catch (error) { log(`teardown note: ${String(error?.message ?? error)}`) }
      world = null
    }
    const negativeLease = await preRegisterDevLiveBudget({
      grantPath: GRANT_PATH, headCommit: head, runRecord: record,
      face: 'FS Provider', world: LINE, leaseRoot: factory.leaseRoot,
      requiredBoots: 2, // deny-while-pending + Stop-while-pending
    })
    const deniedArm = await runAskNegativeArm({
      kind: 'deny', harness, record, index, bootDir, phase, lease: negativeLease, head,
    })
    const stoppedArm = await runAskNegativeArm({
      kind: 'stop', harness, record, index, bootDir, phase, lease: negativeLease, head,
    })
    try {
      const settled = settleDevLiveLease(negativeLease)
      log(`[boot${String(index)}] negative dev-live slot released (released=${String(settled?.released)} held=${String(settled?.held)})`)
    } catch (error) {
      log(`negative lease settle note: ${String(error?.message ?? error)}`)
    }

    const verdicts = {
      enablement: enablementVerdict,
      officerUp: officerUpVerdict,
      officerBinding: officerVerdict,
      routedWake: routedVerdict,
      // The seven ROUND-97 sub-judges, each its own named verdict (the case is their conjunction).
      caseCreated: caseCreatedVerdict,
      routerOfficer: routerOfficerVerdict,
      wakeDelivered: wakeDeliveredVerdict,
      officerDecides: officerDecidesVerdict,
      askExecutesAfterReview: askAfterReviewVerdict,
      duplicateRoute: duplicateVerdict,
      stickyStop: stickyVerdict,
      refusal: refusalVerdict,
      askExecute: askExecuteVerdict,
      askExecute2: askExecute2Verdict,
      askDenied: deniedArm.verdict,
      askStopped: stoppedArm.verdict,
    }
    const overall = Object.values(verdicts).every((v) => v.verdict === 'PROVEN') ? 'PASS' : 'BLOCKED'
    result = {
      boot: index,
      overall,
      verdicts,
      counters: {
        askAppeared,
        wakeFacts: wakeFacts.length,
        wakeIntentFiles: wakeIntentFiles.length,
        reviewWakeHits: reviewWakeHits.length,
        officerAllowFacts: factsFor(officerLedger, CALL_OFF_READ).filter((f) => f?.kind === 'invocation-authority' && f?.decision === 'allow').length,
        askExecuteBytes: askFile.bytes,
        askExecuteSha256: askFile.sha256,
        askExecuteSettlement: askSettlement.state,
        askExecute2Bytes: askFile2.bytes,
        askExecute2Sha256: askFile2.sha256,
        askExecute2Settlement: askSettlement2.state,
        askDeniedBytes: deniedArm.file?.bytes ?? null,
        askDeniedSettlement: deniedArm.settlement?.state ?? null,
        askStoppedBytes: stoppedArm.file?.bytes ?? null,
        askStoppedSettlement: stoppedArm.settlement?.state ?? null,
        // ROUND 97 — the routed chain's durable counters (the agreement table compares them).
        legOrdinal: durable?.row?.legOrdinal ?? null,
        routeKind: routeProbe?.route?.kind ?? null,
        routeRole: routeProbe?.route?.target?.routeRole ?? null,
        selfAskRouteKind: routeProbe?.selfAskRoute?.kind ?? null,
        selfAskRouteRole: routeProbe?.selfAskRoute?.target?.routeRole ?? null,
        routedWakes: wakeFacts.filter((entry) => entry.factType === 'team-review-wake-routed').length,
        deliveredWakes: wakeFacts.filter((entry) => entry.factType === 'team-review-wake-delivered').length,
        managementExecutions: managementExecutions.length,
        officerResolveSettlement: officerResolveSettlementState,
        duplicateWakeInputs: duplicateMeasurement?.wakeInputs ?? null,
        stickyStopMarkerCount: stickyMeasurement?.stoppedMarkersAfter?.length ?? null,
      },
      ids: { ...ids },
      worldId: positiveWorldId,
      home: positiveHome,
      port: boot.port,
      logPath: boot.logPath,
      refusalWorldId,
      negativeArms: {
        denied: { requestId: deniedArm.requestId ?? null, cancelStatus: deniedArm.cancelStatus ?? null },
        stopped: { requestId: stoppedArm.requestId ?? null, cancelStatus: stoppedArm.cancelStatus ?? null },
      },
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
