#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-live-member/run-boot.mjs — the LIVE Member
 * driver for the SHIPPED governed preset (owner ruling GOVERNED-PRESET,
 * 2026-11-11; evidence/a5sf-governed-preset).
 *
 * WHY THIS FILE EXISTS. The governed preset was merged with boot/config
 * acceptance only: `a5sf-governed-preset.test.mjs` mounts the realm in-process
 * and `150-a5sf-read.mjs --live` refuses `LIVE_SEAM_UNAVAILABLE` because its
 * contract needs a module that reaches a booted Host's Cordis root. Nobody had
 * made a real Member TAKE A TURN inside a governed Realm on a real Host. This
 * driver does exactly that, through public seams only:
 *
 *   1. boot ONE World whose Team row is the SHIPPED `dsh-agent-team/host` row
 *      overridden to opt in — `memberPresetId: a5sf-governed-member`,
 *      `a5sfGovernedRealm: true`, `a5sfEvidencePath`, and a schemaVersion 4
 *      `blueprintSource` carrying a `memberIoCeilings` family;
 *   2. register the SHIPPED `preset-a5sf-governed-member` row verbatim from
 *      `cordis.patch.yml` (only the `!!js` platform expression is evaluated);
 *   3. drive a REAL Leader turn (`/api/session/prompt` on the boot team) that
 *      calls `team_delegate` with an explicit NEW Member on the `worker`
 *      template and `async: false`;
 *   4. the Member's OWN model turn calls the model-visible `bash` twice — once
 *      reading a file INSIDE the compiled read ceiling, once reading a file
 *      OUTSIDE it;
 *   5. capture the Member's own durable session transcript (the child
 *      session's `session.jsonl.zstd`), the guard-consult facts the product
 *      sink wrote, an independent /proc observation of confined-provider
 *      spawns vs base `bwrap` spawns, and the mock provider's request log.
 *
 * ONE COMMAND, TWO BOOTS (the agreeing pair):
 *
 *   node tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs
 *
 * `--plan` is host-free (row/blueprint validation, zero boots). `--boots 1`
 * is a development iteration. Artefacts: `dev/agent-workflow/evidence/
 * d-boot-feasibility/runs/boot0N/`, the append-only DEV-LIVE ledger beside them.
 *
 * BOOT DISCIPLINE (non-negotiable, TEST_METHODS §2/§7):
 *   - DSH_HOME = tests/homes/u5a5sfdev1-<stamp> (inside the workspace);
 *   - ports from the 3180 family via WorldFactory leases; :3080 never touched;
 *   - the pinned host tree is READ-ONLY (porcelain verified empty at the end);
 *   - <= 2 concurrent dev Hosts via lib/dev-live-slots.mjs (one lease per boot);
 *   - archive-before-start: a previous `runs/` directory is moved to
 *     `archive/<stamp>/` before this run writes anything;
 *   - teardown by identity through the World's own teardown;
 *   - every start appends a ledger row with `recordClass: 'DEV-LIVE'`.
 *
 * WHAT IS FIXTURE (disclosed): the model is the shared scripted mock
 * (`packages/tools/harness/mock-deepseek.mjs`); the /proc watcher and the
 * mock-request log are test instrumentation. The product path is NOT a
 * fixture: the preset row, the realm provider, the compiler, the guard, the
 * confined terminal face and the confined process provider are the shipped
 * modules the Host loads from `packages/runtime/dist`.
 *
 * CORE PATCH BUDGET = 0.
 *
 * @module tests/world-factory/drivers/d-boot-feasibility/run-boot
 */
