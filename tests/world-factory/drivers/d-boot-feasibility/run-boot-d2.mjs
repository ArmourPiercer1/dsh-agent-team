#!/usr/bin/env node
/**
 * tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs — the SECOND
 * D-stage live driver: THREE remaining acceptance items over the same shipped
 * governed preset, the same product seams and the same boot/teardown
 * discipline as `run-boot.mjs` (round 61). This file is a COPY of that driver
 * with the probes replaced; the round-61 driver is untouched except for the
 * one instrument repair named in its own header.
 *
 * WHAT IT MEASURES (one command, two boots):
 *
 *   1. `d2:multi-member-concurrency` — TWO governed Members alive at the same
 *      time, each reading its OWN in-lane file. Both admitted; the guard facts
 *      name their OWN member identity; the centre ledgers are separate and
 *      complete. Negative: Member A cannot read Member B's in-lane file (out
 *      of A's compiled lane), so B's bytes never reach A.
 *   2. `d2:revocation` — the durable `permissionOverlay` mutation lane
 *      (`team_grant_permission` / `team_revoke_permission` -> the ONE
 *      governance mutation authority) is driven while the Member is live, and
 *      the SAME call is measured before / after. ROUND 71 rewrote the judge to
 *      measure the CONTRACT, strictly: (a) a durable DENY refuses the
 *      previously admitted call (`ADMISSION_OVERLAY_DENY`, zero body,
 *      settlement REFUSED, fact naming the overlay + a policy generation);
 *      (b) removing that deny RESTORES the call (admitted + COMPLETED, a NEW
 *      fact); (c) an untouched in-lane call is admitted at every phase; and
 *      (d) WIDENING IS REFUSED — the same lane is asked for an `allow` beyond
 *      the compiled ceiling, its answer is recorded verbatim (typed refusal,
 *      no-op or — the only failing shape — a commit), and the widened locator
 *      is still refused with zero foreign bytes.
 *   3. `d2:stop` — a Member turn is STOPPED through the product's own Stop path
 *      (`goals/get -> goals/pause -> session/cancel`, the sequence the Team
 *      view's member-stop button issues; `packages/client/src/model/member-stop.ts`).
 *      The stopped call's outcome must be the centre's own `ADMISSION_STOPPED`,
 *      never a completion and never UNKNOWN. Negative: a second Member
 *      unaffected by the Stop completes.
 *
 * BOOT DISCIPLINE (non-negotiable, TEST_METHODS §2/§7): identical to
 * `run-boot.mjs` — DSH_HOME under `tests/homes/u5a5sfdev1-<stamp>`, ports from
 * the 3180 family via WorldFactory leases, the pinned host tree read-only
 * (porcelain verified empty), <= 2 concurrent dev Hosts via
 * `lib/dev-live-slots.mjs`, archive-before-start, teardown by identity, one
 * DEV-LIVE ledger row per start.
 *
 * EVIDENCE HOME: `dev/agent-workflow/evidence/d-boot-feasibility/d2/` — a NEW
 * subdirectory. The round-61 artefacts in `.../d-boot-feasibility/runs/` are
 * never rewritten by this driver.
 *
 * WHAT IS FIXTURE (disclosed): the model is the shared scripted mock
 * (`packages/tools/harness/mock-deepseek.mjs`); the /proc watcher and the
 * mock-request log are test instrumentation. The product path is NOT a
 * fixture: the preset row, the realm provider, the compiler, the guard, the
 * centre, the permission mutation authority, the ControlService and the
 * session-cancel Stop are the shipped modules the Host loads from
 * `packages/runtime/dist`.
 *
 * CORE PATCH BUDGET = 0.
 *
 * @module tests/world-factory/drivers/d-boot-feasibility/run-boot-d2
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

import {
  apiPrompt, apiSessionCancel, authenticate, emitPatchLayer, fetchJson,
} from '../../lib/world-factory.mjs'
import { createRunRecord, formatSummary, readAuthorityBinding } from '../../lib/run-record.mjs'
import { selectedHostPin, selectedHostTree } from '../../../next-host/host-select.mjs'
import { createA5sfHarness } from '../../lib/a5sf-harness.mjs'
import { settleDevLiveLease } from '../../lib/dev-live-slots.mjs'
import { preRegisterDevLiveBudget, resolveHeadCommit } from '../../suites/150-a5sf-read.mjs'
import {
  lastUserTextOfStatic, messagesOf, remoteCall, surfaceNamesOf, textOf,
} from '../../lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
// A NEW evidence subdirectory: round-61's runs/ archive/ ledger are never
// touched by this driver.
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'd-boot-feasibility', 'd2')
const RUNS = join(EVIDENCE, 'runs')
const ARCHIVE = join(EVIDENCE, 'archive')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')
// The FS face's owner-ruling dev-live grant (scope DEV-LIVE, face 'FS Provider',
// world u5a5sfdev1). It is a scope authorisation, not a commit-bound candidate
// grant; the run record below labels itself DEV-LIVE so it can never be read as
// a candidate claim.
const GRANT_PATH = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-fs-devlive', 'dev-live-grant.json')

// The product's OWN settlement identity derivation (`dispatchExecutionId`) —
// imported, not re-derived, so the driver reads the record the centre wrote
// under exactly the id the centre computed.
const { dispatchExecutionId } = await import(pathToFileURL(join(
  REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'settlement', 'dispatch-settlement.js',
)).href)

const LINE = 'u5a5sfdev1'
// ROUND 60: ONE root. The Team is minted by the boot create (`root.ts:4888`),
// so the root the discovery turn and the Leader chain run on IS the team root.
// The former second `session-dboot-read-team` root existed only because
// `team.create` minted a fresh team on demand.
const BOOT_ROOT = 'session-dboot-d2-root'
const BP_ANCHOR_ID = 'team.dboot.d2.anchor'
const BP_MAIN_ID = 'team.dboot.d2.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'DBOOT_D2_DISC'
const MK_L1 = 'DBOOT_D2_L1_DELEGATE_A_B'
const MK_L2 = 'DBOOT_D2_L2_STOP_AND_CONTROL'
const MK_L3 = 'DBOOT_D2_L3_B_PRE'
const MK_L4 = 'DBOOT_D2_L4_GRANT'
const MK_L5 = 'DBOOT_D2_L5_B_MID'
const MK_L6 = 'DBOOT_D2_L6_REVOKE'
const MK_L7 = 'DBOOT_D2_L7_B_POST'
const MK_L8 = 'DBOOT_D2_L8_WIDEN_ATTEMPT'
const MK_L9 = 'DBOOT_D2_L9_B_WIDEN_READ'

// One unique token per delegated work unit. A member request is identified
// STRUCTURALLY by the token its own delegate/follow-up prompt carries (the
// same rule round 61 measured: the Leader's post-delegate request also
// contains the delegated text in a tool RESULT, so a substring test would
// replay the member script on the Leader).
const TOK_A = 'dboot-d2-a-inlane'
const TOK_B = 'dboot-d2-b-inlane'
const TOK_A_STOP = 'dboot-d2-a-stopprobe'
const TOK_B_AFTER = 'dboot-d2-b-after-stop'
const TOK_B_PRE = 'dboot-d2-b-pre-revoke'
const TOK_B_MID = 'dboot-d2-b-mid-revoke'
const TOK_B_POST = 'dboot-d2-b-post-revoke'
const TOK_B_WIDEN = 'dboot-d2-b-widen-probe'
// ROUND 83 — the two delivered-work tokens. They arrive inside a
// `[team-relay ...]` envelope (the messaging coordinator's rendered input),
// which `memberTokenOf` below also accepts: the delivery must select the
// Member script STRUCTURALLY, exactly like a delegated `[team-work ...]` one.
const TOK_RD = 'dboot-d2-remote-delivery'
const TOK_RD_STOP = 'dboot-d2-remote-delivery-stop'
const MEMBER_TOKENS = Object.freeze([TOK_RD_STOP, TOK_RD, TOK_A_STOP, TOK_B_AFTER, TOK_B_PRE, TOK_B_MID, TOK_B_POST, TOK_B_WIDEN, TOK_A, TOK_B])

const CALL_A_OWN = 'call-d2-a-own'
const CALL_A_CROSS = 'call-d2-a-cross'
const CALL_B_OWN = 'call-d2-b-own'
const CALL_B_AFTER = 'call-d2-b-after'
const CALL_A_ASK = 'call-d2-a-ask'
const CALL_B_PRE = 'call-d2-b-pre'
const CALL_B_MID = 'call-d2-b-mid'
const CALL_B_POST = 'call-d2-b-post'
const CALL_B_PRE_INLANE = 'call-d2-b-pre-inlane'
const CALL_B_MID_INLANE = 'call-d2-b-mid-inlane'
const CALL_B_POST_INLANE = 'call-d2-b-post-inlane'
const CALL_B_WIDEN = 'call-d2-b-widen'
// ROUND 83 — the calls the DELIVERED turns make, and the replies that close them.
const CALL_RD = 'call-d2-remote-delivery'
const CALL_RD_STOP = 'call-d2-remote-delivery-stop'
const CALL_GRANT_WIDEN = 'call-d2-grant-widen'
const CALL_DELEGATE_A = 'call-d2-delegate-a'
const CALL_DELEGATE_B = 'call-d2-delegate-b'
const CALL_FOLLOW_A = 'call-d2-follow-a'
const CALL_FOLLOW_B = 'call-d2-follow-b'
const CALL_FOLLOW_B_PRE = 'call-d2-follow-b-pre'
const CALL_FOLLOW_B_MID = 'call-d2-follow-b-mid'
const CALL_FOLLOW_B_POST = 'call-d2-follow-b-post'
const CALL_FOLLOW_B_WIDEN = 'call-d2-follow-b-widen'
const CALL_GRANT = 'call-d2-grant'
const CALL_REVOKE = 'call-d2-revoke'

const DONE_MEMBER_A1 = 'DBOOT_D2_MEMBER_A1_DONE'
const DONE_MEMBER_B1 = 'DBOOT_D2_MEMBER_B1_DONE'
const DONE_MEMBER_B_AFTER = 'DBOOT_D2_MEMBER_B_AFTER_DONE'
const DONE_MEMBER_B_PRE = 'DBOOT_D2_MEMBER_B_PRE_DONE'
const DONE_MEMBER_B_MID = 'DBOOT_D2_MEMBER_B_MID_DONE'
const DONE_MEMBER_B_POST = 'DBOOT_D2_MEMBER_B_POST_DONE'
const DONE_MEMBER_B_WIDEN = 'DBOOT_D2_MEMBER_B_WIDEN_DONE'
const DONE_MEMBER_RD = 'DBOOT_D2_MEMBER_RD_DONE'
const DONE_MEMBER_RD_STOP = 'DBOOT_D2_MEMBER_RD_STOP_DONE'
const DONE_L8 = 'DBOOT_D2_L8_DONE'
const DONE_L9 = 'DBOOT_D2_L9_DONE'
const DONE_L1 = 'DBOOT_D2_L1_DONE'
const DONE_L2 = 'DBOOT_D2_L2_DONE'
const DONE_L3 = 'DBOOT_D2_L3_DONE'
const DONE_L4 = 'DBOOT_D2_L4_DONE'
const DONE_L5 = 'DBOOT_D2_L5_DONE'
const DONE_L6 = 'DBOOT_D2_L6_DONE'
const DONE_L7 = 'DBOOT_D2_L7_DONE'

const A_IN_LANE_TEXT = 'DBOOT_D2_A_UNIQUE_BYTES'
const B_IN_LANE_TEXT = 'DBOOT_D2_B_UNIQUE_BYTES'
const ASK_TEXT = 'DBOOT_D2_ASK_BYTES'
const REVOCABLE_TEXT = 'DBOOT_D2_REVOCABLE_BYTES'
const A_IN_LANE_FILE = 'in-lane-a.txt'
const B_IN_LANE_FILE = 'in-lane-b.txt'
const ASK_FILE = 'ask-me.txt'
const REVOCABLE_FILE = 'revocable.txt'

const LEADER_TOOL_ALLOW = Object.freeze(['bash', 'read', 'write', 'edit', 'read_image'])
const LEADER_DENY_SAFE = Object.freeze(['todo_write'])
const TEAM_TOOL_NAMES = Object.freeze(['team_delegate', 'team_archive_member', 'team_follow_up', 'team_collect', 'team_list_members', 'team_grant_permission', 'team_revoke_permission'])

// The driver's FULL case set. Round 83 added the delivery judge, so the selection is
// the whole set again — a subset run must name its `arms` in the run record, and this
// driver has none to name.
const SELECTED_CASES = Object.freeze([
  'd2:multi-member-concurrency',
  'd2:revocation',
  'd2:stop',
  'd2:remote-delivery',
])

// Facts the judges read. Set once per boot from the composed rows / fixtures /
// the member row — never inferred from the tool result they judge.
let SHADOW_SPECS = []
let SHIPPED_PRESET_TOOLS = []
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

/**
 * ROUND 109 — FULL TYPED REPLY OBSERVABILITY (observation only).
 *
 * `member.archive`, `member.send` and `member.restore` answer in ONE envelope:
 * `{ type, rpcId, result: { ok, value } | { ok:false, error: { code, message, … } } }`.
 * The judge consumed only derived booleans (`ok`, `code`), which is how the
 * round-105/106 rc.5 archive refusal stayed invisible: its WHY was in
 * `result.error`, and the durable row was the only trace left. This records
 * the complete reply the driver actually received — the answered RPC id, the
 * typed error object VERBATIM (every field the host put there, not just
 * `code`/`message`), and the full `value` — so the evidence file, not a
 * re-derivation, carries the channel. A single oversized payload is bounded by
 * `OBSERVED_REPLY_MAX_CHARS` with `truncated:true` so the record stays
 * reviewable; below the bound nothing is dropped.
 *
 * NO PREDICATE READS THIS. Every clause still asserts exactly the fields it
 * asserted before; `judgeRemoteDelivery` is untouched. This is a strictly
 * additive observation, added so a future refusal cannot be discarded again.
 */