/**
 * D-BOOT-FEASIBILITY ADAPTATION (2026-11-22, branch `vnext/a1-cut`).
 *
 * Derived from `tests/world-factory/drivers/a5sf-live-member/run-boot.mjs`
 * (the proven governed-preset live Member driver) with FOUR deliberate changes,
 * each named in the evidence README so no proposition is swapped silently:
 *
 *   1. The Member's tool call is the UNMODIFIED NATIVE `read` (the host's own
 *      `@deepseek-ai/dsh-tool-fs` definition), not the confined `bash` face.
 *      This is the D question: on a Member scope, does an unmodified native
 *      tool resolve to THAT member's controlled Provider with NO shadow?
 *   2. The Team row sets `centreStatePath`, so the product's ONE admission
 *      centre (`installMemberCentre`) is installed at the member bind — the
 *      D round's acceptance subject — and its durable per-member fact ledger
 *      (`<centreStatePath>/<instanceId>.facts.jsonl`) is read back.
 *   3. There is no /proc spawn predicate: a `read` does not spawn. The
 *      "not the base provider" witness is the typed out-of-ceiling refusal
 *      (a base provider WOULD have returned the secret bytes).
 *   4. It writes only under `dev/agent-workflow/evidence/d-boot-feasibility`
 *      and boots on the FS face's existing dev-live grant/world line.
 *
 * What is fixture: the scripted mock model, and the /proc sampler (kept only
 * as an observation, it judges nothing here). The product path — the shipped
 * `dsh-agent-team/host` row, the shipped governed preset, the realm provider,
 * the policy compiler, the confined Provider, the centre and its ledger — is
 * the real module set the Host loads from `packages/runtime/dist`.
 *
 * CORE PATCH BUDGET = 0: no upstream write, no compatibility layer.
 *
 * MEASURED DEVIATIONS AT HEAD 3fb8882f8 (2026-11-22; see
 * evidence/ute-a1/D-BOOT-FEASIBILITY.md). These are NOT silent: each is
 * recorded in the run's `composition-drops.json` / bindings.
 *
 *   5. `A5SF_WF_NO_INSTALL_GRAPH=1` is required to reach a World at all: the
 *      cut deleted `live/confined-web-tool.mjs` but `package.json` still
 *      exports `./web-tool`, and WorldFactory verifies every declared export,
 *      so the shipped install graph refuses with A5SF_PROFILE_GRAPH_UNRESOLVED.
 *      The preset's dead `tool-web` row is consequently dropped from THIS
 *      composition (recorded); no product file is edited.
 *   6. `DBOOT_WITHOUT_CENTRE=1` is a DIAGNOSTIC arm, never acceptance: it omits
 *      `centreStatePath` so the host's legacy remote mount finds its seam, and
 *      is expected to boot and then be refused at Member attach.
 *   7. The `runId`/`suite` strings still read `a5sf-live-member`: the record
 *      shape is inherited from the ancestor driver. Artifacts under
 *      evidence/d-boot-feasibility are this driver's, and the report says so.
 *
 * ROUND 60 (2026-11-22, escalation path 3 — `ESCALATION-centre-row-creation-entrance.md`).
 * The round-59 blocker was that the driver's ONLY creation entrance was
 * `POST /team-remote/team.create`, which a centre-configured row refuses by
 * design (C-remote will not build the S6 plane: `root.ts:4324`, seam only
 * installed at `root.ts:4722-4730`; host.ts then records `skipped`, so the
 * route 405s). This revision exercises the entrance the product ALREADY has on
 * such a row: the boot create (`root.ts:4888-4925`). The row's
 * `blueprintSource` is now the v4 `main` blueprint itself (the identical
 * document the remote entrance used to receive via `blueprintId`), the
 * boot-created Team lives on `BOOT_ROOT`, and the Leader's first turn is sent
 * with `apiPrompt` instead of the remote `initialWork`. NO judge, assertion,
 * timeout, retry, composition row or fixture value changed.
 *
 * DISCLOSED LIMIT (not hidden): on a centre-configured row the product has no
 * RUNTIME team-creation entrance. The measured Team is boot-created; a second
 * team cannot be created at runtime on this row. That is a product gap
 * (escalation shapes 1/2), not a measurement artifact, and this driver must
 * not be read as proving it away.
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
import { settleDevLiveLease } from '../../lib/dev-live-slots.mjs'
import { preRegisterDevLiveBudget, resolveHeadCommit } from '../../suites/150-a5sf-read.mjs'
import {
  lastUserTextOfStatic, messagesOf, surfaceNamesOf, textOf,
} from '../../lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'd-boot-feasibility')
const RUNS = join(EVIDENCE, 'runs')
const ARCHIVE = join(EVIDENCE, 'archive')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')
// The FS face's owner-ruling dev-live grant (scope DEV-LIVE, face 'FS Provider',
// world u5a5sfdev1). It is a scope authorisation, not a commit-bound candidate
// grant; the run record below labels itself DEV-LIVE so it can never be read as
// a candidate claim.
const GRANT_PATH = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-fs-devlive', 'dev-live-grant.json')

const LINE = 'u5a5sfdev1'
// ROUND 60: ONE root. The Team is minted by the boot create (`root.ts:4888`),
// so the root the discovery turn and the Leader chain run on IS the team root.
// The former second `session-dboot-read-team` root existed only because
// `team.create` minted a fresh team on demand.
const BOOT_ROOT = 'session-dboot-read-root'
const BP_ANCHOR_ID = 'team.dboot.read.anchor'
const BP_MAIN_ID = 'team.dboot.read.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'DBOOT_DISC'
const MK_L1 = 'DBOOT_L1_DRIVE'
const TOK_MEMBER = 'dboot-read-turn'
const CALL_ADMIT = 'call-dboot-read-admit'
const CALL_DENY = 'call-dboot-read-deny'
const DONE_MEMBER = 'DBOOT_MEMBER_DONE'
const DONE_L1 = 'DBOOT_L1_DONE'
const IN_LANE_TEXT = 'DBOOT_IN_LANE_BYTES'
const SECRET_TEXT = 'DBOOT_OUT_OF_LANE_SECRET'
const IN_LANE_FILE = 'in-lane.txt'
const SECRET_FILE = 'secret-out-of-lane.txt'

const LEADER_TOOL_ALLOW = Object.freeze(['bash', 'read', 'write', 'edit', 'read_image'])
const LEADER_DENY_SAFE = Object.freeze(['todo_write'])
const TEAM_TOOL_NAMES = Object.freeze(['team_delegate', 'team_archive_member', 'team_follow_up', 'team_collect', 'team_list_members'])

const SELECTED_CASES = Object.freeze([
  'd:member-read-admitted',
  'd:member-read-denied',
  'd:native-read-surface',
  'd:guard-facts',
  'd:centre-facts',
])

// Facts the judges read. Set once per boot from the composed rows / fixtures /
// the member row — never inferred from the tool result they judge.
let IN_LANE_PATH = ''
let SECRET_PATH = ''
let SHADOW_SPECS = []
let SHIPPED_PRESET_TOOLS = []
let MEMBER_INSTANCE = ''
let CENTRE_LEDGER_PATH = ''
let COMPOSITION_DROPS = []

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
    leader: { templateId: 'leader', persona: `You lead the dboot read anchor team. ${MK_DISC} is the discovery marker.` },
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
      persona: `You lead the dboot read team. ${MK_L1} drives your chain: delegate the governed worker once, then finish.`,
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
      persona: 'You are the governed worker. Call the native `read` tool twice, once per probe, one tool call at a time.',
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
  return { boot: 1, phase: 'create', reportDir: logDir, runStamp: worldId, rootSessionId: BOOT_ROOT }
}

function composedRows({ home, workspaceDir, mainYaml, layer }) {
  const hostRow = layer.rows.find((row) => row?.name === 'dsh-agent-team/host')
  const presetRow = layer.rows.find((row) => row?.config?.id === PRESET_ID)
  if (hostRow === undefined) throw new Error('the shipped layer carries no dsh-agent-team/host row')
  if (presetRow === undefined) throw new Error(`the shipped layer carries no preset '${PRESET_ID}' row`)
  SHIPPED_PRESET_TOOLS = (presetRow.config?.plugins ?? []).map((p) => String(p?.id ?? ''))
  // DEAD SHIPPED SPECIFIER (measured 2026-11-22, this branch). The A1 cut
  // (`1617d5839`) deleted `packages/runtime/src/plugin/live/confined-web-tool.mjs`
  // and its dist mirror, but `cordis.patch.yml`'s `preset-a5sf-governed-member`
  // still names `dsh-agent-team/web-tool` (package.json export `./web-tool`).
  // A preset row that cannot import is `never started`, which makes World
  // creation refuse the WHOLE Agent with `A5SF_PROFILE_GRAPH_UNRESOLVED`.
  // The row is dropped HERE, in this driver's composition, and the drop is
  // recorded verbatim; the product file is not touched. `read` is unaffected.
  const webToolTarget = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'confined-web-tool.mjs')
  const presetConfig = JSON.parse(JSON.stringify(presetRow.config))
  const droppedPlugins = []
  if (!existsSync(webToolTarget)) {
    presetConfig.plugins = (presetConfig.plugins ?? []).filter((p) => {
      const dead = p?.name === 'dsh-agent-team/web-tool'
      if (dead) droppedPlugins.push({ id: p?.id ?? null, name: p?.name ?? null, reason: 'the cut deleted the module this export targets', target: webToolTarget })
      return dead === false
    })
  }
  COMPOSITION_DROPS = droppedPlugins
  const config = {
    ...hostRow.config,
    rootSessionId: BOOT_ROOT,
    bootPhase: 'create',
    // ROUND 60 (escalation path 3): the row's bootstrap anchor IS the v4
    // acceptance blueprint, so the boot-created Team (`root.ts:4888-4925`)
    // binds the same document the driver measures. A centre-configured row
    // refuses the S6 remote plane (`root.ts:4324`), so `POST
    // /team-remote/team.create` is a 405 and the boot create is that row's
    // ONLY creation entrance. This is the identical blueprint the remote
    // entrance used to receive; no assertion, judge or fixture moves with it.
    blueprintSource: mainYaml,
    blueprintDir: join(home, 'blueprints'),
    seedMembers: [],
    // THE OPT-IN (both keys are explicit; a v3 design or a missing ceiling
    // family would refuse at Member attach, never silently grant a default).
    memberPresetId: PRESET_ID,
    a5sfGovernedRealm: true,
    // THE D SUBJECT (change 2): the ONE admission centre. With a compiled
    // realm, `installMemberExecution` REQUIRES this path and refuses the
    // member rather than run unrecorded; facts land at
    // `<centreStatePath>/<instanceId>.facts.jsonl`.
    // DIAGNOSTIC ARM ONLY (env `DBOOT_WITHOUT_CENTRE=1`): omit the centre so the
    // host's OLD remote mount still finds its seam. This arm is expected to
    // boot and then be REFUSED at member attach by `installMemberExecution`
    // (a compiled realm with no centreStatePath). It is run to name both sides
    // of the wiring gap; it is never the acceptance arm.
    ...(process.env.DBOOT_WITHOUT_CENTRE === '1' ? {} : { centreStatePath: join(home, 'centre') }),
    // The product guard-consult sink: the ONLY channel the guard facts reach.
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    mcpServers: [],
    mcpServer: null,
    // NO SHADOW (asserted below by the driver): the row carries no native
    // tool modules, so the Member's `read` is the preset's own host
    // `@deepseek-ai/dsh-tool-fs` row, never a re-registered definition.
    a5sfNativeToolModules: [],
  }
  SHADOW_SPECS = config.a5sfNativeToolModules
  return [
    {
      id: 'dsh-agent-team',
      name: pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')).href,
      config,
    },
    { id: 'preset-a5sf-governed-member', name: '@deepseek-ai/dsh-agent-preset', config: presetConfig },
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
function makeDecide({ inLanePath, secretPath, workspaceDir }) {
  const readCall = (id, filePath) => ({
    kind: 'tool-call',
    toolCalls: [{ id, name: 'read', arguments: { file_path: filePath } }],
  })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'dboot read session' }

    // ── THE MEMBER TURN: one native `read` inside the ceiling, one outside ──
    if (isMemberRequest(req)) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_ADMIT)) return readCall(CALL_ADMIT, inLanePath)
      if (!seen.has(CALL_DENY)) return readCall(CALL_DENY, secretPath)
      return { kind: 'text', content: `${DONE_MEMBER} ${lastToolResultText(req).slice(0, 200)}` }
    }

    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_LM_DISC_DONE' }

    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1)
    if (isLeader) {
      const seen = resultIdsOf(req)
      if (!seen.has('call-a5sflm-delegate')) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: 'call-a5sflm-delegate',
            name: 'team_delegate',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: `${TOK_MEMBER}-delegate`,
              delegationTemplateId: 'worker',
              label: 'a5sflm-worker',
              workspace: workspaceDir,
              prompt: `${TOK_MEMBER}: call the native read tool twice, exactly once per probe, one tool call at a time, then report. Probe A: the in-lane fixture. Probe B: the out-of-lane fixture.`,
              async: false,
            },
          }],
        }
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_LM_NOOP' }
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
  const text = String(sample.result?.text ?? '')
  return verdictOf(
    'the Member\'s model-visible NATIVE `read` admits an in-ceiling locator and returns the planted bytes',
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued the admitted `read` call' },
      { id: 'call-is-read', ok: sample.call?.name === 'read', detail: `name=${String(sample.call?.name)}` },
      { id: 'native-arg', ok: typeof sample.call?.arguments?.file_path === 'string' && sample.call.arguments.file_path.endsWith(IN_LANE_FILE), detail: `file_path=${String(sample.call?.arguments?.file_path)}` },
      { id: 'result-present', ok: sample.result !== undefined, detail: 'the Member received a tool result for the admitted call' },
      { id: 'result-not-error', ok: sample.result?.isError === false, detail: `isError=${String(sample.result?.isError)}` },
      { id: 'in-lane-bytes', ok: text.includes(IN_LANE_TEXT), detail: 'the admitted read returned the in-lane bytes' },
      { id: 'path-in-result', ok: /<path>|<file>/u.test(text), detail: 'the result is the native read tool\'s own rendering (path envelope), not a confined-shell record' },
    ],
  )
}

function judgeDenied(sample) {
  const text = String(sample.result?.text ?? '')
  return verdictOf(
    'the same native `read` REFUSES an out-of-ceiling locator with a typed guard denial and zero secret bytes — which a base-provider read could not do',
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued the denied `read` call' },
      { id: 'call-is-read', ok: sample.call?.name === 'read', detail: `name=${String(sample.call?.name)}` },
      { id: 'native-arg', ok: typeof sample.call?.arguments?.file_path === 'string' && sample.call.arguments.file_path.endsWith(SECRET_FILE), detail: `file_path=${String(sample.call?.arguments?.file_path)}` },
      { id: 'result-present', ok: sample.result !== undefined, detail: 'the Member received a tool result for the denied call' },
      { id: 'result-is-error', ok: sample.result?.isError === true, detail: `isError=${String(sample.result?.isError)}` },
      { id: 'typed-denial', ok: text.includes('IO_READ_DENIED'), detail: 'the tool result names the typed refusal code' },
      { id: 'zero-secret-bytes', ok: text.includes(SECRET_TEXT) === false, detail: 'NO secret bytes reached the Member transcript' },
      { id: 'not-enoent', ok: /ENOENT|no such file/iu.test(text) === false, detail: 'the refusal is a policy denial, not a filesystem miss' },
    ],
  )
}

function judgeSurface(surface) {
  const read = surface.find((s) => s.name === 'read') ?? null
  const props = Object.keys(read?.parameters?.properties ?? {})
  const reads = surface.filter((s) => s.name === 'read')
  return verdictOf(
    'the Member\'s model-visible `read` is the pinned host\'s OWN native definition, registered once, and the row carries no shadow module',
    [
      { id: 'read-present-once', ok: reads.length === 1, detail: `read schemas on the Member surface=${String(reads.length)}` },
      { id: 'native-params', ok: props.sort().join(',') === 'file_path,limit,offset', detail: `properties=${props.join(',')}` },
      // ROUND 62 INSTRUMENT REPAIR. The pinned host's `read` tool description
      // and its `file_path` PARAMETER description are two different fields
      // (`tests/deepseek-harness-test-use/packages/fs/tool-fs/src/read.ts`:
      // top-level `Read a UTF-8 text file and return line-numbered content.`,
      // `file_path` = `Path to read, resolved by the filesystem backend.`).
      // Round 61 asserted the PARAMETER phrase against the TOOL description,
      // which could only pass if the host text changed. Each clause now names
      // the field it means.
      { id: 'native-description', ok: String(read?.description ?? '') === 'Read a UTF-8 text file and return line-numbered content.', detail: `top-level description=${JSON.stringify(String(read?.description ?? ''))}` },
      { id: 'native-file-path-description', ok: String(read?.parameters?.properties?.file_path?.description ?? '').includes('resolved by the filesystem backend'), detail: `file_path.description=${JSON.stringify(String(read?.parameters?.properties?.file_path?.description ?? ''))} (the parameter field, not the tool description)` },
      { id: 'no-shadow-modules', ok: Array.isArray(SHADOW_SPECS) && SHADOW_SPECS.length === 0, detail: `config.a5sfNativeToolModules=${JSON.stringify(SHADOW_SPECS)} (the Team row mounts no re-registered native definition)` },
      { id: 'tool-fs-is-shipped-row', ok: SHIPPED_PRESET_TOOLS.includes('tool-fs'), detail: `the preset row's own tool-fs row is what registers \`read\` (plugins include tool-fs=${String(SHIPPED_PRESET_TOOLS.includes('tool-fs'))})` },
    ],
  )
}

function judgeFacts(facts) {
  const inLane = facts.filter((f) => String(f.locator ?? '') === IN_LANE_PATH)
  const outLane = facts.filter((f) => String(f.locator ?? '') === SECRET_PATH)
  const allow = inLane.filter((f) => f.decision === 'allow')
  return verdictOf(
    'the confined Provider\'s guard was consulted for the ADMITTED native read (ALLOW facts naming the real Member identity) — a base-provider read would leave ZERO facts — and the out-of-lane read never reached a Provider at all',
    [
      { id: 'allow-facts-present', ok: allow.length >= 1, detail: `allow facts for the in-lane locator=${String(allow.length)} (methods: ${allow.map((f) => f.method).join(',')})` },
      { id: 'allow-identity', ok: allow.some((f) => typeof f.memberIdentity === 'string' && f.memberIdentity !== ''), detail: `memberIdentity=${JSON.stringify([...new Set(allow.map((f) => f.memberIdentity))])}` },
      { id: 'allow-decidedBy', ok: allow.every((f) => f.decidedBy === 'ALLOW'), detail: `decidedBy=${JSON.stringify([...new Set(allow.map((f) => f.decidedBy))])}` },
      { id: 'out-lane-never-reached-provider', ok: outLane.length === 0, detail: `guard facts for the out-of-lane locator=${String(outLane.length)} (the centre refused BEFORE the tool body, so the Provider/guard was never entered)` },
      { id: 'fs-methods', ok: allow.every((f) => ['stat', 'readText', 'readBytes', 'streamText'].includes(String(f.method))), detail: `methods=${JSON.stringify([...new Set(allow.map((f) => f.method))])}` },
    ],
  )
}

/**
 * THE CENTRE. `installMemberExecution` writes one durable ledger per member at
 * `<centreStatePath>/<instanceId>.facts.jsonl`; the read-back is through a
 * fresh parse of that file, not an in-memory object.
 */