const OBSERVED_REPLY_MAX_CHARS = 16_384
function observedReply(response) {
  const body = response?.body ?? null
  const result = body?.result ?? null
  const serialized = body === null ? null : JSON.stringify(body)
  const truncated = typeof serialized === 'string' && serialized.length > OBSERVED_REPLY_MAX_CHARS
  return {
    httpStatus: response?.status ?? null,
    transportError: response?.error ?? null,
    rpcId: body?.rpcId ?? null,
    envelopeType: body?.type ?? null,
    ok: result?.ok === true,
    code: result?.error?.code ?? null,
    message: result?.error?.message ?? null,
    // the FULL typed objects, verbatim
    error: result?.error ?? null,
    value: result?.value ?? null,
    truncated,
    ...(truncated ? { rawPrefix: serialized.slice(0, OBSERVED_REPLY_MAX_CHARS) } : {}),
  }
}

/**
 * HOST-SELECTABLE (round 78). Tree + pin come from the ONE lane selector
 * (`tests/next-host/host-select.mjs`): rc.2 by default, rc.5 under
 * `TEAM_TEST_HOST=next`. Realpath'd so the native-asset pre-flight's
 * containment check sees the shared checkout, not the worktree symlink.
 */
const HOST_PIN = selectedHostPin(REPO_ROOT)
const HOST_TREE = realpathSync(selectedHostTree(REPO_ROOT))
if (realpathSync(HOST_PIN.tree) !== HOST_TREE) {
  throw new Error(`host selector disagreement: tree ${HOST_TREE} != pin tree ${HOST_PIN.tree}`)
}

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
    leader: { templateId: 'leader', persona: `You lead the dboot d2 anchor team. ${MK_DISC} is the discovery marker.` },
    members: [{ templateId: 'worker-a', persona: 'You are the anchor worker.' }],
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
/** A restricted lane with a DECLARED `ask` disposition (deny > ask > allow). */
function laneWithAsk(allow, ask) {
  return { mode: 'restricted', allow: [...allow], ask: [...ask], deny: [] }
}

/**
 * The v4 design of the TWO-member team this driver measures. Each member
 * template carries its OWN `memberIoCeilings` read lane, so "in lane for A" and
 * "in lane for B" are DIFFERENT compiled ceilings (one shared workspace could
 * not express the cross-member negative). Member A additionally declares an
 * `ask` lane so the Stop probe parks at the centre's durable approval wait.
 */
function mainBlueprintYaml({ denyList, dirs }) {
  for (const key of ['aDir', 'bDir', 'askDir', 'askFile']) {
    if (typeof dirs?.[key] !== 'string' || dirs[key] === '') throw new Error(`mainBlueprintYaml: dirs.${key} must be an absolute path`)
  }
  const doc = {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the dboot d2 team. ${MK_L1} delegates the two governed workers asynchronously, in order; then the driver drives the remaining turns by their markers.`,
      // NO `capabilities` block. The permission-coverage gate only runs for a
      // template that DECLARES capabilities, and any declared set must name
      // every tool on the final surface — including agent-scope tools such as
      // `subagent` that `tools.restrict()` cannot even name at root-start time.
      // The team tools (`team_delegate`, …) are mounted by the Team row itself
      // and are present either way (measured: the Leader surface carries the
      // `team_*` names with no capabilities block).
    },
    members: [{
      templateId: 'worker-a',
      displayName: 'Governed Worker A',
      persona: 'You are governed worker A. Read exactly the files your prompt names, one tool call at a time.',
    }, {
      templateId: 'worker-b',
      displayName: 'Governed Worker B',
      persona: 'You are governed worker B. Read exactly the file your prompt names, one tool call at a time.',
    }],
    requirements: [],
    teamEnvelope: {
      // `request-control` must be on BOTH sides: the effective caller envelope is
      // teamEnvelope.allow ∩ the template entry (the entry only tightens), so a
      // member-only grant is still outside the boundary (measured).
      allow: ['create-member', 'assign-task', 'send-message', 'report-progress', 'request-control', 'archive-member'],
      deny: [],
    },
    memberEnvelopes: [
      // `request-control` is REQUIRED for the ask lane: the centre records an
      // `ask` as a durable Control request ON BEHALF OF the member identity, so a
      // member envelope that cannot request control turns every ask into
      // `ADMISSION_APPROVAL_REQUEST_FAULT` (measured at this HEAD).
      { templateId: 'worker-a', envelope: { allow: ['send-message', 'report-progress', 'request-control'], deny: [] } },
      { templateId: 'worker-b', envelope: { allow: ['send-message', 'report-progress'], deny: [] } },
    ],
    policyStates: [{ id: 'default', description: 'Default state.' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [{
      templateId: 'worker-a',
      io: {
        read: laneWithAsk([dirs.aDir], [dirs.askFile]),
        write: lane([dirs.aDir]),
        network: { mode: 'allow' },
      },
    }, {
      templateId: 'worker-b',
      io: {
        read: lane([dirs.bDir]),
        write: lane([dirs.bDir]),
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
    // ROUND 76 — DEPLOYMENT-HALF OF THE PERSISTENT-SHELL COMPOSITION.
    //
    // The governed preset now carries the HOST's `dsh-tool-bash-persistent` row,
    // which INJECTS `terminals`. A preset binds only when every enabled row is
    // ACTIVE (a pending row refuses the whole preset: `agent-preset/invalid` …
    // 'waiting for terminals', measured in this world on 2026-11-22), so the
    // DEPLOYMENT has to provide the service on an ancestor scope. This row is
    // the HOST's own PTY service with NO backend registered: it is INERT and
    // FAIL-CLOSED (`spawn('a5sf-governed-shell')` -> `NO_BACKEND`, zero
    // processes), and the Member's live `bash` is the realm mount of the same
    // host module on the governed face.
    { id: 'persistent-shell-terminals', name: '@deepseek-ai/dsh-terminal' },
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
 *  delegated `[team-work …]` envelope carrying ONE of our member tokens. The
 *  Leader's own post-delegate request also contains the token (it appears
 *  inside the delegate tool RESULT JSON), so a substring test anywhere in the
 *  request would replay the Member script on the Leader — measured in
 *  round 61 and inherited here. */
function firstUserText(req) {
  const first = messagesOf(req).find((m) => m?.role === 'user')
  if (first === undefined) return ''
  return typeof first.content === 'string' ? first.content : JSON.stringify(first.content ?? '')
}
function memberTokenOf(req) {
  // A child session is REUSED across follow-ups, so its FIRST user message is
  // still the original delegation envelope. The live token is the one on the
  // NEWEST `[team-work …]` envelope (measured: a first-message scan replays the
  // first turn's script on every follow-up).
  const users = messagesOf(req).filter((m) => m?.role === 'user')
  for (let i = users.length - 1; i >= 0; i -= 1) {
    const m = users[i]
    const text = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    // ROUND 83 — a DELIVERED message is not a `[team-work ...]` envelope: the
    // messaging coordinator renders `[team-relay] from=… to=…` (mediation.ts) and
    // the input is ordinary first-person text. Both envelopes are the STRUCTURAL
    // marker; the token inside still selects the script.
    if (!text.includes('[team-work ') && !text.includes('[team-relay')) continue
    return MEMBER_TOKENS.find((token) => text.includes(token)) ?? null
  }
  return null
}
function isMemberRequest(req) {
  return memberTokenOf(req) !== null
}

/** The mock-side receive window of ONE kind of member request. */
function requestWindow(requests, token) {
  const hits = requests.filter((r) => memberTokenOf(r) === token)
  if (hits.length === 0) return null
  return { first: hits[0].receivedAt, last: hits[hits.length - 1].receivedAt, count: hits.length }
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
 * The two live instance ids are read through `ids`, which the driver fills after
 * the durable state read (the product's own `memberInstances` projection), so
 * every follow-up/mutation names the REAL instance the centre bound.
 */
function makeDecide({ paths, ids }) {
  const readCall = (id, filePath) => ({
    kind: 'tool-call',
    toolCalls: [{ id, name: 'read', arguments: { file_path: filePath } }],
  })
  const text = (content) => ({ kind: 'text', content })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return text('dboot d2 session')

    const token = memberTokenOf(req)
    if (token !== null) {
      const seen = resultIdsOf(req)
      // ── Member A: own in-lane read, a few REAL in-lane reads (this is a
      //    work unit, not a sleep: it keeps A's turn live long enough for the
      //    second Member's turn to interleave — measured 2026-11-22 that a
      //    one-read turn finished before B was admitted), then the CROSS-member
      //    negative read. ──
      if (token === TOK_A) {
        if (!seen.has(CALL_A_OWN)) return readCall(CALL_A_OWN, paths.aInLane)
        const busy = [1, 2, 3, 4, 5, 6].map((i) => `call-d2-a-busy-${i}`)
        const nextBusy = busy.find((id) => !seen.has(id))
        if (nextBusy !== undefined) return readCall(nextBusy, paths.aInLane)
        if (!seen.has(CALL_A_CROSS)) return readCall(CALL_A_CROSS, paths.bInLane)
        return text(`${DONE_MEMBER_A1} ${lastToolResultText(req).slice(0, 260)}`)
      }
      // ── Member B: own in-lane read (first turn) ──
      if (token === TOK_B) {
        if (!seen.has(CALL_B_OWN)) return readCall(CALL_B_OWN, paths.bInLane)
        return text(`${DONE_MEMBER_B1} ${lastToolResultText(req).slice(0, 260)}`)
      }
      // ── Member A Stop probe: a read on the DECLARED ask lane; the centre
      //    parks the call at its durable approval wait, and the product's Stop
      //    must close that wait as ADMISSION_STOPPED. ──
      if (token === TOK_A_STOP) {
        if (!seen.has(CALL_A_ASK)) return readCall(CALL_A_ASK, paths.ask)
        return text(`DBOOT_D2_A_STOP_PROBE_UNEXPECTED_CONTINUATION ${lastToolResultText(req).slice(0, 400)}`)
      }
      // ── Member B follow-ups: after-stop control, then the revocation trio ──
      if (token === TOK_B_AFTER) {
        if (!seen.has(CALL_B_AFTER)) return readCall(CALL_B_AFTER, paths.bInLane)
        return text(`${DONE_MEMBER_B_AFTER} ${lastToolResultText(req).slice(0, 260)}`)
      }
      if (token === TOK_B_PRE) {
        // The in-lane read is the UNTOUCHED control. It is measured at EVERY
        // phase (pre / deny / restore) so "unaffected throughout" is a
        // measurement, not an inference from one call before the mutation.
        if (!seen.has(CALL_B_PRE_INLANE)) return readCall(CALL_B_PRE_INLANE, paths.bInLane)
        if (!seen.has(CALL_B_PRE)) return readCall(CALL_B_PRE, paths.revocable)
        return text(`${DONE_MEMBER_B_PRE} ${lastToolResultText(req).slice(0, 260)}`)
      }
      if (token === TOK_B_MID) {
        if (!seen.has(CALL_B_MID_INLANE)) return readCall(CALL_B_MID_INLANE, paths.bInLane)
        if (!seen.has(CALL_B_MID)) return readCall(CALL_B_MID, paths.revocable)
        return text(`${DONE_MEMBER_B_MID} ${lastToolResultText(req).slice(0, 260)}`)
      }
      if (token === TOK_B_POST) {
        if (!seen.has(CALL_B_POST_INLANE)) return readCall(CALL_B_POST_INLANE, paths.bInLane)
        if (!seen.has(CALL_B_POST)) return readCall(CALL_B_POST, paths.revocable)
        return text(`${DONE_MEMBER_B_POST} ${lastToolResultText(req).slice(0, 260)}`)
      }
      // ── Member B widening probe: after the mutation lane was asked to mint
      //    an `allow` BEYOND B's compiled lane, B tries that exact locator. ──
      if (token === TOK_B_WIDEN) {
        if (!seen.has(CALL_B_WIDEN)) return readCall(CALL_B_WIDEN, paths.aInLane)
        return text(`${DONE_MEMBER_B_WIDEN} ${lastToolResultText(req).slice(0, 260)}`)
      }
      // ── ROUND 83 — the DELIVERED work unit (member.send, not a delegation):
      //    B reads its own in-lane file, exactly one native tool call, then
      //    reports. The call is admitted by the centre under B's OWN binding. ──
      if (token === TOK_RD) {
        if (!seen.has(CALL_RD)) return readCall(CALL_RD, paths.bInLane)
        return text(`${DONE_MEMBER_RD} ${lastToolResultText(req).slice(0, 260)}`)
      }
      // ── ROUND 83 — the STOP arm of a delivered turn: A's ask lane parks at
      //    the centre's durable approval wait, so the product's Stop can land
      //    while the DELIVERED turn is live. ──
      if (token === TOK_RD_STOP) {
        if (!seen.has(CALL_RD_STOP)) return readCall(CALL_RD_STOP, paths.ask)
        return text(`${DONE_MEMBER_RD_STOP} ${lastToolResultText(req).slice(0, 400)}`)
      }
      return text('DBOOT_D2_MEMBER_NOOP')
    }

    if (lastUser.includes(MK_DISC)) return text('DBOOT_D2_DISC_DONE')

    // The Leader's OWN turn marker is selected as the LATEST marker present in
    // the accumulated conversation: after an async delegation the provider's
    // next request may carry a synthetic last-user message (measured), so a
    // `lastUser`-only test would fall through to NOOP. Highest marker wins.
    const leaderPhase = [MK_L1, MK_L2, MK_L3, MK_L4, MK_L5, MK_L6, MK_L7, MK_L8, MK_L9]
      .filter((m) => allText.includes(m)).at(-1) ?? null

    // ── L1: two ASYNCHRONOUS delegations (the concurrency subject) ──
    if (leaderPhase === MK_L1) {
      const seen = resultIdsOf(req)
      // BOTH async delegations are issued in ONE model response so the two
      // Member turns start together: issuing them on separate model rounds
      // serialises them (measured: A finished before B received its first
      // request, so there was no concurrency to measure).
      const wants = []
      if (!seen.has(CALL_DELEGATE_A)) {
        wants.push({
          id: CALL_DELEGATE_A,
          name: 'team_delegate',
          arguments: {
            rootSessionId: BOOT_ROOT,
            requestToken: 'dboot-d2-delegate-a',
            delegationTemplateId: 'worker-a',
            label: 'dboot-d2-worker-a',
            workspace: paths.aDir,
            prompt: `${TOK_A}: read the file \`${paths.aInLane}\`, then read the file \`${paths.bInLane}\`, one tool call at a time, then report both outcomes briefly.`,
            async: true,
          },
        })
      }
      if (!seen.has(CALL_DELEGATE_B)) {
        wants.push({
          id: CALL_DELEGATE_B,
          name: 'team_delegate',
          arguments: {
            rootSessionId: BOOT_ROOT,
            requestToken: 'dboot-d2-delegate-b',
            delegationTemplateId: 'worker-b',
            label: 'dboot-d2-worker-b',
            workspace: paths.bDir,
            prompt: `${TOK_B}: read the file \`${paths.bInLane}\`, one tool call, then report briefly.`,
            async: true,
          },
        })
      }
      if (wants.length > 0) return { kind: 'tool-call', toolCalls: wants }
      return text(DONE_L1)
    }

    // ── L2: follow-up A (ask-lane Stop probe) and follow-up B (control) ──
    if (leaderPhase === MK_L2) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_FOLLOW_A)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_FOLLOW_A,
            name: 'team_follow_up',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: 'dboot-d2-follow-a-stop',
              targetInstanceId: ids.a,
              prompt: `${TOK_A_STOP}: read the file \`${paths.ask}\`, one tool call, then report briefly.`,
              async: true,
            },
          }],
        }
      }
      if (!seen.has(CALL_FOLLOW_B)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_FOLLOW_B,
            name: 'team_follow_up',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: 'dboot-d2-follow-b-control',
              targetInstanceId: ids.b,
              prompt: `${TOK_B_AFTER}: read the file \`${paths.bInLane}\`, one tool call, then report briefly.`,
              async: true,
            },
          }],
        }
      }
      return text(DONE_L2)
    }

    // ── L3/L5/L7: one B follow-up each (pre / mid / post revocation) ──
    const bullFollow = [
      [MK_L3, CALL_FOLLOW_B_PRE, TOK_B_PRE, 'pre', DONE_L3],
      [MK_L5, CALL_FOLLOW_B_MID, TOK_B_MID, 'mid', DONE_L5],
      [MK_L7, CALL_FOLLOW_B_POST, TOK_B_POST, 'post', DONE_L7],
    ].find(([marker]) => leaderPhase === marker)
    if (bullFollow !== undefined) {
      const [, callId, tok, phase, done] = bullFollow
      if (!resultIdsOf(req).has(callId)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: callId,
            name: 'team_follow_up',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: `dboot-d2-follow-b-${phase}`,
              targetInstanceId: ids.b,
              prompt: `${tok}: read the file \`${paths.revocable}\`, one tool call, then report briefly.`,
              async: true,
            },
          }],
        }
      }
      return text(done)
    }

    // ── L8 / L9: WIDENING IS REFUSED (measured, not assumed) ───────────────
    // L8 asks the ONE durable mutation lane to mint an `allow` on a locator
    // OUTSIDE Member B's compiled read lane (A's in-lane file). The product's
    // own answer shape is recorded verbatim — typed refusal, no-op, or commit —
    // and L9 then makes B try that locator, so the EFFECT is measured too.
    if (leaderPhase === MK_L8) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_GRANT_WIDEN)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_GRANT_WIDEN,
            name: 'team_grant_permission',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: 'dboot-d2-grant-widen',
              targetInstanceId: ids.b,
              rules: [{
                operationClass: 'read',
                matcher: { kind: 'exact', value: paths.aInLane },
                effect: 'allow',
              }],
            },
          }],
        }
      }
      return text(DONE_L8)
    }
    if (leaderPhase === MK_L9) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_FOLLOW_B_WIDEN)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_FOLLOW_B_WIDEN,
            name: 'team_follow_up',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: 'dboot-d2-follow-b-widen',
              targetInstanceId: ids.b,
              prompt: `${TOK_B_WIDEN}: read the file \`${paths.aInLane}\`, one tool call, then report briefly.`,
              async: true,
            },
          }],
        }
      }
      return text(DONE_L9)
    }

    // ── L4 / L6: the ONE durable permission mutation lane ──
    if (leaderPhase === MK_L4 || leaderPhase === MK_L6) {
      const grant = leaderPhase === MK_L4
      const callId = grant ? CALL_GRANT : CALL_REVOKE
      const done = grant ? DONE_L4 : DONE_L6
      if (!resultIdsOf(req).has(callId)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: callId,
            name: grant ? 'team_grant_permission' : 'team_revoke_permission',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: grant ? 'dboot-d2-grant' : 'dboot-d2-revoke',
              targetInstanceId: ids.b,
              rules: [{
                operationClass: 'read',
                matcher: { kind: 'exact', value: paths.revocable },
                effect: 'deny',
              }],
            },
          }],
        }
      }
      return text(done)
    }
    return text('DBOOT_D2_NOOP')
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

function judgeMultiMember({ a, b, facts, paths }) {
  const at = (locator) => facts.filter((f) => String(f.locator ?? '') === locator)
  const aOwnFacts = at(paths.aInLane)
  const bOwnFacts = at(paths.bInLane)
  const aOwn = a?.own ?? null
  const bOwn = b?.own ?? null
  const aCross = a?.cross ?? null
  const aText = String(aOwn?.result?.text ?? '')
  const bText = String(bOwn?.result?.text ?? '')
  const crossText = String(aCross?.result?.text ?? '')
  const aAdmissions = (a?.ledger ?? []).filter((r) => r?.kind === 'invocation-authority' && r?.toolName === 'read')
  const bAdmissions = (b?.ledger ?? []).filter((r) => r?.kind === 'invocation-authority' && r?.toolName === 'read')
  const aAllow = aAdmissions.find((r) => String(r?.locator ?? '') === paths.aInLane && r?.decision === 'allow') ?? null
  const aDeny = aAdmissions.find((r) => String(r?.locator ?? '') === paths.bInLane && r?.decision === 'deny') ?? null
  const bAllow = bAdmissions.find((r) => String(r?.locator ?? '') === paths.bInLane && r?.decision === 'allow') ?? null
  // B's OWN lane denials. The judged one is the widening probe at A's
  // locator (round 71), which is a DIFFERENT call than A's cross-member read:
  // the clause below proves A's cross refusal never appears in B's ledger, so
  // it looks at B's in-lane locator only.
  const bLaneDeny = bAdmissions.filter((r) => r?.refusalCode === 'LANE_DENY' && String(r?.locator ?? '') === paths.bInLane)
  const aExec = (a?.ledger ?? []).filter((r) => r?.kind === 'execution')
  const bExec = (b?.ledger ?? []).filter((r) => r?.kind === 'execution')
  // Only ADMISSION facts carry the member identity; execution facts carry the
  // CHILD SESSION id in `agentId`, so mixing the two would compare unlike fields.
  const aIdentities = [...new Set(aAdmissions.map((r) => `${String(r?.instanceId ?? '')}/${String(r?.agentId ?? '')}`))]
  const bIdentities = [...new Set(bAdmissions.map((r) => `${String(r?.instanceId ?? '')}/${String(r?.agentId ?? '')}`))]
  return verdictOf(
    'TWO governed Members run at the same time; each native `read` is admitted inside its OWN compiled lane and served by its OWN controlled Provider, the centre ledgers stay separate, and Member A\'s out-of-lane read of Member B\'s file is refused with zero B bytes',
    [
      { id: 'two-distinct-instances', ok: typeof a?.instance === 'string' && typeof b?.instance === 'string' && a.instance !== '' && b.instance !== '' && a.instance !== b.instance, detail: `instanceA=${String(a?.instance)} instanceB=${String(b?.instance)}` },
      { id: 'a-own-admitted', ok: aOwn?.result?.isError === false && aText.includes(A_IN_LANE_TEXT), detail: `isError=${String(aOwn?.result?.isError)} bytes=${String(aText.includes(A_IN_LANE_TEXT))}` },
      { id: 'b-own-admitted', ok: bOwn?.result?.isError === false && bText.includes(B_IN_LANE_TEXT), detail: `isError=${String(bOwn?.result?.isError)} bytes=${String(bText.includes(B_IN_LANE_TEXT))}` },
      { id: 'concurrent-overlap', ok: a?.window !== null && b?.window !== null && Date.parse(a.window.first) < Date.parse(b.window.last) && Date.parse(b.window.first) < Date.parse(a.window.last), detail: `A=[${String(a?.window?.first)}..${String(a?.window?.last)}] B=[${String(b?.window?.first)}..${String(b?.window?.last)}]` },
      { id: 'a-guard-facts-own-identity', ok: aOwnFacts.length >= 1 && aOwnFacts.every((f) => f.decision === 'allow' && f.memberIdentity === a.instance), detail: `facts=${String(aOwnFacts.length)} identities=${JSON.stringify([...new Set(aOwnFacts.map((f) => f.memberIdentity))])} expected=${String(a?.instance)}` },
      { id: 'b-guard-facts-own-identity', ok: bOwnFacts.length >= 1 && bOwnFacts.every((f) => f.decision === 'allow' && f.memberIdentity === b.instance), detail: `facts=${String(bOwnFacts.length)} identities=${JSON.stringify([...new Set(bOwnFacts.map((f) => f.memberIdentity))])} expected=${String(b?.instance)}` },
      { id: 'cross-lane-refused', ok: aCross?.result?.isError === true && crossText.includes('LANE_DENY'), detail: `isError=${String(aCross?.result?.isError)} laneDeny=${String(crossText.includes('LANE_DENY'))}` },
      { id: 'cross-zero-b-bytes', ok: crossText.includes(B_IN_LANE_TEXT) === false, detail: 'Member B\'s in-lane bytes never reached Member A\'s transcript for the crossed call' },
      { id: 'cross-never-reached-b-provider', ok: factsAtIdentity(facts, paths.bInLane, a?.instance).length === 0, detail: `guard facts for B's locator under A's identity=${String(factsAtIdentity(facts, paths.bInLane, a?.instance).length)} (the centre refused before the Provider)` },
      { id: 'a-ledger-own-allow', ok: aAllow?.axis === 'fs.read', detail: `decision=${String(aAllow?.decision)} axis=${String(aAllow?.axis)}` },
      { id: 'a-ledger-cross-deny', ok: aDeny?.refusalCode === 'LANE_DENY' && aDeny?.axis === 'fs.read', detail: `decision=${String(aDeny?.decision)} refusalCode=${String(aDeny?.refusalCode)}` },
      { id: 'a-ledger-only-a-identity', ok: aIdentities.length === 1 && aIdentities[0] === `${a.instance}/${a.instance}`, detail: `identities=${JSON.stringify(aIdentities)}` },
      { id: 'b-ledger-own-allow', ok: bAllow?.decision === 'allow' && bAllow?.axis === 'fs.read', detail: `decision=${String(bAllow?.decision)} axis=${String(bAllow?.axis)}` },
      { id: 'b-ledger-no-lane-deny', ok: bLaneDeny.length === 0, detail: `B LANE_DENY admissions AT B's OWN locator=${String(bLaneDeny.length)} (A's cross-lane refusal never appears in B's ledger; the separate round-71 widening probe at A's locator is B's OWN call, not A's)` },
      { id: 'b-ledger-only-b-identity', ok: bIdentities.length === 1 && bIdentities[0] === `${b.instance}/${b.instance}`, detail: `identities=${JSON.stringify(bIdentities)}` },
      { id: 'a-ledger-executions', ok: aExec.some((r) => r?.outcome === 'completed') && aExec.some((r) => r?.outcome === 'admission-refusal'), detail: `executions=${JSON.stringify(aExec.map((r) => r?.outcome))}` },
      { id: 'b-ledger-executions', ok: bExec.some((r) => r?.outcome === 'completed'), detail: `executions=${JSON.stringify(bExec.map((r) => r?.outcome))}` },
      { id: 'ledgers-are-separate-files', ok: a?.ledgerPath !== b?.ledgerPath && existsSync(a?.ledgerPath ?? '') && existsSync(b?.ledgerPath ?? ''), detail: `A=${String(a?.ledgerPath)} B=${String(b?.ledgerPath)}` },
    ],
  )
}
function factsAtIdentity(facts, locator, identity) {
  return facts.filter((f) => String(f.locator ?? '') === locator && String(f.memberIdentity ?? '') === String(identity))
}

/**
 * ROUND 83 — THE DELIVERY LAW, measured on the live row.
 *
 * The management plane may DELIVER work; it may never EXECUTE a tool. A
 * `member.send` is lawful exactly when: the operator receives the messaging
 * coordinator's durable delivery ACKNOWLEDGEMENT (inbox acceptance, with its
 * intent + confirmation sequences), the request itself leaves ZERO admission
 * and ZERO execution facts, and the work then runs in the MEMBER's own turn —
 * where the centre's `allow` for that `read` is written under the MEMBER's
 * binding in the MEMBER's own fact ledger, AFTER the acknowledgement.
 *
 * The error paths are part of the same proposition: an unknown member, a
 * duplicate delivery (a replay, not a second turn), an ARCHIVED member (typed,
 * not work-accepting, nothing runs), the restore that re-enables delivery, and
 * the product's Stop during a DELIVERED turn (ADMISSION_STOPPED, never a
 * completion).
 */