function judgeCentre(centreRecords) {
  const admissions = centreRecords.filter((r) => r?.kind === 'invocation-authority' && r?.toolName === 'read')
  const executions = centreRecords.filter((r) => r?.kind === 'execution')
  const inLane = admissions.find((r) => String(r.locator ?? '') === IN_LANE_PATH) ?? null
  const outLane = admissions.find((r) => String(r.locator ?? '') === SECRET_PATH) ?? null
  return verdictOf(
    'the ONE centre ADMITTED the in-lane native read, REFUSED the out-of-lane one on the fs.read axis, and recorded both as durable facts (plus an execution fact for the admitted call)',
    [
      { id: 'two-read-admissions', ok: admissions.length === 2, detail: `read admission facts=${String(admissions.length)}` },
      { id: 'in-lane-allow', ok: inLane?.decision === 'allow', detail: `decision=${String(inLane?.decision)} axis=${String(inLane?.axis)}` },
      { id: 'in-lane-axis', ok: inLane?.axis === 'fs.read', detail: `axis=${String(inLane?.axis)}` },
      { id: 'out-lane-deny', ok: outLane?.decision === 'deny', detail: `decision=${String(outLane?.decision)} refusalCode=${String(outLane?.refusalCode)}` },
      { id: 'out-lane-refusal-code', ok: outLane?.refusalCode === 'LANE_DENY', detail: `refusalCode=${String(outLane?.refusalCode)} reason=${String(outLane?.reason ?? '').slice(0, 160)}` },
      { id: 'out-lane-axis', ok: outLane?.axis === 'fs.read', detail: `axis=${String(outLane?.axis)}` },
      { id: 'member-identity', ok: admissions.every((r) => r?.instanceId === MEMBER_INSTANCE && r?.agentId === MEMBER_INSTANCE), detail: `instanceId/agentId=${JSON.stringify([...new Set(admissions.map((r) => `${String(r?.instanceId)}/${String(r?.agentId)}`))])} expected=${MEMBER_INSTANCE}` },
      { id: 'execution-fact', ok: executions.length >= 1, detail: `execution facts=${String(executions.length)} (the admitted call ran and was joined to its admission)` },
      { id: 'durable-source', ok: typeof CENTRE_LEDGER_PATH === 'string' && existsSync(CENTRE_LEDGER_PATH), detail: `ledger=${String(CENTRE_LEDGER_PATH)}` },
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
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), workspaceDir: join(EVIDENCE, 'plan-workspace'), mainYaml: main, layer })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-live-member plan (no World)'], rows) + '\n')
  log(`rows: ${JSON.stringify(rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 80) })))}`)
  log(`composition drops: ${JSON.stringify(COMPOSITION_DROPS)}`)
  const preset = layer.rows.find((r) => r?.config?.id === PRESET_ID)
  const plugins = (preset?.config?.plugins ?? []).map((p) => p.id)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-fs-search']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  if (plugins.includes('tool-pwsh')) throw new Error('the shipped governed preset unexpectedly carries tool-pwsh')
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// one boot
// ─────────────────────────────────────────────────────────────────────────────
async function bootOnce({ index, head, grant, layer, baseDir }) {
  const bootDir = join(RUNS, `boot${String(index).padStart(2, '0')}`)
  mkdirSync(bootDir, { recursive: true })
  const phase = `a5sf-live-member-boot${String(index)}`
  const runId = `a5sf-live-member-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-live-member', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, grant), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-live-member', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const lease = await preRegisterDevLiveBudget({
    grantPath: GRANT_PATH, headCommit: head, runRecord: record,
    face: 'FS Provider', world: LINE, leaseRoot: factory.leaseRoot, requiredBoots: 1,
  })
  log(`[boot${String(index)}] dev-live lease grant=${lease.grant.grantId} world=${LINE} head=${head}`)

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

      // ROUND 60: the v4 acceptance blueprint is the row's BOOTSTRAP ANCHOR, so
      // it must exist before the host boots (the boot create freezes/binds it).
      // The former anchor document is gone with the remote entrance it served.
      // The Leader declares NO capabilities (see mainBlueprintYaml), so the deny
      // list is the empty list both before and after the discovery turn; the
      // discovery turn below still MEASURES the real Leader surface and records
      // it — this is a binding-order move, not a guessed composition.
      const mainText = mainBlueprintYaml({ denyList: [], workspace })
      assertBlueprintText(mainText, BP_MAIN_ID, 'main.yaml')
      writeFileSync(join(world.home, 'blueprints', 'main.yaml'), mainText)
      const rows = composedRows({ home: world.home, workspaceDir: workspace, mainYaml: mainText, layer })
      world.u6Fs.rows.push(...rows)
      record.record.bindings.compositionDrops = COMPOSITION_DROPS
      record.record.bindings.layout = process.env.DBOOT_WITHOUT_CENTRE === '1' ? 'no-centre (diagnostic arm)' : 'centre'
      log(`[boot${String(index)}] rows: ${rows.map((r) => r.id).join(',')}`)
      writeFileSync(join(bootDir, 'composition-drops.json'), JSON.stringify({
        schema: 'dboot/composition-drops/1',
        at: new Date().toISOString(),
        disclosure: 'Rows removed from THIS driver\'s composition only (product files untouched). Every drop is a measured reason, never a convenience.',
        drops: COMPOSITION_DROPS,
        presetPluginsAfterDrop: (rows.find((r) => r.id === 'preset-a5sf-governed-member')?.config?.plugins ?? []).map((p) => p?.id),
      }, null, 2) + '\n')

      const decide = makeDecide({ inLanePath, secretPath, workspaceDir: workspace })
      process.env.A5SF_GOVERNED_SCRATCH = join(world.home, 'governed-scratch')
      mkdirSync(process.env.A5SF_GOVERNED_SCRATCH, { recursive: true })
      await world.startMock({ decide })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })
    hostReached = true
    abortStage = 'composition'
    paths = {
      workspace: world.workspaceDir,
      inLane: join(world.workspaceDir, IN_LANE_FILE),
      secret: join(world.home, 'out-of-lane', SECRET_FILE),
      sink: join(world.home, 'a5sf-consult.jsonl'),
      centre: join(world.home, 'centre'),
    }
    IN_LANE_PATH = paths.inLane
    SECRET_PATH = paths.secret
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
    // must start BEFORE the Leader turn: that turn's chain (and therefore the
    // Member turn) runs inside the synchronous `team_delegate` call — measured.
    // A watcher started afterwards sees an empty window and reads as "no spawn".
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
    await waitFor(() => (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith('A5SF_LM_DISC_DONE')), 60_000)
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

    // ── the Leader turn on the BOOT-CREATED Team ──────────────────────────
    // ROUND 60 (escalation path 3): NO `POST /team-remote/team.create`. On a
    // centre-configured row that route is a 405 by design (C-remote refuses to
    // build the S6 plane, `root.ts:4324`), and the boot create is the row's
    // only creation entrance. This prompt is the SAME first turn the remote
    // `initialWork.prompt` used to carry, sent through the public session
    // prompt route; the Leader's chain (delegate → Member turn → collect) and
    // every judge are untouched.
    abortStage = 'leader-turn'
    const lead = await apiPrompt(origin, cookie, BOOT_ROOT, MK_L1, 'a5sflm')
    log(`[boot${String(index)}] leader turn status=${String(lead.status)} root=${BOOT_ROOT}`)
    if (lead.status !== 200) throw new Error(`session/prompt failed: status=${String(lead.status)} body=${redact(JSON.stringify(lead.body ?? null)).slice(0, 400)}`)

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
      out.delegateCall = toolCallFor(requestsNow, 'call-a5sflm-delegate')
      out.delegateResult = toolResultFor(requestsNow, 'call-a5sflm-delegate') ?? null
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
    const chainTimeoutMs = Number(process.env.A5SF_LM_CHAIN_TIMEOUT_MS ?? 300_000)
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
    const delegateCall = toolCallFor(requests0, 'call-a5sflm-delegate')
    const delegateResult = toolResultFor(requests0, 'call-a5sflm-delegate')
    writeFileSync(join(bootDir, 'leader-delegate.json'), JSON.stringify({
      call: delegateCall, result: delegateResult === undefined ? null : delegateResult,
    }, null, 2) + '\n')
    log(`[boot${String(index)}] delegate call=${String(delegateCall !== null)} result=${redact(String(delegateResult?.text ?? '<missing>')).slice(0, 500)}`)

    const state = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const members = Array.isArray(state?.body?.members) ? state.body.members : []
    const member = members.find((m) => String(m?.templateId ?? '') === 'worker') ?? members[0] ?? null
    const instanceId = member?.instanceId ?? null
    const childSessionId = member?.childSessionId ?? member?.row?.childSessionId
      ?? (instanceId === null ? null : `session-team-child-${createHash('sha256').update(`${BOOT_ROOT}\u0000${instanceId}`).digest('hex').slice(0, 32)}`)
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
    }).filter((s) => s.name === 'read' || s.name === 'bash' || s.name.startsWith('team_'))
    const readEntry = memberSurface.find((s) => s.name === 'read') ?? null
    writeFileSync(join(bootDir, 'member-surface.json'), JSON.stringify({
      tools: memberSurface.map((s) => s.name),
      read: readEntry,
      note: 'the model-visible schema captured from the mock provider request, i.e. what the model actually saw',
      shadowModules: SHADOW_SPECS,
      presetPlugins: SHIPPED_PRESET_TOOLS,
    }, null, 2) + '\n')

    const factsAll = parseJsonl(paths.sink).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const facts = factsAll
    writeFileSync(join(bootDir, 'guard-facts.json'), JSON.stringify(factsAll, null, 2) + '\n')

    // THE CENTRE'S DURABLE LEDGER (change 2). Per-member file written by
    // `openFactLedger` at `<centreStatePath>/<instanceId>.facts.jsonl`; parsed
    // fresh from disk here.
    MEMBER_INSTANCE = String(instanceId ?? '')
    CENTRE_LEDGER_PATH = instanceId === null ? '' : join(paths.centre, `${instanceId}.facts.jsonl`)
    const centreRecords = parseJsonl(CENTRE_LEDGER_PATH)
    writeFileSync(join(bootDir, 'centre-facts.json'), JSON.stringify(centreRecords, null, 2) + '\n')

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
    counters.confinedTurnLaunchers = launcherPids.size
    counters.preflightLaunchers = preflightPids.size
    counters.payloadInLaneSightings = payloadInLane.size
    counters.procSecretCommandSightings = payloadSecret.size
    counters.baseBwrapWithMarkers = baseBwrap.size
    counters.guardFacts = { allow: facts.filter((f) => f.decision === 'allow').length, deny: facts.filter((f) => f.decision === 'deny').length }
    counters.mockRequests = requests.length
    counters.memberModelRequests = requests.filter((r) => isMemberRequest(r) && surfaceNamesOf(r).length > 0).length
    counters.procBatches = procLog.length
    counters.otherBwrapPids = otherBwrapPids.size
    counters.memberWindow = { from: memberPromptAt, to: memberDoneAt }
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')
    writeFileSync(join(bootDir, 'proc-observations.json'), JSON.stringify({
      schema: 'a5sf-live-member/proc-observations/1', at: new Date().toISOString(),
      note: 'independent /proc/<pid>/cmdline scan; a sighting is an OS-level fact, not a product counter',
      sightings: procLog,
    }, null, 2) + '\n')

    // ── judges ─────────────────────────────────────────────────────────────
    const verdicts = {
      admitted: judgeAdmitted(admitted),
      denied: judgeDenied(denied),
      surface: judgeSurface(memberSurface),
      facts: judgeFacts(facts),
      centre: judgeCentre(centreRecords),
    }
    // NOTE: `detail` must NOT carry a `verdict` key — the record spreads it
    // AFTER the passed verdict and would silently overwrite it.
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}`)
    }
    add('d:member-read-admitted', verdicts.admitted.verdict, verdicts.admitted)
    add('d:member-read-denied', verdicts.denied.verdict, verdicts.denied)
    add('d:native-read-surface', verdicts.surface.verdict, verdicts.surface)
    add('d:guard-facts', verdicts.facts.verdict, verdicts.facts)
    add('d:centre-facts', verdicts.centre.verdict, verdicts.centre)

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
      counters, facts, centreRecords, verdicts,
      locus: buildLocus({ world, bootInfo, transcript, facts, centreRecords, paths, bootDir }),
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
function buildLocus({ world, bootInfo, transcript, facts, centreRecords, paths, bootDir }) {
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
      rowConfig: 'dev/agent-workflow/evidence/d-boot-feasibility/plan-patch.yml (regenerated by --plan; boot copies live in the World home)',
      shippedPreset: { file: 'cordis.patch.yml', line: lineOf(join(REPO_ROOT, 'cordis.patch.yml'), 'id: "preset-a5sf-governed-member"') },
      realmProvider: { file: 'packages/runtime/src/plugin/live/a5sf-governed-realm.mjs', line: 1 },
      memberMount: { file: 'packages/runtime/src/plugin/live/agent-bindings.mjs', line: lineOf(join(REPO_ROOT, 'packages/runtime/src/plugin/live/agent-bindings.mjs'), 'a5sfRealm = await mountMemberA5sfRealm') },
      centreInstall: { file: 'packages/runtime/src/plugin/vnext/member-execution.mjs', line: lineOf(join(REPO_ROOT, 'packages/runtime/src/plugin/vnext/member-execution.mjs'), 'installMemberCentre({') },
      nativeReadRow: { file: 'cordis.patch.yml', line: lineOf(join(REPO_ROOT, 'cordis.patch.yml'), "name: '@deepseek-ai/dsh-tool-fs'") },
    },
    member: {
      sessionId: transcript?.sessionId ?? null,
      sessionLog: transcript?.file ?? null,
      transcriptCopy: transcriptText,
      toolCallLines: transcriptText,
      note: 'the tool call/result rows are the Member\'s OWN durable session log, copied here before teardown',
    },
    guardSink: { file: join(bootDir, 'guard-facts.json'), source: paths.sink, allowLine: sinkLines.allow, denyLine: sinkLines.deny, facts: facts.length },
    centreLedger: { file: join(bootDir, 'centre-facts.json'), source: CENTRE_LEDGER_PATH, admissions: centreRecords?.filter((r) => r?.kind === 'invocation-authority').length ?? null, executions: centreRecords?.filter((r) => r?.kind === 'execution').length ?? null },
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
    out.push(`  file_path: ${String(args.file_path ?? args.path ?? '')}`)
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
    compositionDrops: COMPOSITION_DROPS,
    layout: process.env.DBOOT_WITHOUT_CENTRE === '1' ? 'no-centre (diagnostic arm)' : 'centre',
    installGraph: process.env.A5SF_WF_NO_INSTALL_GRAPH === '1' ? 'skipped (negative control A5SF_WF_NO_INSTALL_GRAPH=1)' : 'provisioned',
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
    command: `node tests/world-factory/drivers/a5sf-live-member/run-boot.mjs${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
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
    factsVerdict: r?.verdicts?.facts?.verdict ?? null,
    centreVerdict: r?.verdicts?.centre?.verdict ?? null,
    allowFacts: r?.counters?.guardFacts?.allow ?? null,
    denyFacts: r?.counters?.guardFacts?.deny ?? null,
    centreAdmissions: r?.centreRecords?.filter((x) => x?.kind === 'invocation-authority').length ?? null,
    centreExecutions: r?.centreRecords?.filter((x) => x?.kind === 'execution').length ?? null,
    governedSurface: r?.verdicts?.surface?.verdict === 'PROVEN',
    admittedBytes: r?.verdicts?.admitted?.verdict === 'PROVEN',
    deniedSecretAbsent: r?.verdicts?.denied?.verdict === 'PROVEN',
    transcriptSourceCount: r?.transcript?.calls?.length ?? null,
  })
  const rows = ok.map((r) => ({ boot: r.boot, ...pick(r) }))
  const keys = [
    'overall', 'admittedVerdict', 'deniedVerdict', 'surfaceVerdict', 'factsVerdict', 'centreVerdict',
    'allowFacts', 'denyFacts', 'centreAdmissions', 'centreExecutions', 'governedSurface',
    'admittedBytes', 'deniedSecretAbsent', 'transcriptSourceCount',
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
  return { schema: 'a5sf-live-member/agreement/1', at: new Date().toISOString(), boots: results.length, agreeing, differing, rows, table }
}

main().catch((error) => {
  log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