function judgeRemoteDelivery({ b, paths, delivery }) {
  const ack = delivery?.atAck ?? null
  const after = delivery?.after ?? null
  const ackOutcome = ack?.outcome ?? null
  const admissions = after?.admissions ?? []
  const allow = admissions.find((r) => r?.decision === 'allow') ?? null
  const executions = after?.executions ?? []
  const completed = executions.find((r) => r?.outcome === 'completed') ?? null
  const text = String(after?.memberResult?.text ?? '')
  const ackedAt = Date.parse(String(delivery?.ackedAt ?? ''))
  const admittedAt = Date.parse(String(allow?.at ?? ''))
  const ackKeys = Object.keys(ackOutcome ?? {})
  return verdictOf(
    'the S6 management plane DELIVERS work and never executes it: `member.send` returns the coordinator\'s durable delivery acknowledgement with ZERO tool executions and the Member\'s own governed turn then writes the centre\'s admission `allow` (for that Member\'s binding) into the MEMBER\'s fact ledger',
    [
      { id: 'ack-http-ok', ok: ack?.status === 200 && ack?.ok === true, detail: `status=${String(ack?.status)} ok=${String(ack?.ok)} code=${String(ack?.code)}` },
      { id: 'ack-is-delivery-outcome', ok: ackOutcome?.status === 'delivered' && String(ackOutcome?.deliveredToInstanceId ?? '') === String(b?.instance), detail: `outcome=${JSON.stringify(ackOutcome)}` },
      { id: 'ack-carries-durable-sequences', ok: typeof ackOutcome?.factSequence === 'number' && typeof ackOutcome?.deliveredSequence === 'number' && Number(ackOutcome.deliveredSequence) > Number(ackOutcome.factSequence), detail: `intent=${String(ackOutcome?.factSequence)} confirmation=${String(ackOutcome?.deliveredSequence)}` },
      { id: 'ack-is-not-a-tool-result', ok: ackOutcome !== null && ['toolResult', 'result', 'assistant', 'executionId'].every((key) => ackKeys.includes(key) === false), detail: `ack keys=${JSON.stringify(ackKeys)}` },
      { id: 'request-executed-nothing', ok: ack?.admissions === 0 && ack?.executions === 0, detail: `admissions=${String(ack?.admissions)} executions=${String(ack?.executions)} AT the acknowledgement` },
      { id: 'ack-precedes-the-member-admission', ok: Number.isFinite(ackedAt) && Number.isFinite(admittedAt) && admittedAt >= ackedAt, detail: `ack=${String(delivery?.ackedAt)} admission=${String(allow?.at)}` },
      { id: 'member-own-admission-allow', ok: allow !== null && allow?.decision === 'allow' && allow?.axis === 'fs.read', detail: `decision=${String(allow?.decision)} axis=${String(allow?.axis)}` },
      { id: 'member-admission-under-member-binding', ok: String(allow?.instanceId ?? '') === String(b?.instance) && String(allow?.agentId ?? '') === String(b?.instance) && String(allow?.locator ?? '') === paths.bInLane, detail: `instance=${String(allow?.instanceId)} agent=${String(allow?.agentId)} locator=${String(allow?.locator)}` },
      { id: 'no-operator-identity-in-member-ledger', ok: admissions.length >= 1 && admissions.every((r) => String(r?.instanceId ?? '') === String(b?.instance)), detail: `identities=${JSON.stringify([...new Set(admissions.map((r) => String(r?.instanceId)))])}` },
      { id: 'member-execution-completed', ok: completed !== null && completed?.isError === false, detail: `outcomes=${JSON.stringify(executions.map((r) => r?.outcome))}` },
      { id: 'member-read-really-ran', ok: after?.memberResult?.isError === false && text.includes(B_IN_LANE_TEXT), detail: `isError=${String(after?.memberResult?.isError)} bytes=${String(text.includes(B_IN_LANE_TEXT))}` },
      { id: 'member-turn-came-from-the-delivery', ok: Number(after?.memberRequests) >= 1, detail: `member provider requests carrying the delivered token=${String(after?.memberRequests)}` },
      { id: 'unknown-member-typed-no-execution', ok: delivery?.unknownMember?.ok === false && typeof delivery?.unknownMember?.code === 'string' && delivery.unknownMember.code !== 'ADMISSION_REMOTE_UNAVAILABLE' && delivery?.unknownMember?.requestsAdded === 0, detail: `code=${String(delivery?.unknownMember?.code)} requestsAdded=${String(delivery?.unknownMember?.requestsAdded)}` },
      { id: 'duplicate-delivery-durable-and-ghost-free', ok: delivery?.duplicate?.ok === true && delivery?.duplicate?.outcome?.status === 'delivered' && delivery?.duplicate?.requestsAdded === 0 && executions.filter((r) => r?.outcome === 'completed').length === 1, detail: `ok=${String(delivery?.duplicate?.ok)} delivered=${String(delivery?.duplicate?.outcome?.status)} newDurableCoordination=${String(delivery?.duplicate?.distinctFromFirst)} requestsAddedAtAck=${String(delivery?.duplicate?.requestsAdded)} completedExecutionsForTheDeliveredCall=${String(executions.filter((r) => r?.outcome === 'completed').length)} (at-least-once delivery: a second send is a second coordination, never an operator-side execution)` },
      { id: 'archived-member-refused-typed', ok: delivery?.archived?.archiveOk === true && delivery?.archived?.lifecycle === 'ARCHIVED' && delivery?.archived?.ok === false && typeof delivery?.archived?.code === 'string' && delivery.archived.code !== 'ADMISSION_REMOTE_UNAVAILABLE' && delivery?.archived?.requestsAdded === 0, detail: `archiveOk=${String(delivery?.archived?.archiveOk)} archiveCode=${String(delivery?.archived?.archiveCode)} archiveMessage=${String(delivery?.archived?.archiveMessage)} lifecycle=${String(delivery?.archived?.lifecycle)} code=${String(delivery?.archived?.code)} requestsAdded=${String(delivery?.archived?.requestsAdded)}` },
      { id: 'restore-reenables-delivery', ok: (delivery?.restored?.lifecycle === 'SETTLED' || delivery?.restored?.lifecycle === 'RUNNING') && delivery?.restored?.ok === true, detail: `lifecycle=${String(delivery?.restored?.lifecycle)} ok=${String(delivery?.restored?.ok)} code=${String(delivery?.restored?.code)}` },
      { id: 'stop-during-delivered-turn-acked', ok: delivery?.stop?.ack?.ok === true && delivery?.stop?.pending === true, detail: `ackOk=${String(delivery?.stop?.ack?.ok)} pending=${String(delivery?.stop?.pending)}` },
      { id: 'stopped-delivered-call-is-admission-stopped', ok: delivery?.stop?.fact?.refusalCode === 'ADMISSION_STOPPED' && delivery?.stop?.fact?.decision === 'deny', detail: `refusalCode=${String(delivery?.stop?.fact?.refusalCode)} decision=${String(delivery?.stop?.fact?.decision)}` },
      { id: 'stopped-delivered-not-completed', ok: (delivery?.stop?.executions ?? []).every((r) => r?.outcome !== 'completed'), detail: `executions=${JSON.stringify((delivery?.stop?.executions ?? []).map((r) => r?.outcome))}` },
      { id: 'stopped-delivered-settlement-refused', ok: delivery?.stop?.settlement?.state === 'REFUSED' && delivery?.stop?.settlement?.dispatch !== 'dispatched', detail: `state=${String(delivery?.stop?.settlement?.state)} dispatch=${String(delivery?.stop?.settlement?.dispatch)}` },
    ],
  )
}

/**
 * ROUND 71 (judge semantics). The old REQUIRED clause demanded that the
 * durable overlay WIDEN authority: revoking the durable deny had to refuse a
 * call that previously succeeded, with a new compiled generation in the fact.
 * The contract forbids exactly that (`overlay-decision.mjs:9`,
 * `admission-port.mjs:498-521`, `permission-mutation.ts:435-436`), so the judge
 * was measuring a capability the product must never have.
 *
 * The rewritten judge measures the CONTRACT, strictly:
 *
 *   (a) a durable DENY lands -> the previously admitted call is refused
 *       `ADMISSION_OVERLAY_DENY`, zero body, settlement REFUSED, and the fact
 *       names the overlay as the deciding authority and carries a policy
 *       generation;
 *   (b) removing that deny RESTORES the call (admitted + COMPLETED) as a NEW
 *       fact in the same call-id family;
 *   (c) an untouched in-lane call is admitted at EVERY phase (pre / deny /
 *       restore), so "unaffected throughout" is measured;
 *   (d) WIDENING IS REFUSED: the durable mutation path is asked for an `allow`
 *       beyond B's compiled lane. Its own answer is recorded verbatim (typed
 *       refusal, no-op, or commit) and must not mint authority; B's subsequent
 *       call to that locator must still be refused with zero A bytes.
 */
function judgeRevocation({ b, paths, mutation, widening, settlement }) {
  const textOf = (sample) => String(sample?.result?.text ?? '')
  const preText = textOf(mutation?.pre)
  const midText = textOf(mutation?.mid)
  const postText = textOf(mutation?.post)
  const grantText = textOf(mutation?.grant)
  const revokeText = textOf(mutation?.revoke)
  const ledger = b?.ledger ?? []
  const factsFor = (locator) => ledger.filter((r) => r?.kind === 'invocation-authority' && String(r?.locator ?? '') === locator)
  const revocableFacts = factsFor(paths.revocable)
  const factOf = (sample) => revocableFacts.find((r) => String(r?.callId ?? '') === String(sample?.call?.callId ?? '')) ?? null
  const preFact = factOf(mutation?.pre)
  const midFact = factOf(mutation?.mid)
  const postFact = factOf(mutation?.post)
  const grantSettled = (() => {
    try { return JSON.parse(grantText) } catch { return null }
  })()
  const revokeSettled = (() => {
    try { return JSON.parse(revokeText) } catch { return null }
  })()
  // (c) The in-lane control at every phase.
  const inLane = [
    ['pre', mutation?.preInLane, settlement?.bPreInLane],
    ['deny', mutation?.midInLane, settlement?.bMidInLane],
    ['restore', mutation?.postInLane, settlement?.bPostInLane],
  ].map(([phase, sample, settled]) => ({
    phase,
    callId: String(sample?.call?.callId ?? ''),
    admitted: sample?.result?.isError === false && textOf(sample).includes(B_IN_LANE_TEXT),
    state: settled?.state ?? null,
    fact: ledger.find((r) => r?.kind === 'invocation-authority' && String(r?.callId ?? '') === String(sample?.call?.callId ?? '')) ?? null,
  }))
  // (d) The widening answer, recorded verbatim. `allowedShapes` is DELIBERATELY
  // not "whatever came back": a committed expansion (`changed:true`) is the one
  // shape the contract forbids and the one this clause refuses to accept.
  const wideningText = textOf(widening?.grant)
  let wideningAnswer = null
  try { wideningAnswer = JSON.parse(wideningText) } catch { wideningAnswer = null }
  const wideningRefusedOrNoop = wideningAnswer !== null
    && ((wideningAnswer.status === 'rejected' && typeof wideningAnswer.code === 'string' && wideningAnswer.code !== '')
      || (wideningAnswer.status === 'permission-mutated' && wideningAnswer.changed === false))
  const wideningReadText = textOf(widening?.read)
  const wideningFact = ledger.find((r) => r?.kind === 'invocation-authority' && String(r?.callId ?? '') === String(widening?.read?.call?.callId ?? '')) ?? null
  const callFamily = [mutation?.pre?.call?.callId, mutation?.mid?.call?.callId, mutation?.post?.call?.callId].map((v) => String(v ?? ''))
  const familyOk = callFamily.every((id) => id.startsWith('call-d2-b-')) && new Set(callFamily).size === 3
  return verdictOf(
    'REQUIRED: a durable permission DENY through the product\'s ONE permissionOverlay mutation lane refuses the previously admitted call (`ADMISSION_OVERLAY_DENY`, zero body, settlement REFUSED, fact naming the overlay and carrying a policy generation); removing that deny restores the SAME call (admitted + COMPLETED, a NEW fact); an untouched in-lane call is admitted at every phase; and the same durable lane CANNOT mint an `allow` beyond the compiled ceiling',
    [
      { id: 'member-live-at-mutation', ok: mutation?.lifecycleBefore === 'RUNNING' || mutation?.lifecycleBefore === 'SETTLED', detail: `lifecycle=${String(mutation?.lifecycleBefore)}` },
      { id: 'pre-deny-call-admitted', ok: mutation?.pre?.result?.isError === false && preText.includes(REVOCABLE_TEXT) && preFact?.decision === 'allow', detail: `isError=${String(mutation?.pre?.result?.isError)} bytes=${String(preText.includes(REVOCABLE_TEXT))} factDecision=${String(preFact?.decision)}` },
      { id: 'product-mutation-lane-driven', ok: mutation?.grant?.call?.name === 'team_grant_permission' && mutation?.revoke?.call?.name === 'team_revoke_permission', detail: `grantCall=${String(mutation?.grant?.call?.name)} revokeCall=${String(mutation?.revoke?.call?.name)}` },
      // ── (a) the durable deny lands and removes authority ──────────────────
      { id: 'a-durable-deny-committed', ok: grantSettled?.status === 'permission-mutated' && grantSettled?.changed === true, detail: grantText.slice(0, 220) },
      { id: 'a-overlay-refuses-previously-admitted', ok: mutation?.mid?.result?.isError === true && midText.includes('ADMISSION_OVERLAY_DENY'), detail: `isError=${String(mutation?.mid?.result?.isError)} overlayDeny=${String(midText.includes('ADMISSION_OVERLAY_DENY'))} text=${midText.slice(0, 200)}` },
      { id: 'a-zero-body', ok: midText.includes(REVOCABLE_TEXT) === false, detail: 'the refused call returned ZERO bytes of the previously readable file' },
      { id: 'a-settlement-refused', ok: settlement?.bMid?.state === 'REFUSED' && settlement?.bMid?.dispatch === 'not-started', detail: `state=${String(settlement?.bMid?.state)} dispatch=${String(settlement?.bMid?.dispatch)} bodyOutcome=${String(settlement?.bMid?.bodyOutcome)}` },
      { id: 'a-fact-names-overlay-deciding-authority', ok: midFact?.decision === 'deny' && midFact?.refusalCode === 'ADMISSION_OVERLAY_DENY' && midFact?.overlayOutcome === 'deny' && midFact?.laneDecision === 'allow', detail: `decision=${String(midFact?.decision)} refusalCode=${String(midFact?.refusalCode)} overlayOutcome=${String(midFact?.overlayOutcome)} laneDecision=${String(midFact?.laneDecision)} (the lane allowed; the overlay is what refused)` },
      { id: 'a-fact-carries-policy-generation', ok: typeof midFact?.policyGeneration === 'string' && midFact.policyGeneration !== '', detail: `policyGeneration=${String(midFact?.policyGeneration)}` },
      // ── (b) removing the deny restores the call ───────────────────────────
      { id: 'b-deny-removal-committed', ok: revokeSettled?.status === 'permission-mutated' && revokeSettled?.changed === true, detail: revokeText.slice(0, 220) },
      { id: 'b-call-restored-admitted', ok: mutation?.post?.result?.isError === false && postText.includes(REVOCABLE_TEXT) && postFact?.decision === 'allow', detail: `isError=${String(mutation?.post?.result?.isError)} bytes=${String(postText.includes(REVOCABLE_TEXT))} factDecision=${String(postFact?.decision)}` },
      { id: 'b-call-restored-completed', ok: settlement?.bPost?.state === 'COMPLETED' && settlement?.bPost?.dispatch === 'quiesced', detail: `state=${String(settlement?.bPost?.state)} dispatch=${String(settlement?.bPost?.dispatch)} bodyOutcome=${String(settlement?.bPost?.bodyOutcome)}` },
      { id: 'b-same-call-family-new-fact', ok: familyOk && preFact !== null && postFact !== null && String(preFact?.callId) !== String(postFact?.callId) && new Set([preFact?.at, midFact?.at, postFact?.at]).size >= 2, detail: `callIds=${JSON.stringify(callFamily)} preFact=${String(preFact?.callId)}@${String(preFact?.at)} midFact=${String(midFact?.callId)}@${String(midFact?.at)} postFact=${String(postFact?.callId)}@${String(postFact?.at)} (same family, distinct durable facts — never a replay of the pre fact)` },
      // ── (c) the untouched in-lane call, at every phase ────────────────────
      { id: 'c-in-lane-unaffected-throughout', ok: inLane.every((s) => s.admitted && s.state === 'COMPLETED' && s.fact?.decision === 'allow'), detail: `phases=${JSON.stringify(inLane.map((s) => ({ phase: s.phase, callId: s.callId, admitted: s.admitted, settlement: s.state, fact: s.fact?.decision ?? null })))}` },
      // ── (d) widening is refused — measured, not assumed ───────────────────
      { id: 'd-widening-attempt-issued', ok: widening?.grant?.call?.name === 'team_grant_permission' && typeof wideningText === 'string' && wideningText !== '', detail: `call=${String(widening?.grant?.call?.name)} effect=allow locator=${String(paths.aInLane)} (outside Member B's compiled read lane) answer=${wideningText.slice(0, 220)}` },
      { id: 'd-widening-not-minted', ok: wideningAnswer !== null && wideningRefusedOrNoop, detail: `measured answer: status=${String(wideningAnswer?.status)} code=${String(wideningAnswer?.code)} changed=${String(wideningAnswer?.changed)} — a typed refusal or a no-op passes; a committed expansion (\`permission-mutated\` + \`changed:true\`) fails` },
      { id: 'd-widened-locator-still-refused', ok: widening?.read?.result?.isError === true && wideningReadText.includes('LANE_DENY') && wideningReadText.includes(A_IN_LANE_TEXT) === false, detail: `isError=${String(widening?.read?.result?.isError)} laneDeny=${String(wideningReadText.includes('LANE_DENY'))} A-bytes=${String(wideningReadText.includes(A_IN_LANE_TEXT))} text=${wideningReadText.slice(0, 180)}` },
      { id: 'd-widened-locator-fact-still-deny', ok: wideningFact?.decision === 'deny' && wideningFact?.refusalCode === 'LANE_DENY', detail: `decision=${String(wideningFact?.decision)} refusalCode=${String(wideningFact?.refusalCode)} (the compiled lane still decides; the attempt minted no authority)` },
    ],
  )
}

function judgeStop({ a, b, paths, control, settlement }) {
  const askFacts = (a?.ledger ?? []).filter((r) => r?.kind === 'invocation-authority' && String(r?.locator ?? '') === paths.ask)
  const stoppedFact = askFacts.find((r) => r?.refusalCode === 'ADMISSION_STOPPED') ?? null
  const askResult = a?.transcript?.calls.find((c) => String(c.callId) === String(CALL_A_ASK))?.result ?? null
  const askText = String(askResult?.text ?? '')
  const aExec = (a?.ledger ?? []).filter((r) => r?.kind === 'execution' && String(r?.locator ?? '') === paths.ask)
  const bAfter = b?.after ?? null
  return verdictOf(
    'a Member turn is STOPPED through the product\'s own Stop path, and the stopped call\'s outcome is the centre\'s ADMISSION_STOPPED — never a completion, never UNKNOWN — while a second Member unaffected by the Stop completes',
    [
      { id: 'stop-issued-product-rpc', ok: control?.cancelStatus === 200, detail: `session/cancel status=${String(control?.cancelStatus)}` },
      { id: 'ask-request-was-durable-and-pending', ok: control?.pending !== null && control?.pending !== undefined, detail: `pending control request=${JSON.stringify(control?.pending ?? null)}` },
      { id: 'pending-targets-stopped-member', ok: String(control?.pending?.targetInstanceId ?? '') === String(a?.instance), detail: `pending.targetInstanceId=${String(control?.pending?.targetInstanceId)} expected=${String(a?.instance)}` },
      { id: 'stopped-tool-result', ok: askResult?.isError === true && askText.includes('ADMISSION_STOPPED'), detail: `isError=${String(askResult?.isError)} text=${askText.slice(0, 260)}` },
      { id: 'stopped-centre-fact', ok: stoppedFact !== null && stoppedFact?.decision === 'deny', detail: `refusalCode=${String(stoppedFact?.refusalCode)} decision=${String(stoppedFact?.decision)} reason=${String(stoppedFact?.reason ?? '').slice(0, 200)}` },
      { id: 'never-completed', ok: aExec.every((r) => r?.outcome !== 'completed'), detail: `execution facts for the stopped call=${JSON.stringify(aExec.map((r) => r?.outcome))}` },
      { id: 'never-unknown', ok: settlement?.ask !== null && settlement?.ask !== undefined && settlement.ask.state !== 'UNKNOWN', detail: `settlement state=${String(settlement?.ask?.state)}` },
      { id: 'settled-refused-not-started', ok: settlement?.ask?.state === 'REFUSED' && settlement?.ask?.dispatch !== 'dispatched', detail: `state=${String(settlement?.ask?.state)} dispatch=${String(settlement?.ask?.dispatch)} bodyOutcome=${String(settlement?.ask?.bodyOutcome)}` },
      { id: 'second-member-unaffected', ok: bAfter?.result?.isError === false && String(bAfter?.result?.text ?? '').includes(B_IN_LANE_TEXT), detail: `B after-stop read isError=${String(bAfter?.result?.isError)} bytes=${String(String(bAfter?.result?.text ?? '').includes(B_IN_LANE_TEXT))}` },
      { id: 'second-member-settled-completed', ok: settlement?.bAfter?.state === 'COMPLETED', detail: `B settlement state=${String(settlement?.bAfter?.state)}` },
      { id: 'second-member-not-stopped', ok: (settlement?.bAfter?.stops ?? []).length === 0, detail: `B stops=${JSON.stringify(settlement?.bAfter?.stops ?? [])}` },
    ],
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// plan (host-free)
// ─────────────────────────────────────────────────────────────────────────────
function planOnly() {
  const layer = shippedLayer()
  log(`PLAN repo=${REPO_ROOT} hostTree=${HOST_TREE} pin=${HOST_PIN.sha}`)
  log(`shipped !!js substitutions: ${JSON.stringify(layer.jsSubstitutions)}`)
  const anchor = anchorBlueprintYaml()
  const planRoot = join(EVIDENCE, 'plan-workspace')
  const planDirs = { aDir: join(planRoot, 'team-a'), bDir: join(planRoot, 'team-b'), askDir: join(planRoot, 'team-a-ask'), askFile: join(planRoot, 'team-a-ask', ASK_FILE) }
  const main = mainBlueprintYaml({ denyList: ['u5_canary'], dirs: planDirs })
  const a = assertBlueprintText(anchor, BP_ANCHOR_ID, 'anchor.yaml')
  const m = assertBlueprintText(main, BP_MAIN_ID, 'main.yaml')
  log(`blueprints accepted: anchor=${JSON.stringify(a)} main=${JSON.stringify(m)}`)
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), workspaceDir: planRoot, mainYaml: main, layer })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['dboot-d2 plan (no World)'], rows) + '\n')
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
  let fixturePaths = null
  const ids = { a: null, b: null }
  let collectDiagnostics = () => ({})
  const counters = {}
  let result = null
  try {
    bootInfo = await lease.boot(async () => {
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      log(`[boot${String(index)}] world=${world.id} home=${world.home}`)
      mkdirSync(join(world.home, 'blueprints'), { recursive: true })
      const workspace = world.workspaceDir
      // Three SEPARATE directories: A's lane, B's lane, and the ask lane A
      // alone declares. The cross-member negative is only meaningful because
      // each template owns a DIFFERENT compiled read ceiling.
      const aDir = join(workspace, 'team-a')
      const bDir = join(workspace, 'team-b')
      const askDir = join(workspace, 'team-a-ask')
      mkdirSync(aDir, { recursive: true })
      mkdirSync(bDir, { recursive: true })
      mkdirSync(askDir, { recursive: true })
      fixturePaths = {
        aDir,
        bDir,
        askDir,
        aInLane: join(aDir, A_IN_LANE_FILE),
        bInLane: join(bDir, B_IN_LANE_FILE),
        ask: join(askDir, ASK_FILE),
        askFile: join(askDir, ASK_FILE),
        revocable: join(bDir, REVOCABLE_FILE),
      }
      writeFileSync(fixturePaths.aInLane, `${A_IN_LANE_TEXT}\n`, 'utf8')
      writeFileSync(fixturePaths.bInLane, `${B_IN_LANE_TEXT}\n`, 'utf8')
      writeFileSync(fixturePaths.ask, `${ASK_TEXT}\n`, 'utf8')
      writeFileSync(fixturePaths.revocable, `${REVOCABLE_TEXT}\n`, 'utf8')
      writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2) + '\n')

      // The v4 acceptance blueprint is the row's BOOTSTRAP ANCHOR, so it must
      // exist before the host boots (the boot create freezes/binds it).
      const mainText = mainBlueprintYaml({ denyList: [], dirs: fixturePaths })
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

      // `ids` is filled from the product's own durable projection below.
      const decide = makeDecide({ paths: fixturePaths, ids })
      process.env.A5SF_GOVERNED_SCRATCH = join(world.home, 'governed-scratch')
      mkdirSync(process.env.A5SF_GOVERNED_SCRATCH, { recursive: true })
      await world.startMock({ decide })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })
    hostReached = true
    abortStage = 'composition'
    paths = {
      ...fixturePaths,
      sink: join(world.home, 'a5sf-consult.jsonl'),
      centre: join(world.home, 'centre'),
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
    }, 120_000, 500)
    if (!healthOk) throw new Error('the World host never became healthy')
    log(`[boot${String(index)}] health ok`)

    const requests = () => world.mock?.requests ?? []
    const replyOf = (r) => String(r?.reply?.content ?? '')
    const sawReply = (marker) => requests().some((r) => replyOf(r).startsWith(marker))
    const promptTurn = async (marker, doneMarker, tag) => {
      const res = await apiPrompt(origin, cookie, BOOT_ROOT, marker, tag)
      if (res.status !== 200) throw new Error(`session/prompt(${tag}) failed: status=${String(res.status)} body=${redact(JSON.stringify(res.body ?? null)).slice(0, 400)}`)
      const ok = await waitFor(() => sawReply(doneMarker), 150_000)
      if (!ok) throw new Error(`the Leader turn ${tag} never produced ${doneMarker}`)
      return res
    }
    const readState = async () => (await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)).body
    const waitSettled = async (instanceId, label) => {
      const ok = await waitFor(async () => {
        const st = await readState()
        const row = (st?.members ?? []).find((m) => m.instanceId === instanceId)
        return row !== undefined && row.lifecycle === 'SETTLED'
      }, 120_000)
      if (!ok) throw new Error(`${label} never reached lifecycle SETTLED`)
    }

    collectDiagnostics = (label) => {
      const out = {
        label,
        at: new Date().toISOString(),
        mockRequests: requests().map((r) => ({
          seq: r.seq, receivedAt: r.receivedAt, token: memberTokenOf(r),
          reply: redact(replyOf(r)).slice(0, 240),
          tools: surfaceNamesOf(r).filter((n) => n === 'read' || n.startsWith('team_')),
        })),
        guardFacts: (() => { try { return parseJsonl(paths.sink) } catch { return [] } })(),
      }
      try { out.hostLogTail = redact(readFileSync(bootInfo.logPath, 'utf8').split('\n').slice(-80).join('\n')) } catch { out.hostLogTail = '<absent>' }
      writeFileSync(join(bootDir, `diagnostics-${label}.json`), JSON.stringify(out, null, 2) + '\n')
      try { writeFileSync(join(bootDir, `host-log-${label}.log`), out.hostLogTail + '\n') } catch { /* best effort */ }
      log(`[boot${String(index)}] diagnostics(${label}): mockRequests=${String(out.mockRequests.length)} replies=${JSON.stringify(out.mockRequests.map((r) => r.reply.slice(0, 40)))}`)
      return out
    }

    // ── discovery: MEASURE the real Leader surface (no guessed composition) ──
    abortStage = 'discovery'
    await promptTurn(MK_DISC, 'DBOOT_D2_DISC_DONE', 'd2disc')
    const discoveryRequest = requests().filter((r) => surfaceNamesOf(r).length > 0).at(-1) ?? null
    const leaderSurface = discoveryRequest === null ? [] : surfaceNamesOf(discoveryRequest)
    writeFileSync(join(bootDir, 'leader-surface.json'), JSON.stringify({
      tools: leaderSurface,
      teamTools: leaderSurface.filter((n) => n.startsWith('team_')),
      note: 'the model-visible surface the mock provider request carried on the Leader turn',
    }, null, 2) + '\n')
    log(`[boot${String(index)}] leader surface (${String(leaderSurface.length)}): team=${leaderSurface.filter((n) => n.startsWith('team_')).join(',')}`)

    // ── L1: TWO asynchronous delegations, at the same time ──────────────────
    abortStage = 'multi-member-delegate'
    await promptTurn(MK_L1, DONE_L1, 'd2l1')
    const a1 = await waitFor(() => sawReply(DONE_MEMBER_A1), 150_000)
    const b1 = await waitFor(() => sawReply(DONE_MEMBER_B1), 150_000)
    if (!a1 || !b1) throw new Error(`a member first turn never closed: A1=${String(a1)} B1=${String(b1)}`)
    log(`[boot${String(index)}] member first turns closed: A1=${String(a1)} B1=${String(b1)}`)

    const stateAfterL1 = await readState()
    const membersAfterL1 = Array.isArray(stateAfterL1?.members) ? stateAfterL1.members : []
    const rowA = membersAfterL1.find((m) => String(m?.templateId ?? '') === 'worker-a') ?? null
    const rowB = membersAfterL1.find((m) => String(m?.templateId ?? '') === 'worker-b') ?? null
    if (rowA === null || rowB === null) throw new Error(`the product projection does not carry both members: ${JSON.stringify(membersAfterL1.map((m) => `${m.templateId}:${m.instanceId}`))}`)
    ids.a = String(rowA.instanceId)
    ids.b = String(rowB.instanceId)
    log(`[boot${String(index)}] instances A=${ids.a} B=${ids.b} lives=${JSON.stringify(membersAfterL1.map((m) => `${m.templateId}:${m.instanceId}:${m.lifecycle}`))}`)
    writeFileSync(join(bootDir, 'members.json'), JSON.stringify(membersAfterL1, null, 2) + '\n')
    await waitSettled(ids.a, 'member A')
    await waitSettled(ids.b, 'member B')

    // The concurrency window is measured from the MOCK's own receive times of
    // the two members' first-turn requests, never from our wall-clock guesses.
    const aWindow = requestWindow(requests(), TOK_A)
    const bWindow = requestWindow(requests(), TOK_B)
    const transcriptA1 = readMemberTranscript(world.home, rowA.childSessionId)
    const transcriptB1 = readMemberTranscript(world.home, rowB.childSessionId)
    const callOf = (tx, id) => tx?.calls.find((c) => String(c.callId) === String(id)) ?? null

    // ── L2: A's ask-lane Stop probe + B's untouched control read ────────────
    abortStage = 'stop-probe'
    await promptTurn(MK_L2, DONE_L2, 'd2l2')
    const pendingOk = await waitFor(async () => {
      const st = await readState()
      return (st?.control?.requests ?? []).some((r) => String(r.targetInstanceId) === ids.a && String(r.status) === 'pending')
    }, 120_000, 200)
    const stateAtStop = await readState()
    const pendingRequest = (stateAtStop?.control?.requests ?? []).find((r) => String(r.targetInstanceId) === ids.a && String(r.status) === 'pending') ?? null
    if (!pendingOk || pendingRequest === null) {
      collectDiagnostics('no-pending-ask')
      throw new Error(`the Stop probe never parked at a durable approval request (pending=${String(pendingOk)})`)
    }
    log(`[boot${String(index)}] pending ask=${JSON.stringify({ requestId: pendingRequest.requestId, target: pendingRequest.targetInstanceId, toolName: pendingRequest.toolName, status: pendingRequest.status })}`)

    // The product's own Stop path, the exact sequence the Team view's
    // member-stop button issues (goals/get -> goals/pause -> session/cancel ->
    // goals/get). This arm has no continuous goal, so the pause/get legs are
    // no-ops and the TURN ABORT leg (session/cancel) is the one that lands.
    abortStage = 'stop'
    const stopAt = new Date().toISOString()
    const cancel = await apiSessionCancel(origin, cookie, rowA.childSessionId, 'dbootd2stop')
    log(`[boot${String(index)}] session/cancel(member A)=${String(cancel.status)}`)
    const stopLanded = await waitFor(async () => {
      const tx = readMemberTranscript(world.home, rowA.childSessionId)
      const call = tx?.calls.find((c) => String(c.callId) === String(CALL_A_ASK))
      return call !== undefined && call !== null && call.result !== null && call.result !== undefined
    }, 60_000, 200)
    if (!stopLanded) {
      collectDiagnostics('stop-not-landed')
      throw new Error('the stopped A turn produced no tool result for the ask call')
    }
    const bAfter = await waitFor(() => sawReply(DONE_MEMBER_B_AFTER), 150_000)
    if (!bAfter) throw new Error('member B never completed its after-stop control read')

    // ── revocation: pre / grant / mid / revoke / post, on the LIVE member B ──
    abortStage = 'revocation-pre'
    await waitSettled(ids.b, 'member B before pre-read')
    await promptTurn(MK_L3, DONE_L3, 'd2l3')
    if (!(await waitFor(() => sawReply(DONE_MEMBER_B_PRE), 150_000))) throw new Error('member B pre-revoke read never completed')
    await waitSettled(ids.b, 'member B after pre-read')

    const stateBeforeGrant = await readState()
    const bLifecycleBefore = (stateBeforeGrant?.members ?? []).find((m) => m.instanceId === ids.b)?.lifecycle ?? null

    abortStage = 'revocation-grant'
    await promptTurn(MK_L4, DONE_L4, 'd2l4')
    abortStage = 'revocation-mid'
    await waitSettled(ids.b, 'member B before mid-read')
    await promptTurn(MK_L5, DONE_L5, 'd2l5')
    if (!(await waitFor(() => sawReply(DONE_MEMBER_B_MID), 150_000))) throw new Error('member B mid-revoke read never completed')
    await waitSettled(ids.b, 'member B after mid-read')

    abortStage = 'revocation-revoke'
    await promptTurn(MK_L6, DONE_L6, 'd2l6')
    abortStage = 'revocation-post'
    await waitSettled(ids.b, 'member B before post-read')
    await promptTurn(MK_L7, DONE_L7, 'd2l7')
    if (!(await waitFor(() => sawReply(DONE_MEMBER_B_POST), 150_000))) throw new Error('member B post-revoke read never completed')
    await waitSettled(ids.b, 'member B after post-read')

    // ── widening: ask the lane for authority beyond B's compiled ceiling,
    //    then have B try the widened locator (the EFFECT, not just the answer) ──
    abortStage = 'widening-grant'
    await promptTurn(MK_L8, DONE_L8, 'd2l8')
    abortStage = 'widening-read'
    await waitSettled(ids.b, 'member B before widening read')
    await promptTurn(MK_L9, DONE_L9, 'd2l9')
    if (!(await waitFor(() => sawReply(DONE_MEMBER_B_WIDEN), 150_000))) throw new Error('member B widening-probe read never completed')
    await waitSettled(ids.b, 'member B after widening read')

    const settleOf = (instanceId, callId) => {
      const executionId = dispatchExecutionId({ rootSessionId: BOOT_ROOT, agentInstanceId: instanceId }, callId)
      const file = join(paths.centre, 'settlement', instanceId, `${executionId}.settlement.json`)
      let record = null
      try {
        const envelope = JSON.parse(readFileSync(file, 'utf8'))
        // The store persists a CHECKSUMMED ENVELOPE; the record is its payload.
        record = envelope?.payload ?? envelope
      } catch { record = null }
      return record === null ? null : {
        file,
        state: record.state,
        dispatch: record.observation?.dispatch ?? null,
        bodyOutcome: record.observation?.bodyOutcome ?? null,
        stops: record.stops ?? [],
        transitions: (record.transitions ?? []).map((t) => t.to),
      }
    }
    // ── ROUND 83: THE MANAGEMENT PLANE DELIVERS; THE MEMBER EXECUTES ────────
    // The delivery law measured on the LIVE row, over the product's own S6 API:
    //   · `member.send` returns the messaging coordinator's ACKNOWLEDGEMENT (the
    //     durable intent + confirmation of INBOX ACCEPTANCE) — not a tool result,
    //     and the request itself performs NO tool execution;
    //   · the delivered prompt then makes Member B run its OWN turn, and the
    //     centre's admission `allow` for that `read` appears in B's OWN fact
    //     ledger, under B's binding, written by the centre — not by the plane.
    // Error paths (same live row): unknown member, duplicate delivery, an
    // ARCHIVED member, and the product's Stop during a DELIVERED turn.
    abortStage = 'remote-delivery'
    await waitSettled(ids.b, 'member B before the remote delivery')
    const ledgerBPath = join(paths.centre, `${ids.b}.facts.jsonl`)
    const ledgerAPath = join(paths.centre, `${ids.a}.facts.jsonl`)
    const deliveryOf = (ledgerPath, callId) => {
      const rows = parseJsonl(ledgerPath)
      return {
        rows,
        admissions: rows.filter((r) => r?.kind === 'invocation-authority' && String(r?.callId) === callId),
        executions: rows.filter((r) => r?.kind === 'execution' && String(r?.callId) === callId),
      }
    }
    const beforeDelivery = {
      requests: requests().length,
      centreB: parseJsonl(ledgerBPath).length,
      transcriptCalls: (readMemberTranscript(world.home, rowB.childSessionId)?.calls ?? []).length,
    }
    const DELIVERY_TOKEN = 'dboot-d2-remote-send'
    const DELIVERY_BODY = `${TOK_RD}: read the file \`${paths.bInLane}\`, one tool call, then report the first line briefly.`
    const deliveryRequestedAt = new Date().toISOString()
    const deliveryResponse = await remoteCall(fetchJson, origin, cookie, 'member.send', {
      teamSessionId: BOOT_ROOT,
      caller: { kind: 'human', humanId: BOOT_ROOT },
      recipientInstanceId: ids.b,
      body: DELIVERY_BODY,
      requestToken: DELIVERY_TOKEN,
    }, 'd2rd')
    const deliveryAckedAt = new Date().toISOString()
    const deliveryEnvelope = deliveryResponse.body?.result ?? null
    const deliveryOutcome = deliveryEnvelope?.value?.data?.outcome ?? null
    const atAck = {
      status: deliveryResponse.status,
      ok: deliveryEnvelope?.ok === true,
      code: deliveryEnvelope?.error?.code ?? null,
      // ROUND 109 — the full typed `member.send` reply (the accepted leg).
      requestToken: DELIVERY_TOKEN,
      reply: observedReply(deliveryResponse),
      outcome: deliveryOutcome,
      centreB: parseJsonl(ledgerBPath).length,
      requests: requests().length,
      ...deliveryOf(ledgerBPath, CALL_RD),
    }
    log(`[boot${String(index)}] member.send ack: status=${String(atAck.status)} ok=${String(atAck.ok)} code=${String(atAck.code)} deliveredSeq=${String(deliveryOutcome?.deliveredSequence)} facts=${String(atAck.centreB)} admissions=${String(atAck.admissions.length)} executions=${String(atAck.executions.length)}`)

    // The MEMBER's own turn runs the delivered prompt (a bounded wait on the
    // MEMBER's own reply — never on the delivery request).
    const memberRan = await waitFor(() => sawReply(DONE_MEMBER_RD), 150_000)
    if (!memberRan) {
      collectDiagnostics('remote-delivery')
      throw new Error('the delivered prompt never produced a Member turn (no read/reply)')
    }
    await waitSettled(ids.b, 'member B after the remote delivery')
    const deliveryTranscript = readMemberTranscript(world.home, rowB.childSessionId)
    const deliveryCall = deliveryTranscript?.calls.find((c) => String(c.callId) === CALL_RD) ?? null
    const afterDelivery = {
      requests: requests().length,
      centreB: parseJsonl(ledgerBPath).length,
      transcriptCalls: deliveryTranscript?.calls.length ?? 0,
      ...deliveryOf(ledgerBPath, CALL_RD),
      settlement: settleOf(ids.b, CALL_RD),
      memberRequests: requests().filter((r) => memberTokenOf(r) === TOK_RD).length,
      memberResult: deliveryCall?.result ?? null,
    }

    // (a) UNKNOWN member: a typed answer, no execution, no ghost turn.
    const requestsBeforeUnknown = requests().length
    const unknownResponse = await remoteCall(fetchJson, origin, cookie, 'member.send', {
      teamSessionId: BOOT_ROOT,
      caller: { kind: 'human', humanId: BOOT_ROOT },
      recipientInstanceId: 'inst-dboot-d2-does-not-exist',
      body: 'read the file, one tool call',
      requestToken: 'dboot-d2-remote-send-unknown',
    }, 'd2rd')
    const unknownMember = {
      status: unknownResponse.status,
      ok: unknownResponse.body?.result?.ok === true,
      code: unknownResponse.body?.result?.error?.code ?? null,
      requestsAdded: requests().length - requestsBeforeUnknown,
    }
    log(`[boot${String(index)}] member.send unknown member: ok=${String(unknownMember.ok)} code=${String(unknownMember.code)} requestsAdded=${String(unknownMember.requestsAdded)}`)

    // (b) DUPLICATE delivery: the SAME requestToken again is the facade's REPLAY
    //     (same durable sequences), not a second intent and not a second turn.
    const requestsBeforeDuplicate = requests().length
    const duplicateResponse = await remoteCall(fetchJson, origin, cookie, 'member.send', {
      teamSessionId: BOOT_ROOT,
      caller: { kind: 'human', humanId: BOOT_ROOT },
      recipientInstanceId: ids.b,
      body: DELIVERY_BODY,
      requestToken: DELIVERY_TOKEN,
    }, 'd2rd')
    const duplicateOutcome = duplicateResponse.body?.result?.value?.data?.outcome ?? null
    const duplicateDelivery = {
      status: duplicateResponse.status,
      ok: duplicateResponse.body?.result?.ok === true,
      code: duplicateResponse.body?.result?.error?.code ?? null,
      outcome: duplicateOutcome,
      sameIntent: duplicateOutcome?.factSequence === deliveryOutcome?.factSequence,
      sameConfirmation: duplicateOutcome?.deliveredSequence === deliveryOutcome?.deliveredSequence,
      // MEASURED CONTRACT: `send-message` coordination is AT-LEAST-ONCE per
      // request, not de-duplicated by token — a second send of the same text is
      // a second durable coordination (new intent + confirmation sequences and a
      // second input acceptance). What MUST never happen is an EXECUTION on the
      // operator's behalf; the member's own turn executes (or not) under its own
      // binding, so this is recorded, not asserted as a replay.
      distinctFromFirst: duplicateOutcome?.factSequence !== deliveryOutcome?.factSequence && duplicateOutcome?.deliveredSequence !== deliveryOutcome?.deliveredSequence,
      requestsAdded: requests().length - requestsBeforeDuplicate,
    }
    log(`[boot${String(index)}] member.send duplicate: ok=${String(duplicateDelivery.ok)} distinct=${String(duplicateDelivery.distinctFromFirst)} requestsAdded=${String(duplicateDelivery.requestsAdded)}`)
    // The duplicate delivered the SAME text again, so Member B runs a second
    // (no-tool) turn; let it settle before the lifecycle probes below.
    await waitSettled(ids.b, 'member B after the duplicate delivery')

    // (c) ARCHIVED member: `member.archive` (management, served) then a delivery
    //     — the target is not work-accepting, so the coordinator fails closed
    //     typed and NOTHING runs. `member.restore` then re-enables delivery.
    const archiveResponse = await remoteCall(fetchJson, origin, cookie, 'member.archive', {
      teamSessionId: BOOT_ROOT,
      instanceId: ids.b,
    }, 'd2rd')
    const archivedLifecycle = (await readState())?.members?.find((m) => m.instanceId === ids.b)?.lifecycle ?? null
    const requestsBeforeArchived = requests().length
    const archivedResponse = await remoteCall(fetchJson, origin, cookie, 'member.send', {
      teamSessionId: BOOT_ROOT,
      caller: { kind: 'human', humanId: BOOT_ROOT },
      recipientInstanceId: ids.b,
      body: `${TOK_RD}: read the file \`${paths.bInLane}\`, one tool call`,
      requestToken: 'dboot-d2-remote-send-archived',
    }, 'd2rd')
    const archivedDelivery = {
      archiveStatus: archiveResponse.status,
      archiveOk: archiveResponse.body?.result?.ok === true,
      // ROUND 108 — THE ARCHIVE REPLY IS ITS OWN TYPED CHANNEL. When the
      // management `member.archive` is itself refused, the refusal lives in
      // this reply (`result.error.code`/`message`), NOT in the subsequent
      // `member.send`: the send then sees an un-archived (SETTLED) member and
      // is lawfully accepted. Recording the archive reply's typed code keeps
      // "why the member is not ARCHIVED" observable instead of discarding it.
      archiveCode: archiveResponse.body?.result?.error?.code ?? null,
      archiveMessage: archiveResponse.body?.result?.error?.message ?? null,
      // ROUND 109 — the COMPLETE typed `member.archive` reply: the answered
      // rpcId, `result.ok`, the verbatim `result.error` object (every field,
      // not just code/message) and the full `result.value`. Observation only.
      archiveReply: observedReply(archiveResponse),
      lifecycle: archivedLifecycle,
      archiveLifecycle: archivedLifecycle,
      status: archivedResponse.status,
      ok: archivedResponse.body?.result?.ok === true,
      code: archivedResponse.body?.result?.error?.code ?? null,
      // ROUND 109 — the complete typed `member.send` reply to the archived
      // target (the refusal channel the clause grades).
      archivedSendToken: 'dboot-d2-remote-send-archived',
      sendReply: observedReply(archivedResponse),
      requestsAdded: requests().length - requestsBeforeArchived,
      executionsAfter: deliveryOf(ledgerBPath, CALL_RD).executions.length,
    }
    log(`[boot${String(index)}] member.send archived: archiveOk=${String(archivedDelivery.archiveOk)} archiveCode=${String(archivedDelivery.archiveCode)} archiveMessage=${String(archivedDelivery.archiveMessage)} lifecycle=${String(archivedDelivery.lifecycle)} ok=${String(archivedDelivery.ok)} code=${String(archivedDelivery.code)} requestsAdded=${String(archivedDelivery.requestsAdded)}`)
    log(`[boot${String(index)}] member.archive FULL reply: ${JSON.stringify(archivedDelivery.archiveReply)}`)
    log(`[boot${String(index)}] member.send(archived) FULL reply: ${JSON.stringify(archivedDelivery.sendReply)}`)
    const restoreResponse = await remoteCall(fetchJson, origin, cookie, 'member.restore', {
      teamSessionId: BOOT_ROOT,
      instanceId: ids.b,
    }, 'd2rd')
    const restoredLifecycle = (await readState())?.members?.find((m) => m.instanceId === ids.b)?.lifecycle ?? null
    const restoredResponse = await remoteCall(fetchJson, origin, cookie, 'member.send', {
      teamSessionId: BOOT_ROOT,
      caller: { kind: 'human', humanId: BOOT_ROOT },
      recipientInstanceId: ids.b,
      body: `${TOK_RD}: one more delivery after the restore`,
      requestToken: 'dboot-d2-remote-send-restored',
    }, 'd2rd')
    const restoredDelivery = {
      restoreStatus: restoreResponse.status,
      restoreOk: restoreResponse.body?.result?.ok === true,
      restoreCode: restoreResponse.body?.result?.error?.code ?? null,
      restoreMessage: restoreResponse.body?.result?.error?.message ?? null,
      // ROUND 109 — the complete typed `member.restore` reply, and the complete
      // typed `member.send` reply that follows it (the re-enabled leg).
      restoreReply: observedReply(restoreResponse),
      lifecycle: restoredLifecycle,
      status: restoredResponse.status,
      ok: restoredResponse.body?.result?.ok === true,
      code: restoredResponse.body?.result?.error?.code ?? null,
      restoredSendToken: 'dboot-d2-remote-send-restored',
      sendReply: observedReply(restoredResponse),
    }
    log(`[boot${String(index)}] member.send restored: lifecycle=${String(restoredDelivery.lifecycle)} ok=${String(restoredDelivery.ok)} code=${String(restoredDelivery.code)}`)
    log(`[boot${String(index)}] member.restore FULL reply: ${JSON.stringify(restoredDelivery.restoreReply)}`)
    log(`[boot${String(index)}] member.send(restored) FULL reply: ${JSON.stringify(restoredDelivery.sendReply)}`)

    // (d) STOP DURING A DELIVERED TURN: the delivery is acknowledged, the
    //     delivered turn parks on the ask lane, the product's Stop closes that
    //     wait as ADMISSION_STOPPED and the settlement is REFUSED/not-started.
    await waitSettled(ids.b, 'member B before the delivered stop probe')
    // Member A is NOT awaited for SETTLED here: its first turn was STOPPED
    // mid-call (round 83 measures that above), so its lifecycle is RUNNING and
    // the delivery must still be accepted and then stopped again.
    const requestsBeforeStop = requests().length
    const stopDeliveryResponse = await remoteCall(fetchJson, origin, cookie, 'member.send', {
      teamSessionId: BOOT_ROOT,
      caller: { kind: 'human', humanId: BOOT_ROOT },
      recipientInstanceId: ids.a,
      body: `${TOK_RD_STOP}: read the file \`${paths.ask}\`, one tool call, then report briefly.`,
      requestToken: 'dboot-d2-remote-send-stop',
    }, 'd2rd')
    const stopAck = {
      status: stopDeliveryResponse.status,
      ok: stopDeliveryResponse.body?.result?.ok === true,
      code: stopDeliveryResponse.body?.result?.error?.code ?? null,
      requestsAdded: requests().length - requestsBeforeStop,
    }
    const stopPendingOk = await waitFor(async () => {
      const st = await readState()
      return (st?.control?.requests ?? []).some((r) => String(r.targetInstanceId) === ids.a && String(r.status) === 'pending')
    }, 120_000, 200)
    const stopDeliveryCancel = await apiSessionCancel(origin, cookie, rowA.childSessionId, 'dbootd2rdstop')
    const stopDeliveredLanded = await waitFor(async () => {
      const tx = readMemberTranscript(world.home, rowA.childSessionId)
      const call = tx?.calls.find((c) => String(c.callId) === CALL_RD_STOP)
      return call !== undefined && call !== null && call.result !== null && call.result !== undefined
    }, 60_000, 200)
    const stopDelivered = {
      ack: stopAck,
      pending: stopPendingOk,
      cancelStatus: stopDeliveryCancel.status,
      landed: stopDeliveredLanded,
      fact: deliveryOf(ledgerAPath, CALL_RD_STOP).admissions[0] ?? null,
      executions: deliveryOf(ledgerAPath, CALL_RD_STOP).executions,
      settlement: settleOf(ids.a, CALL_RD_STOP),
      call: readMemberTranscript(world.home, rowA.childSessionId)?.calls.find((c) => String(c.callId) === CALL_RD_STOP) ?? null,
    }
    log(`[boot${String(index)}] delivered-stop: ackOk=${String(stopAck.ok)} pending=${String(stopPendingOk)} landed=${String(stopDeliveredLanded)} state=${String(stopDelivered.settlement?.state)} refusal=${String(stopDelivered.fact?.refusalCode)}`)

    const remoteDelivery = {
      at: new Date().toISOString(),
      root: BOOT_ROOT,
      target: ids.b,
      operator: { kind: 'human', humanId: BOOT_ROOT },
      requestToken: DELIVERY_TOKEN,
      requestedAt: deliveryRequestedAt,
      ackedAt: deliveryAckedAt,
      before: beforeDelivery,
      atAck: { status: atAck.status, ok: atAck.ok, code: atAck.code, outcome: atAck.outcome, centreB: atAck.centreB, requests: atAck.requests, admissions: atAck.admissions.length, executions: atAck.executions.length },
      after: { requests: afterDelivery.requests, centreB: afterDelivery.centreB, transcriptCalls: afterDelivery.transcriptCalls, admissions: afterDelivery.admissions, executions: afterDelivery.executions, settlement: afterDelivery.settlement, memberRequests: afterDelivery.memberRequests, memberResult: afterDelivery.memberResult },
      unknownMember,
      duplicate: duplicateDelivery,
      archived: { ...archivedDelivery, restoreStatus: restoreResponse.status, restoreOk: restoreResponse.body?.result?.ok === true, restoredLifecycle },
      restored: restoredDelivery,
      stop: stopDelivered,
    }
    writeFileSync(join(bootDir, 'remote-delivery.json'), JSON.stringify(remoteDelivery, null, 2) + '\n')

    // ── evidence collection (before teardown deletes the World home) ────────
    abortStage = 'evidence-collection'
    const allRequests = requests()
    const callOfReq = (id) => toolCallFor(allRequests, id)
    const resultOfReq = (id) => toolResultFor(allRequests, id)
    const transcriptA = readMemberTranscript(world.home, rowA.childSessionId)
    const transcriptB = readMemberTranscript(world.home, rowB.childSessionId)
    for (const [label, tx] of [['a', transcriptA], ['b', transcriptB]]) {
      if (tx !== null) {
        writeFileSync(join(bootDir, `member-${label}-transcript.json`), JSON.stringify(tx, null, 2) + '\n')
        try { writeFileSync(join(bootDir, `member-${label}-session.v4.jsonl.zstd`), readFileSync(tx.file)) } catch { /* normalised copy remains */ }
        writeFileSync(join(bootDir, `member-${label}-transcript.txt`), renderTranscript(tx) + '\n')
      }
    }
    const factsAll = parseJsonl(paths.sink).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const facts = factsAll
    writeFileSync(join(bootDir, 'guard-facts.json'), JSON.stringify(factsAll, null, 2) + '\n')
    const ledgerA = join(paths.centre, `${ids.a}.facts.jsonl`)
    const ledgerB = join(paths.centre, `${ids.b}.facts.jsonl`)
    const centreA = parseJsonl(ledgerA)
    const centreB = parseJsonl(ledgerB)
    writeFileSync(join(bootDir, 'centre-facts-a.json'), JSON.stringify(centreA, null, 2) + '\n')
    writeFileSync(join(bootDir, 'centre-facts-b.json'), JSON.stringify(centreB, null, 2) + '\n')

    const settlement = {
      ask: settleOf(ids.a, CALL_A_ASK),
      bAfter: settleOf(ids.b, CALL_B_AFTER),
      bPre: settleOf(ids.b, CALL_B_PRE),
      bMid: settleOf(ids.b, CALL_B_MID),
      bPost: settleOf(ids.b, CALL_B_POST),
      bPreInLane: settleOf(ids.b, CALL_B_PRE_INLANE),
      bMidInLane: settleOf(ids.b, CALL_B_MID_INLANE),
      bPostInLane: settleOf(ids.b, CALL_B_POST_INLANE),
      bWiden: settleOf(ids.b, CALL_B_WIDEN),
      // ROUND 83 — the DELIVERED turn's call (B) and the STOPPED delivered call (A).
      delivery: settleOf(ids.b, CALL_RD),
      deliveryStop: settleOf(ids.a, CALL_RD_STOP),
    }
    writeFileSync(join(bootDir, 'settlement.json'), JSON.stringify(settlement, null, 2) + '\n')

    const calls = {
      a: { own: { call: callOf(transcriptA, CALL_A_OWN), result: callOf(transcriptA, CALL_A_OWN)?.result ?? null }, cross: { call: callOf(transcriptA, CALL_A_CROSS), result: callOf(transcriptA, CALL_A_CROSS)?.result ?? null } },
      b: {
        own: { call: callOf(transcriptB, CALL_B_OWN), result: callOf(transcriptB, CALL_B_OWN)?.result ?? null },
        after: { call: callOf(transcriptB, CALL_B_AFTER), result: callOf(transcriptB, CALL_B_AFTER)?.result ?? null },
      },
      mutation: {
        lifecycleBefore: bLifecycleBefore,
        pre: { call: callOf(transcriptB, CALL_B_PRE), result: callOf(transcriptB, CALL_B_PRE)?.result ?? null },
        mid: { call: callOf(transcriptB, CALL_B_MID), result: callOf(transcriptB, CALL_B_MID)?.result ?? null },
        post: { call: callOf(transcriptB, CALL_B_POST), result: callOf(transcriptB, CALL_B_POST)?.result ?? null },
        preInLane: { call: callOf(transcriptB, CALL_B_PRE_INLANE), result: callOf(transcriptB, CALL_B_PRE_INLANE)?.result ?? null },
        midInLane: { call: callOf(transcriptB, CALL_B_MID_INLANE), result: callOf(transcriptB, CALL_B_MID_INLANE)?.result ?? null },
        postInLane: { call: callOf(transcriptB, CALL_B_POST_INLANE), result: callOf(transcriptB, CALL_B_POST_INLANE)?.result ?? null },
        grant: { call: callOfReq(CALL_GRANT), result: resultOfReq(CALL_GRANT) ?? null },
        revoke: { call: callOfReq(CALL_REVOKE), result: resultOfReq(CALL_REVOKE) ?? null },
      },
      widening: {
        grant: { call: callOfReq(CALL_GRANT_WIDEN), result: resultOfReq(CALL_GRANT_WIDEN) ?? null },
        read: { call: callOf(transcriptB, CALL_B_WIDEN), result: callOf(transcriptB, CALL_B_WIDEN)?.result ?? null },
      },
    }
    writeFileSync(join(bootDir, 'probes.json'), JSON.stringify(calls, null, 2) + '\n')

    const a = {
      instance: ids.a,
      childSessionId: rowA.childSessionId,
      ledgerPath: ledgerA,
      ledger: centreA,
      transcript: transcriptA,
      window: aWindow,
      own: calls.a.own,
      cross: calls.a.cross,
    }
    const b = {
      instance: ids.b,
      childSessionId: rowB.childSessionId,
      ledgerPath: ledgerB,
      ledger: centreB,
      transcript: transcriptB,
      window: bWindow,
      own: calls.b.own,
      after: calls.b.after,
    }

    counters.aGuardFacts = facts.filter((f) => String(f.memberIdentity) === ids.a).length
    counters.bGuardFacts = facts.filter((f) => String(f.memberIdentity) === ids.b).length
    counters.aAdmissions = centreA.filter((r) => r?.kind === 'invocation-authority').length
    counters.bAdmissions = centreB.filter((r) => r?.kind === 'invocation-authority').length
    counters.remoteDelivery = {
      acked: remoteDelivery.atAck.ok === true,
      outcome: remoteDelivery.atAck.outcome?.status ?? null,
      atAckAdmissions: remoteDelivery.atAck.admissions,
      atAckExecutions: remoteDelivery.atAck.executions,
      memberAdmissions: remoteDelivery.after.admissions.length,
      memberExecutions: remoteDelivery.after.executions.length,
      memberProviderRequests: remoteDelivery.after.memberRequests,
      unknownMemberCode: remoteDelivery.unknownMember.code,
      duplicateSameConfirmation: remoteDelivery.duplicate.sameConfirmation,
      archivedCode: remoteDelivery.archived.code,
      stoppedRefusalCode: remoteDelivery.stop.fact?.refusalCode ?? null,
    }
    counters.mockRequests = allRequests.length
    counters.memberModelRequests = allRequests.filter((r) => isMemberRequest(r) && surfaceNamesOf(r).length > 0).length
    counters.aWindow = aWindow
    counters.bWindow = bWindow
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')

    // ── judges ─────────────────────────────────────────────────────────────
    const verdicts = {
      multiMember: judgeMultiMember({ a, b, facts, paths }),
      revocation: judgeRevocation({ b, paths, mutation: calls.mutation, widening: calls.widening, settlement }),
      stop: judgeStop({ a, b, paths, control: { pending: pendingRequest, cancelStatus: cancel.status, stopAt }, settlement }),
      remoteDelivery: judgeRemoteDelivery({ b, paths, delivery: remoteDelivery }),
    }
    // NOTE: `detail` must NOT carry a `verdict` key — the record spreads it
    // AFTER the passed verdict and would silently overwrite it.
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}${verdict === 'PROVEN' ? '' : ` failed=${JSON.stringify(detail.failed)}`}`)
    }
    add('d2:multi-member-concurrency', verdicts.multiMember.verdict, verdicts.multiMember)
    add('d2:revocation', verdicts.revocation.verdict, verdicts.revocation)
    add('d2:stop', verdicts.stop.verdict, verdicts.stop)
    add('d2:remote-delivery', verdicts.remoteDelivery.verdict, verdicts.remoteDelivery)

    const final = record.finalize()
    const summary = formatSummary(final)
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), summary + '\n')
    log(`[boot${String(index)}] ${summary}`)

    result = {
      boot: index, worldId: world.id, port: bootInfo.port, hostLog: bootInfo.logPath,
      runId, summary, overall: final.overall,
      a: { instance: a.instance, childSessionId: a.childSessionId, ledgerPath: a.ledgerPath, window: a.window },
      b: { instance: b.instance, childSessionId: b.childSessionId, ledgerPath: b.ledgerPath, window: b.window },
      windows: { a: aWindow, b: bWindow },
      counters,
      verdicts,
      settlement,
      remoteDelivery,
      paths,
      locus: buildLocus({ world, bootInfo, a, b, facts, centreA, centreB, paths, bootDir }),
      stopAt,
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
function buildLocus({ world, bootInfo, a, b, facts, centreA, centreB, paths, bootDir }) {
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
  return {
    composition: {
      rowConfig: 'dev/agent-workflow/evidence/d-boot-feasibility/d2/plan-patch.yml (regenerated by --plan; boot copies live in the World home)',
      shippedPreset: { file: 'cordis.patch.yml', line: lineOf(join(REPO_ROOT, 'cordis.patch.yml'), 'id: "preset-a5sf-governed-member"') },
      realmProvider: { file: 'packages/runtime/src/plugin/live/a5sf-governed-realm.mjs', line: 1 },
      memberMount: { file: 'packages/runtime/src/plugin/live/agent-bindings.mjs', line: lineOf(join(REPO_ROOT, 'packages/runtime/src/plugin/live/agent-bindings.mjs'), 'a5sfRealm = await mountMemberA5sfRealm') },
      centreInstall: { file: 'packages/runtime/src/plugin/vnext/member-execution.mjs', line: lineOf(join(REPO_ROOT, 'packages/runtime/src/plugin/vnext/member-execution.mjs'), 'installMemberCentre({') },
      nativeReadRow: { file: 'cordis.patch.yml', line: lineOf(join(REPO_ROOT, 'cordis.patch.yml'), "name: '@deepseek-ai/dsh-tool-fs'") },
      // The two product seams the new judges name.
      overlayDecision: { file: 'packages/runtime/src/plugin/vnext/overlay-decision.mjs', line: lineOf(join(REPO_ROOT, 'packages/runtime/src/plugin/vnext/overlay-decision.mjs'), 'can REMOVE authority, never grant it') },
      // The Stop is the HOST's own signal read by the centre (no second stop mechanism).
      stopSeam: { file: 'packages/runtime/src/plugin/vnext/admission-port.mjs', line: lineOf(join(REPO_ROOT, 'packages/runtime/src/plugin/vnext/admission-port.mjs'), 'const stoppedOf = (exec) =>') },
      stopPath: { file: 'packages/client/src/model/member-stop.ts', line: lineOf(join(REPO_ROOT, 'packages/client/src/model/member-stop.ts'), 'session/cancel') },
    },
    members: {
      a: { instance: a?.instance ?? null, sessionId: a?.childSessionId ?? null, transcriptCopy: join(bootDir, 'member-a-transcript.txt'), ledger: join(bootDir, 'centre-facts-a.json'), admissions: centreA?.filter((r) => r?.kind === 'invocation-authority').length ?? null, executions: centreA?.filter((r) => r?.kind === 'execution').length ?? null },
      b: { instance: b?.instance ?? null, sessionId: b?.childSessionId ?? null, transcriptCopy: join(bootDir, 'member-b-transcript.txt'), ledger: join(bootDir, 'centre-facts-b.json'), admissions: centreB?.filter((r) => r?.kind === 'invocation-authority').length ?? null, executions: centreB?.filter((r) => r?.kind === 'execution').length ?? null },
    },
    guardSink: { file: join(bootDir, 'guard-facts.json'), source: paths.sink, allowLine: sinkLines.allow, denyLine: sinkLines.deny, facts: facts.length },
    host: { log: bootInfo?.logPath ?? null, worldId: world?.id ?? null, port: bootInfo?.port ?? null },
    counts: { file: join(bootDir, 'counters.json') },
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
    candidate: { head, hostSha: HOST_PIN.sha, baseline: HOST_PIN.sha },
    grant: { grantId: grant.grantId, scope: 'DEV-LIVE', face: grant.face, world: grant.world },
    recordClass: 'DEV-LIVE',
    compositionDrops: COMPOSITION_DROPS,
    layout: process.env.DBOOT_WITHOUT_CENTRE === '1' ? 'no-centre (diagnostic arm)' : 'centre',
    installGraph: process.env.A5SF_WF_NO_INSTALL_GRAPH === '1' ? 'skipped (negative control A5SF_WF_NO_INSTALL_GRAPH=1)' : 'provisioned',
    teamSha: head,
    hostSha: HOST_PIN.sha,
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
    at: startedAt, head, hostTree: HOST_TREE, hostSha: hostDigest(), pin: HOST_PIN.sha,
    driverSha256: sha256(fileURLToPath(import.meta.url)), jsSubstitutions: layer.jsSubstitutions,
    command: `node tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
  }, null, 2) + '\n')
  log(`START head=${head} hostTree=${HOST_TREE} pin=${HOST_PIN.sha} boots=${String(BOOTS_WANTED)}`)
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
    multiMemberVerdict: r?.verdicts?.multiMember?.verdict ?? null,
    revocationVerdict: r?.verdicts?.revocation?.verdict ?? null,
    stopVerdict: r?.verdicts?.stop?.verdict ?? null,
    remoteDeliveryVerdict: r?.verdicts?.remoteDelivery?.verdict ?? null,
    aAdmissions: r?.counters?.aAdmissions ?? null,
    bAdmissions: r?.counters?.bAdmissions ?? null,
    aGuardFacts: r?.counters?.aGuardFacts ?? null,
    bGuardFacts: r?.counters?.bGuardFacts ?? null,
    windowsOverlap: r?.verdicts?.multiMember?.clauses?.find((c) => c.id === 'concurrent-overlap')?.ok ?? null,
    crossRefused: r?.verdicts?.multiMember?.clauses?.find((c) => c.id === 'cross-lane-refused')?.ok ?? null,
    stopSettlementState: r?.settlement?.ask?.state ?? null,
    revocationDenyRefused: r?.verdicts?.revocation?.clauses?.find((c) => c.id === 'a-overlay-refuses-previously-admitted')?.ok ?? null,
    revocationRestored: r?.verdicts?.revocation?.clauses?.find((c) => c.id === 'b-call-restored-admitted')?.ok ?? null,
    revocationWideningNotMinted: r?.verdicts?.revocation?.clauses?.find((c) => c.id === 'd-widening-not-minted')?.ok ?? null,
    bAfterStopCompleted: r?.verdicts?.stop?.clauses?.find((c) => c.id === 'second-member-unaffected')?.ok ?? null,
    deliveryAckIsNotAnExecution: r?.verdicts?.remoteDelivery?.clauses?.find((c) => c.id === 'request-executed-nothing')?.ok ?? null,
    deliveredTurnAdmittedUnderMemberBinding: r?.verdicts?.remoteDelivery?.clauses?.find((c) => c.id === 'member-admission-under-member-binding')?.ok ?? null,
    memberAdmissionFacts: r?.counters?.remoteDelivery?.memberAdmissions ?? null,
  })
  const rows = ok.map((r) => ({ boot: r.boot, ...pick(r) }))
  const keys = [
    'overall', 'multiMemberVerdict', 'revocationVerdict', 'stopVerdict', 'remoteDeliveryVerdict',
    'aAdmissions', 'bAdmissions', 'aGuardFacts', 'bGuardFacts',
    'windowsOverlap', 'crossRefused', 'stopSettlementState',
    'revocationDenyRefused', 'revocationRestored', 'revocationWideningNotMinted',
    'bAfterStopCompleted', 'deliveryAckIsNotAnExecution', 'deliveredTurnAdmittedUnderMemberBinding',
    'memberAdmissionFacts',
  ]
  // Agreement is about the MEASURED facts being reproduced. The widening ANSWER
  // shape is recorded per boot, not compared, because a typed code is allowed to
  // differ in wording while the effect clause must still hold.
  const differing = keys.filter((k) => new Set(rows.map((r) => JSON.stringify(r[k]))).size > 1)
  const agreeing = rows.length >= 2 && differing.length === 0
  const header = ['fact', ...rows.map((r) => `boot${String(r.boot)}`)]
  const body = keys.map((k) => [k, ...rows.map((r) => String(r[k]))])
  const width = Math.max(34, ...header.map((h) => h.length), ...keys.map((k) => k.length)) + 2
  const cell = (v) => String(v).padEnd(width)
  const table = [
    'TWO-RUN AGREEMENT (the same command, two boots; every measured row must be identical)',
    header.map(cell).join('').replace(/ +$/u, ''),
    ...body.map(([k, ...vals]) => `${cell(k)}${vals.map(cell).join('')}`.replace(/ +$/u, '')),
    '',
    `agreeing=${String(agreeing)} differing=${JSON.stringify(differing)}`,
  ].join('\n')
  return { schema: 'dboot-d2/agreement/1', at: new Date().toISOString(), boots: results.length, agreeing, differing, rows, table }
}

main().catch((error) => {
  log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
