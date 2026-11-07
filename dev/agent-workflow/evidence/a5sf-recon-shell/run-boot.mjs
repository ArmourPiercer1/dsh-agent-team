#!/usr/bin/env node
/**
 * dev/agent-workflow/evidence/a5sf-recon-shell/run-boot.mjs — RECON-SHELL:
 * Alpha.5 five-face DEV-LIVE reconnaissance, FACE C (Shell / PTY / managed Job
 * lifecycle), on the SHIPPED governed Member preset. Driver only.
 *
 * THIS IS RECONNAISSANCE, NOT ACCEPTANCE. It changes no product source, no
 * matrix/register/STATUS row and no V@B cell. Every start is `DEV-LIVE`
 * (`candidateClaimEligibility.eligible: false` by construction). The parent
 * agent re-runs its own boot before any PR merges; this driver's output is a
 * map of what exists and where it executes, not merge evidence.
 *
 * WHAT IT MEASURES, in ONE boot (three Members, one Leader chain):
 *   Member A (sync delegate), command-scoped `bash` cases:
 *     1. admitted read (in-ceiling) — the confined terminal face returns bytes;
 *     2. denied read (out-of-ceiling) — typed IO_READ_DENIED, zero bytes;
 *     3. denied WRITE (out-of-ceiling redirect) — attribution position measured
 *        (the read axis does not inspect redirect targets; the OS profile is
 *        asked instead);
 *     4. dynamic read via a `$VAR` path — admission position measured;
 *     5. dynamic read via `$(...)` — admission position measured;
 *     6. `bash` with `run_in_background:true` — is a managed job producible?
 *     7. `job_list` — do the job-control tools exist with no producer?
 *   Then the Leader ARCHIVES Member A and attempts `team_follow_up` on it
 *   (revocation: can the revoked instance take new work / get a terminal?).
 *   Member B (async delegate) runs a long first command so the Leader can
 *   archive it MID-FLIGHT (does the shell child stop? can it run a second
 *   command after revocation?).
 *   Member C (sync delegate, NEW generation) runs one admitted read — the
 *   contrast arm: a new generation can still acquire a confined terminal.
 *
 * PROCESS-LEVEL EVIDENCE (independent of the product's own counters):
 * `/proc/<pid>/cmdline`, `/proc/<pid>/stat` state/ppid, `/proc/<pid>/fd/{0,1,2}`
 * targets, `/proc/<pid>/ns/mnt`, `/proc/<pid>/mountinfo`, `/proc/<pid>/status`
 * NSpid. The legacy PTY signature (a live bash whose fd0 is `/dev/pts/N` and
 * whose `tty` is a pts) is what must be ABSENT for a confined child; the child
 * body also reports its own `tty` and `ps` state from INSIDE.
 *
 * WHAT IS FIXTURE: the model is the shared scripted mock; the /proc watcher and
 * the mock request log are test instrumentation. The preset row, realm
 * provider, compiler, guard, confined terminal face and confined process
 * provider are the shipped modules the Host loads from `packages/runtime/dist`.
 *
 * CORE PATCH BUDGET = 0.
 *
 * @module dev/agent-workflow/evidence/a5sf-recon-shell/run-boot
 */

import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, readlinkSync, renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

import {
  apiPrompt, authenticate, emitPatchLayer, fetchJson,
} from '../../../../tests/world-factory/lib/world-factory.mjs'
import { createRunRecord, formatSummary, readAuthorityBinding } from '../../../../tests/world-factory/lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../../tests/paths.mjs'
import { createA5sfHarness } from '../../../../tests/world-factory/lib/a5sf-harness.mjs'
import { preRegisterDevLiveBudget, resolveHeadCommit } from '../../../../tests/world-factory/suites/150-a5sf-read.mjs'
import {
  lastUserTextOfStatic, messagesOf, remoteCall, surfaceNamesOf, textOf,
} from '../../../../tests/world-factory/lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = HERE
const RUNS = join(EVIDENCE, 'runs')
const ARCHIVE = join(EVIDENCE, 'archive')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')
const GRANT_PATH = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'dev-live-grant.json')

const LINE = 'u5a5sfsub1'
const BOOT_ROOT = 'session-a5sf-rc-boot'
const ACCEPTANCE_ROOT = 'session-a5sf-rc-team'
const BP_ANCHOR_ID = 'team.a5sf.rc.anchor'
const BP_MAIN_ID = 'team.a5sf.rc.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'A5SF_RC_DISC'
const MK_L1 = 'A5SF_RC_L1_DRIVE'
const TOK_A = 'a5sf-rc-a'
const TOK_B = 'a5sf-rc-b'
const TOK_C = 'a5sf-rc-c'
const TOK_X = 'a5sf-rc-x'

const CALL = Object.freeze({
  DELEGATE_A: 'call-rc-delegate-a',
  ARCHIVE_A: 'call-rc-archive-a',
  FOLLOWUP_A: 'call-rc-followup-a',
  DELEGATE_B: 'call-rc-delegate-b',
  ARCHIVE_B: 'call-rc-archive-b',
  DELEGATE_C: 'call-rc-delegate-c',
  A_ALLOW: 'call-rc-a-allow',
  A_DENY_READ: 'call-rc-a-deny-read',
  A_DENY_WRITE: 'call-rc-a-deny-write',
  A_DYN_VAR: 'call-rc-a-dyn-var',
  A_DYN_SUBST: 'call-rc-a-dyn-subst',
  A_BG: 'call-rc-a-bg',
  A_JOBLIST: 'call-rc-a-joblist',
  B_LONG: 'call-rc-b-long',
  B_SECOND: 'call-rc-b-second',
  C_ONE: 'call-rc-c-one',
  X_ONE: 'call-rc-x-one',
})

const DONE_A = 'A5SF_RC_MEMBER_A_DONE'
const DONE_B = 'A5SF_RC_MEMBER_B_DONE'
const DONE_C = 'A5SF_RC_MEMBER_C_DONE'
const DONE_X = 'A5SF_RC_MEMBER_X_DONE'
const DONE_L1 = 'A5SF_RC_LEADER_DONE'
const BG_TEXT = 'A5SF_RC_BG_MARK'
const WRITE_TEXT = 'A5SF_RC_WRITE_MARK'
const DYN_VAR_TEXT = 'A5SF_RC_DYN_VAR'
const DYN_SUBST_TEXT = 'A5SF_RC_DYN_SUBST'
const IN_LANE_TEXT = 'A5SF_RECON_SHELL_IN_LANE_BYTES'
const SECRET_TEXT = 'A5SF_RECON_SHELL_OUT_OF_LANE_SECRET'
const IN_LANE_FILE = 'in-lane.txt'
const SECRET_FILE = 'secret-out-of-lane.txt'
const WRITE_FILE = 'rc-write.txt'

const SELECTED_CASES = Object.freeze([
  'rc:bash-admitted-read',
  'rc:bash-denied-read',
  'rc:bash-denied-write',
  'rc:bash-dynamic-read',
  'rc:surface-shell-and-jobs',
  'rc:managed-job-absent',
  'rc:revocation-terminal',
  'rc:revoked-session-entry',
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
      persona: `You lead the a5sf live-member team. ${MK_L1} drives your chain: delegate the governed worker once, then finish.`,
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
/** The Member request is identified STRUCTURALLY: its FIRST user message is the
 *  delegated `[team-work …]` envelope carrying one of OUR per-Member tokens.
 *  The Leader's own post-delegate request also contains those tokens (inside
 *  the delegate tool RESULT JSON), so a substring test anywhere in the request
 *  would replay a Member script on the Leader — measured in the parent lane. */
function memberTokenOf(req) {
  const first = messagesOf(req).find((m) => m?.role === 'user')
  if (first === undefined) return null
  const text = typeof first.content === 'string' ? first.content : JSON.stringify(first.content ?? '')
  if (!text.includes('[team-work ')) return null
  for (const [name, token] of [['A', TOK_A], ['B', TOK_B], ['C', TOK_C]]) {
    if (text.includes(token)) return name
  }
  return null
}
function isMemberRequest(req) {
  return memberTokenOf(req) !== null
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
 * The scripted model. Member branches are selected structurally by their own
 * token; the Leader branch drives one archive/revoke arm between Members.
 */
function makeDecide({ inLanePath, secretPath, outsideWritePath, workspaceDir }) {
  const bashCall = (id, command, description, extra = {}) => ({
    kind: 'tool-call',
    toolCalls: [{ id, name: 'bash', arguments: { command, description, workdir: workspaceDir, ...extra } }],
  })
  const toolCall = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
  const resultTextOf = (req, id) => toolResultFor([req], id)?.text ?? ''
  const instanceOf = (text) => {
    try {
      const parsed = JSON.parse(text)
      const effect = parsed?.effect ?? parsed?.result?.effect ?? null
      if (typeof effect?.instanceId === 'string') return effect.instanceId
    } catch { /* not JSON */ }
    const match = String(text).match(/"instanceId"\s*:\s*"([^"]+)"/u)
    return match === null ? null : match[1]
  }
  const shellHasToken = (text, needle) => String(text).includes(needle)

  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf recon shell session' }

    // ── MEMBER X: a plain session prompt addressed at the ARCHIVED child
    // session. This is the "which entry could still reach a terminal after
    // revocation?" probe. No team-work envelope: it is the host session API.
    if (allText.includes(TOK_X)) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL.X_ONE)) {
        return bashCall(CALL.X_ONE, `printf 'A5SF_RC_X_TTY=%s\\n' "$(tty 2>&1)"; cat '${inLanePath}'`, 'Post-revocation terminal probe through the session entry')
      }
      return { kind: 'text', content: `${DONE_X} ${lastToolResultText(req).slice(0, 200)}` }
    }

    // ── MEMBER A: the command-scoped `bash` suite ──────────────────────────
    const member = memberTokenOf(req)
    if (member === 'A') {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL.A_ALLOW)) {
        // `tty`/`ps` name no path, so the read axis is not tripped by the
        // probe itself. The sleep keeps the confined child alive long enough
        // for the independent /proc observer to see it.
        return bashCall(
          CALL.A_ALLOW,
          `printf 'A5SF_RC_TTY=%s\\n' "$(tty 2>&1)"; printf 'A5SF_RC_PS=%s\\n' "$(ps -o stat= -p $$)"; printf x >/dev/null; printf 'A5SF_RC_DEVNULL_RC=%s\\n' "$?"; cat '${inLanePath}'; sleep 1.2`,
          'Admitted in-ceiling read plus the child\'s own tty/ps facts',
        )
      }
      if (!seen.has(CALL.A_DENY_READ)) {
        return bashCall(CALL.A_DENY_READ, `cat '${secretPath}'`, 'Out-of-ceiling read')
      }
      if (!seen.has(CALL.A_DENY_WRITE)) {
        // A redirect target is a WRITE, not a read intent; the read axis must
        // not consult it. The question is where the write is refused.
        return bashCall(CALL.A_DENY_WRITE, `printf ${WRITE_TEXT} > '${outsideWritePath}'; printf 'A5SF_RC_WRITE_RC=%s\\n' "$?"`, 'Out-of-ceiling write')
      }
      if (!seen.has(CALL.A_DYN_VAR)) {
        return bashCall(CALL.A_DYN_VAR, `P='${secretPath}'; cat "$P"; printf 'A5SF_RC_DYN_VAR_RC=%s\\n' "$?"`, 'Dynamic read through a shell variable')
      }
      if (!seen.has(CALL.A_DYN_SUBST)) {
        return bashCall(CALL.A_DYN_SUBST, `cat "$(printf %s '${secretPath}')"; printf 'A5SF_RC_DYN_SUBST_RC=%s\\n' "$?"`, 'Dynamic read through command substitution')
      }
      if (!seen.has(CALL.A_BG)) {
        // The governed `bash` schema is closed; this records whether the
        // background affordance survives the route-C shadow at all.
        return bashCall(CALL.A_BG, `sleep 0.1; printf '${BG_TEXT}\\n'`, 'Ask for a background job', { run_in_background: true })
      }
      if (!seen.has(CALL.A_JOBLIST)) {
        return toolCall(CALL.A_JOBLIST, 'job_list', {})
      }
      const lastTool = lastToolResultText(req)
      return { kind: 'text', content: `${DONE_A} ${lastTool.slice(0, 240)}` }
    }

    // ── MEMBER B: a long first command, archived MID-FLIGHT by the Leader ──
    if (member === 'B') {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL.B_LONG)) {
        return bashCall(
          CALL.B_LONG,
          `printf 'A5SF_RC_B_START=%s\\n' "$(date +%s)"; sleep 8; printf 'A5SF_RC_B_TTY=%s\\n' "$(tty 2>&1)"; cat '${inLanePath}'`,
          'Long admitted command (the mid-flight archive window)',
        )
      }
      if (!seen.has(CALL.B_SECOND)) {
        return bashCall(CALL.B_SECOND, `cat '${inLanePath}'`, 'Second command after a possible mid-flight archive')
      }
      return { kind: 'text', content: `${DONE_B} ${lastToolResultText(req).slice(0, 200)}` }
    }

    // ── MEMBER C: a NEW generation, after A and B were archived ────────────
    if (member === 'C') {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL.C_ONE)) {
        return bashCall(CALL.C_ONE, `printf 'A5SF_RC_C_TTY=%s\\n' "$(tty 2>&1)"; cat '${inLanePath}'`, 'New-generation admitted read')
      }
      return { kind: 'text', content: `${DONE_C} ${lastToolResultText(req).slice(0, 200)}` }
    }

    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_RC_DISC_DONE' }

    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1)
    if (isLeader) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL.DELEGATE_A)) {
        return toolCall(CALL.DELEGATE_A, 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_A}-delegate`,
          delegationTemplateId: 'worker',
          label: 'rc-worker-a',
          workspace: workspaceDir,
          prompt: `${TOK_A}: run the shell probe suite exactly once each, one tool call at a time, then report.`,
          async: false,
        })
      }
      const instanceA = instanceOf(resultTextOf(req, CALL.DELEGATE_A))
      if (!seen.has(CALL.ARCHIVE_A)) {
        return toolCall(CALL.ARCHIVE_A, 'team_archive_member', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_A}-archive`,
          targetInstanceId: instanceA ?? 'inst-unknown',
        })
      }
      if (!seen.has(CALL.FOLLOWUP_A)) {
        return toolCall(CALL.FOLLOWUP_A, 'team_follow_up', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_A}-followup`,
          targetInstanceId: instanceA ?? 'inst-unknown',
          prompt: `${TOK_A}: this follow-up must be refused after revocation.`,
          async: false,
        })
      }
      if (!seen.has(CALL.DELEGATE_B)) {
        return toolCall(CALL.DELEGATE_B, 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_B}-delegate`,
          delegationTemplateId: 'worker',
          label: 'rc-worker-b',
          workspace: workspaceDir,
          prompt: `${TOK_B}: run the long probe once, then the short probe, one tool call at a time.`,
          async: true,
        })
      }
      const instanceB = instanceOf(resultTextOf(req, CALL.DELEGATE_B))
      if (!seen.has(CALL.ARCHIVE_B)) {
        const collects = [...seen].filter((id) => id.startsWith('call-rc-collect-b-'))
        if (collects.length === 0) {
          return toolCall('call-rc-collect-b-1', 'team_collect', {
            rootSessionId: ACCEPTANCE_ROOT,
            requestToken: 'a5sf-rc-collect',
            requestTokens: [`${TOK_B}-delegate`],
          })
        }
        const lastCollect = resultTextOf(req, collects[collects.length - 1])
        const running = shellHasToken(lastCollect, 'running')
        if (!running && collects.length < 40) {
          return toolCall(`call-rc-collect-b-${String(collects.length + 1)}`, 'team_collect', {
            rootSessionId: ACCEPTANCE_ROOT,
            requestToken: 'a5sf-rc-collect',
            requestTokens: [`${TOK_B}-delegate`],
          })
        }
        return toolCall(CALL.ARCHIVE_B, 'team_archive_member', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_B}-archive`,
          targetInstanceId: instanceB ?? 'inst-unknown',
        })
      }
      if (!seen.has(CALL.DELEGATE_C)) {
        return toolCall(CALL.DELEGATE_C, 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_C}-delegate`,
          delegationTemplateId: 'worker',
          label: 'rc-worker-c',
          workspace: workspaceDir,
          prompt: `${TOK_C}: run the short probe once, then report.`,
          async: false,
        })
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_RC_NOOP' }
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

function readProcText(path) {
  try { return readFileSync(path, 'utf8') } catch { return null }
}
function readProcLink(path) {
  try { return readlinkSync(path) } catch { return null }
}

/** Per-process facts a legacy PTY cannot hide: fd targets, mount namespace,
 *  NSpid mapping, state. Read-only /proc observation, never a product counter. */
function procDetail(pid) {
  const stat = readProcStat(pid)
  const status = readProcText(`/proc/${pid}/status`) ?? ''
  const nsLine = /^NSpid:\s*(.+)$/mu.exec(status)?.[1]?.trim() ?? null
  const fds = {}
  for (const fd of [0, 1, 2]) fds[fd] = readProcLink(`/proc/${pid}/fd/${fd}`)
  const mountinfo = readProcText(`/proc/${pid}/mountinfo`) ?? ''
  const lines = mountinfo.split('\n').filter((line) => line !== '')
  return {
    state: stat?.state ?? null,
    ppid: stat?.ppid ?? null,
    nspid: nsLine,
    fds,
    fdIsPty: Object.values(fds).some((target) => typeof target === 'string' && target.startsWith('/dev/pts/')),
    mntNs: readProcLink(`/proc/${pid}/ns/mnt`),
    mountinfoCount: lines.length,
    mountinfoHasGovernedScratch: /governed-scratch/u.test(mountinfo),
    mountinfoSample: lines.slice(0, 4),
  }
}

function scanProc({ inLanePath, secretPath, outsideWritePath }) {
  const hits = []
  let pids = []
  try { pids = readdirSync('/proc').filter((n) => /^\d+$/u.test(n)) } catch { return hits }
  for (const pid of pids) {
    let cmdline = ''
    try { cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ').trim() } catch { continue }
    if (cmdline === '') continue
    const detail = procDetail(pid)
    const base = { pid: Number(pid), cmdline: cmdline.slice(0, 600), ...detail }
    const isLauncher = cmdline.includes('landlock-prelauncher.py')
    const isShellChild = /(^|\/)(bash|sh) -c /u.test(cmdline)
      && [`${inLanePath}`, `${secretPath}`, `${outsideWritePath}`, 'A5SF_RC_'].some((marker) => cmdline.includes(marker))
    const namesInLane = cmdline.includes(inLanePath)
    const namesSecret = cmdline.includes(secretPath)
    const namesWrite = cmdline.includes(outsideWritePath)
    if (isLauncher) hits.push({ marker: 'confined-launcher', ...base })
    if (isShellChild) hits.push({ marker: 'shell-child', namesInLane, namesSecret, namesWrite, ...base })
    if (detail.fdIsPty) hits.push({ marker: 'pty-holder', ...base })
    if (cmdline.includes('bwrap')) {
      hits.push({ marker: 'base-bwrap', namesInLane, namesSecret, ...base })
    }
    if (namesInLane) hits.push({ marker: 'payload-in-lane', ...base })
    if (namesSecret) hits.push({ marker: 'payload-secret', ...base })
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

function parseTerminalRecord(text) {
  try {
    const parsed = JSON.parse(text)
    return parsed !== null && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}
function textHasSecret(text) {
  return String(text ?? '').includes(SECRET_TEXT)
}
function lineValue(text, prefix) {
  const match = String(text ?? '').match(new RegExp(`${prefix}([^\\n]*)`, 'u'))
  return match === null ? null : match[1].trim()
}

function judgeAdmittedRead(sample) {
  const record = parseTerminalRecord(sample.result?.text)
  const tty = lineValue(record?.stdout, 'A5SF_RC_TTY=')
  const ps = lineValue(record?.stdout, 'A5SF_RC_PS=')
  return verdictOf(
    'the Member\'s model-visible `bash` serves an in-ceiling read on the confined terminal face (fresh confined child, not a PTY), and the child\'s own tty/ps facts agree',
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued the admitted `bash` call' },
      { id: 'result-not-error', ok: sample.result?.isError === false, detail: `isError=${String(sample.result?.isError)}` },
      { id: 'confined-terminal-kind', ok: record?.kind === 'confined-terminal', detail: `kind=${String(record?.kind)}` },
      { id: 'exit-zero', ok: record?.exitCode === 0, detail: `exitCode=${String(record?.exitCode)}` },
      { id: 'in-lane-bytes', ok: String(record?.stdout ?? '').includes(IN_LANE_TEXT), detail: 'the admitted read returned the in-lane bytes' },
      { id: 'child-tty-not-a-pty', ok: tty === 'not a tty', detail: `the CHILD'S OWN tty=${JSON.stringify(tty)}` },
      { id: 'child-not-zombie', ok: typeof ps === 'string' && ps !== '' && ps.trim().startsWith('Z') === false, detail: `the CHILD'S OWN ps state=${JSON.stringify(ps)}` },
    ],
  )
}

function judgeDeniedRead(sample) {
  const text = String(sample.result?.text ?? '')
  return verdictOf(
    'an out-of-ceiling literal read is refused at ADMISSION by the confined terminal face\'s read axis: typed IO_READ_DENIED, zero bytes, no confined child',
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued the denied read' },
      { id: 'result-is-error', ok: sample.result?.isError === true, detail: `isError=${String(sample.result?.isError)}` },
      { id: 'typed-denial', ok: text.includes('IO_READ_DENIED'), detail: 'the tool result names the typed refusal code' },
      { id: 'zero-secret-bytes', ok: textHasSecret(text) === false, detail: 'NO secret bytes reached the Member transcript' },
      { id: 'no-confined-record', ok: parseTerminalRecord(text) === null, detail: 'the refused command produced no confined-terminal execution record' },
    ],
  )
}

function judgeDeniedWrite(sample, { facts, writeTargetExists }) {
  const record = parseTerminalRecord(sample.result?.text)
  const output = `${String(record?.stdout ?? '')}\n${String(record?.stderr ?? '')}`
  const writeFacts = facts.filter((f) => f.method === 'spawn:write' || f.method === 'shellWrite')
  const targetFacts = writeFacts.filter((f) => String(f.locator ?? '').endsWith(WRITE_FILE))
  return verdictOf(
    'an out-of-ceiling WRITE is NOT refused by the read axis (a redirect target is not a read intent): the command runs and the target write is refused by the confined OS profile, leaving no file',
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued the write probe' },
      { id: 'command-ran', ok: record?.kind === 'confined-terminal', detail: `kind=${String(record?.kind)} (admission admitted it)` },
      { id: 'write-failed', ok: /A5SF_RC_WRITE_RC=([1-9]\d*)/u.test(output), detail: `the redirect's own status=${JSON.stringify(lineValue(output, 'A5SF_RC_WRITE_RC='))}` },
      { id: 'no-marker-bytes', ok: output.includes(WRITE_TEXT) === false, detail: 'the marker never reached a created file/stdout' },
      { id: 'target-absent', ok: writeTargetExists === false, detail: 'the out-of-ceiling target file does not exist after the command' },
      { id: 'not-read-attributed', ok: targetFacts.length === 0, detail: `guard facts naming the write target on the read/write declaration=${String(targetFacts.length)} (the declaration names only the session cwd)` },
    ],
  )
}

function judgeDynamic(sample, { facts, kind }) {
  const record = parseTerminalRecord(sample.result?.text)
  const text = String(sample.result?.text ?? '')
  const output = `${String(record?.stdout ?? '')}\n${String(record?.stderr ?? '')}`
  const secretFacts = facts.filter((f) => String(f.locator ?? '') === sample.secretPath || String(f.locator ?? '').endsWith(SECRET_FILE))
  const secretDenies = secretFacts.filter((f) => f.method === 'shellRead' && f.decision === 'deny')
  const returnedBytes = textHasSecret(text)
  return verdictOf(
    `a DYNAMIC read (${kind}) is not lexically attributable: admission does not consult the read lane for it; the OS profile is the boundary and must return no secret bytes`,
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued the dynamic read' },
      { id: 'command-ran', ok: record?.kind === 'confined-terminal', detail: `kind=${String(record?.kind)} (admission admitted it)` },
      { id: 'no-read-fact', ok: secretDenies.length === 1 && secretFacts.every((f) => f.decision === 'deny'), detail: `secret-naming shellRead DENY facts=${String(secretDenies.length)} — exactly the ONE deliberate literal-read denial; the two dynamic bodies added none, so the lexical read axis never saw them` },
      { id: 'no-secret-bytes', ok: returnedBytes === false, detail: returnedBytes ? 'THE SECRET BYTES WERE RETURNED — the OS profile did not stop the dynamic read' : 'no secret bytes returned' },
      { id: 'os-refused', ok: returnedBytes === false && new RegExp(`A5SF_RC_DYN_${kind === '$VAR path' ? 'VAR' : 'SUBST'}_RC=([1-9]\\d*)`, 'u').test(output), detail: `the command's own status=${JSON.stringify(lineValue(output, 'A5SF_RC_DYN_'))} (a trailing status print keeps the overall exit 0; the non-zero RC is the kernel/profile refusal)` },
      { id: 'kernel-not-admission', ok: /Permission denied/iu.test(output), detail: 'the refusal text is the OS profile\'s, not an IO_READ_DENIED admission fact' },
    ],
  )
}

function judgeSurface(surface, { presetHasPersistentRow }) {
  const names = surface.map((s) => s.name)
  const bash = surface.find((s) => s.name === 'bash') ?? null
  const props = Object.keys(bash?.parameters?.properties ?? {})
  const terminalish = names.filter((n) => /terminal|pty|persistent.?shell|shell.?session/iu.test(n))
  const jobTools = names.filter((n) => n === 'job_list' || n === 'job_output' || n === 'job_kill')
  return verdictOf(
    'the governed preset\'s Member surface has ONE `bash` (the confined terminal definition) and NO persistent terminal / PTY tool; the job-control TOOLS are present',
    [
      { id: 'exactly-one-bash', ok: names.filter((n) => n === 'bash').length === 1, detail: `bash occurrences=${String(names.filter((n) => n === 'bash').length)}` },
      { id: 'bash-params', ok: props.sort().join(',') === 'command,description,workdir', detail: `properties=${props.join(',')}` },
      { id: 'bash-confined', ok: /confined terminal face/iu.test(String(bash?.description ?? '')), detail: `description=${String(bash?.description ?? '').slice(0, 120)}` },
      { id: 'no-terminal-tool', ok: terminalish.length === 0, detail: `persistent-terminal-shaped tool names=${JSON.stringify(terminalish)}` },
      { id: 'preset-has-no-persistent-row', ok: presetHasPersistentRow === false, detail: 'the shipped governed preset declares no `@deepseek-ai/dsh-terminal` / `tool-bash-persistent` row' },
      { id: 'job-tools-present', ok: jobTools.length === 3, detail: `job-control tools=${JSON.stringify(jobTools)}` },
    ],
  )
}

function judgeJobs(bgSample, jobListSample, surface) {
  const bash = surface.find((s) => s.name === 'bash') ?? null
  const props = Object.keys(bash?.parameters?.properties ?? {})
  const bgText = String(bgSample.result?.text ?? '')
  const bgRecord = parseTerminalRecord(bgText)
  const jobId = /"(?:jobId|id)"\s*:\s*"(job-[^"]+)"/u.exec(bgText)
  const jobText = String(jobListSample.result?.text ?? '')
  const jobListEmpty = /"jobs"\s*:\s*\[\s*\]/u.test(jobText) || jobText.trim() === '[]' || /"total"\s*:\s*0/u.test(jobText) || /no background jobs/iu.test(jobText)
  const jobListPresent = jobListSample.result !== undefined
  return verdictOf(
    'the governed preset exposes NO managed-job producer: `run_in_background` is not on the model-visible `bash` schema, a background request creates no job id, and `job_list` reports an empty registry',
    [
      { id: 'schema-no-run_in_background', ok: props.includes('run_in_background') === false, detail: `bash properties=${props.join(',')}` },
      { id: 'bg-attempt-no-job-id', ok: jobId === null, detail: jobId === null ? 'the background request produced no host job id' : `UNEXPECTED job id ${jobId[1]}` },
      { id: 'bg-attempt-not-a-job', ok: bgText.includes('"kind":"background"') === false && bgText.includes('still running') === false, detail: `result kind=${String(bgRecord?.kind ?? '(not a confined-terminal record)')}` },
      { id: 'job-list-present', ok: jobListPresent, detail: jobListPresent ? 'job_list answered' : 'job_list produced no tool result' },
      { id: 'job-list-empty', ok: jobListEmpty, detail: `job_list text=${JSON.stringify(jobText.slice(0, 160))}` },
      { id: 'bg-flag-silently-dropped', ok: bgRecord?.kind === 'confined-terminal', detail: `the extra \`run_in_background\` argument produced NO typed argument refusal and ran FOREGROUND (kind=${String(bgRecord?.kind)}) — the closed schema did not reject it and the flag has no producer` },
    ],
  )
}

function judgeRevokedEntry({ probe, xOne, facts, counters }) {
  const xRecord = parseTerminalRecord(xOne.result?.text)
  const promptAccepted = probe?.prompt?.status === 200
  const shellResult = xOne.result !== undefined
  return verdictOf(
    'after the durable ARCHIVED commit, the revoked Member\'s OWN session entry cannot obtain a terminal: the session no longer serves a `bash` execution (either the prompt is refused or no tool result exists)',
    [
      { id: 'probe-attempted', ok: probe?.attempted === true, detail: `childSessionId=${String(probe?.childSessionId)}` },
      { id: 'prompt-answered-or-refused-honestly', ok: probe?.prompt !== undefined, detail: `session/prompt answer=${JSON.stringify(probe?.prompt).slice(0, 240)}` },
      { id: 'no-bash-result', ok: shellResult === false, detail: shellResult ? `A TERMINAL RESULT EXISTS: kind=${String(xRecord?.kind ?? '(non-confined record)')}, exit=${String(xRecord?.exitCode)} — the revoked session entry still reaches a shell` : 'no `bash` tool result was produced on the revoked session' },
      { id: 'no-pty-holder', ok: counters.ptyHolders === 0, detail: `processes holding /dev/pts fds=${String(counters.ptyHolders)}` },
      { id: 'probe-surface-recorded', ok: true, detail: `promptAccepted=${String(promptAccepted)}; xSurface=${JSON.stringify(probe?.xSurface ?? [])}; xBashDescription=${JSON.stringify(String(probe?.xBashDescription ?? '').slice(0, 140))}` },
    ],
  )
}

function judgeRevocation({ archiveA, followupA, archiveB, bSecond, cOne, counters, ordering }) {
  const archiveAText = String(archiveA.result?.text ?? '')
  const followupText = String(followupA.result?.text ?? '')
  const archiveBText = String(archiveB.result?.text ?? '')
  const bSecondPresent = bSecond.result !== undefined
  const archiveBExecuted = archiveBText.includes('"status":"executed"') || archiveBText.includes('"action":"archive-member"')
  const cRecord = parseTerminalRecord(cOne.result?.text)
  return verdictOf(
    'revocation is per-instance and lifecycle-scoped: an ARCHIVED Member cannot take new work (follow_up refused) or create another terminal, its in-flight shell child does not produce a second command, and a NEW generation can still acquire a confined terminal',
    [
      { id: 'archive-a-executed', ok: archiveAText.includes('"status":"executed"') || archiveAText.includes('"action":"archive-member"'), detail: `archive result=${JSON.stringify(archiveAText.slice(0, 180))}` },
      { id: 'followup-refused', ok: followupText.includes('"status":"rejected"') || followupText.includes('"status":"blocked"') || followupA.result?.isError === true, detail: `follow_up on the archived instance=${JSON.stringify(followupText.slice(0, 220))}` },
      { id: 'no-second-command-after-archive', ok: ordering?.bSecondAfterArchiveCommit !== true, detail: `mid-flight archive executed=${String(archiveBExecuted)}; SECOND command result present=${String(bSecondPresent)}; ordering=${String(ordering?.bSecondAboutArchive)} (issueAt=${String(ordering?.archiveBIssuedAt)}, commitUpperAt=${String(ordering?.archiveBResultObservedAt)}, secondAt=${String(ordering?.bSecondCallAt)})` },
      { id: 'new-generation-terminal', ok: cRecord?.kind === 'confined-terminal' && cRecord?.exitCode === 0 && String(cRecord?.stdout ?? '').includes(IN_LANE_TEXT), detail: `new Member bash kind=${String(cRecord?.kind)} exit=${String(cRecord?.exitCode)}` },
      { id: 'no-pty-holder-process', ok: counters.ptyHolders === 0, detail: `processes holding /dev/pts fds=${String(counters.ptyHolders)}` },
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
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-live-member plan (no World)'], rows) + '\n')
  log(`rows: ${JSON.stringify(rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 80) })))}`)
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
    runId, suite: 'a5sf-recon-shell', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, grant), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-recon-shell', line: LINE,
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
  let teardown = null
  let failure = null
  let hostReached = false
  let abortStage = 'pre-boot'
  let paths = null
  let timelineRef = []
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
      const outsideWritePath = join(outsideDir, WRITE_FILE)
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

      const decide = makeDecide({ inLanePath, secretPath, outsideWritePath, workspaceDir: workspace })
      // ORDERING WITNESS: every model request is stamped in THIS process, so a
      // "second command after the archive commit" claim has a clock, not an
      // inference. The archive executes between the request that issues it and
      // the next request that observes its tool result.
      const timeline = []
      const decideWithTimeline = (ctx) => {
        const at = Date.now()
        const reply = decide(ctx)
        timeline.push({
          at, atIso: new Date(at).toISOString(),
          isMember: isMemberRequest(ctx.req), member: memberTokenOf(ctx.req),
          seen: [...resultIdsOf(ctx.req)],
          replyCalls: (reply?.toolCalls ?? []).map((c) => ({ id: c.id, name: c.name })),
        })
        return reply
      }
      process.env.A5SF_GOVERNED_SCRATCH = join(world.home, 'governed-scratch')
      mkdirSync(process.env.A5SF_GOVERNED_SCRATCH, { recursive: true })
      await world.startMock({ decide: decideWithTimeline })
      timelineRef = timeline
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })
    hostReached = true
    abortStage = 'composition'
    paths = {
      workspace: world.workspaceDir,
      inLane: join(world.workspaceDir, IN_LANE_FILE),
      secret: join(world.home, 'out-of-lane', SECRET_FILE),
      outsideWrite: join(world.home, 'out-of-lane', WRITE_FILE),
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
        const hits = scanProc({ inLanePath: paths.inLane, secretPath: paths.secret, outsideWritePath: paths.outsideWrite })
        const kept = []
        const seen = new Set()
        for (const hit of hits) {
          // The gateway itself runs this whole session under `bwrap`; those
          // wrappers are NOT the Member's tool path. Only a base `bwrap` whose
          // argv NAMES one of our fixtures is evidence, so the rest is counted
          // (a disclosure) and never stored.
          if (hit.marker === 'base-bwrap' && hit.namesInLane !== true && hit.namesSecret !== true) { otherBwrapPids.add(hit.pid); continue }
          const key = `${hit.marker}:${String(hit.pid)}`
          if (seen.has(key)) continue
          seen.add(key)
          if (hit.marker === 'payload-in-lane' || hit.marker === 'payload-secret') delete hit.mountinfoSample
          kept.push(hit)
        }
        if (kept.length > 0) procLog.push({ at: new Date().toISOString(), hits: kept })
      } catch { /* observation must never break the run */ }
    }, 40)

    // ── discovery turn: the REAL Leader surface (to compute the deny list) ──
    abortStage = 'discovery'
    await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfrc')
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
    const mainText = mainBlueprintYaml({ denyList, workspace: paths.workspace })
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
      out.delegateCall = toolCallFor(requestsNow, CALL.DELEGATE_A)
      out.delegateResult = toolResultFor(requestsNow, CALL.DELEGATE_A) ?? null
      out.revocation = {
        archiveA: toolResultFor(requestsNow, CALL.ARCHIVE_A) ?? null,
        followupA: toolResultFor(requestsNow, CALL.FOLLOWUP_A) ?? null,
        archiveB: toolResultFor(requestsNow, CALL.ARCHIVE_B) ?? null,
        delegateC: toolResultFor(requestsNow, CALL.DELEGATE_C) ?? null,
        bSecond: toolResultFor(requestsNow, CALL.B_SECOND) ?? null,
      }
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
    const delegateCall = toolCallFor(requests0, CALL.DELEGATE_A)
    const delegateResult = toolResultFor(requests0, CALL.DELEGATE_A)
    writeFileSync(join(bootDir, 'leader-delegate.json'), JSON.stringify({
      call: delegateCall, result: delegateResult === undefined ? null : delegateResult,
    }, null, 2) + '\n')
    log(`[boot${String(index)}] delegate call=${String(delegateCall !== null)} result=${redact(String(delegateResult?.text ?? '<missing>')).slice(0, 500)}`)

    const delegateEffect = (() => { try { const j = JSON.parse(String(delegateResult?.text ?? 'null')); return j?.effect ?? j?.result?.effect ?? null } catch { return null } })()
    const delegateAChildSessionId = typeof delegateEffect?.childSessionId === 'string' ? delegateEffect.childSessionId : null
    // ── REVOCATION ENTRY PROBE: after the Leader's chain has ARCHIVED the
    // Member, address that Member's OWN child session through the host session
    // API and ask for a terminal. If the session is disposed this is refused;
    // if it answers with a `bash` result, the entry that still reaches a
    // terminal has a NAME (and its definition/guard facts say which face).
    abortStage = 'revoked-session-probe'
    const revokedProbe = { attempted: false, childSessionId: delegateAChildSessionId }
    if (delegateAChildSessionId !== null) {
      revokedProbe.attempted = true
      try {
        const res = await apiPrompt(origin, cookie, delegateAChildSessionId, `${TOK_X}: the Leader archived you; try one terminal probe.`, 'a5sfrcx')
        revokedProbe.prompt = { status: res.status, body: String(JSON.stringify(res.body ?? {})).slice(0, 500) }
      } catch (error) {
        revokedProbe.prompt = { error: String(error?.message ?? error) }
      }
      revokedProbe.answered = await waitFor(async () => (world.mock?.requests ?? []).some((r) => {
        const first = messagesOf(r).find((m) => m?.role === 'user')
        const text = typeof first?.content === 'string' ? first.content : JSON.stringify(first?.content ?? '')
        return text.includes(TOK_X) || messagesOf(r).some((m) => textOf(m).includes(TOK_X))
      }), 45_000)
      revokedProbe.xRequest = (world.mock?.requests ?? []).filter((r) => messagesOf(r).some((m) => textOf(m).includes(TOK_X))).at(-1) ?? null
      if (revokedProbe.xRequest !== null) {
        revokedProbe.xReply = revokedProbe.xRequest.reply ?? null
        revokedProbe.xSurface = surfaceNamesOf(revokedProbe.xRequest)
        const xTool = (revokedProbe.xRequest.body?.tools ?? []).find((t) => String(t?.name ?? t?.function?.name ?? '') === 'bash')
        revokedProbe.xBashDescription = xTool?.description ?? xTool?.function?.description ?? null
      }
    }
    writeFileSync(join(bootDir, 'revoked-entry-probe.json'), JSON.stringify(revokedProbe, null, 2) + '\n')
    log(`[boot${String(index)}] revoked-entry probe: attempted=${String(revokedProbe.attempted)} answered=${String(revokedProbe.answered)} reply=${String(revokedProbe.xReply?.kind ?? revokedProbe.prompt?.status)}`)
    const state = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const stateMembers = Array.isArray(state?.body?.members) ? state.body.members : []
    const requests = world.mock?.requests ?? []
    const callOf = (id) => toolCallFor(requests, id)
    const resultOf = (id) => toolResultFor(requests, id)
    const jsonOf = (text) => { try { return JSON.parse(text) } catch { return null } }
    const effectOf = (id) => {
      const parsed = jsonOf(resultOf(id)?.text)
      return parsed?.effect ?? parsed?.result?.effect ?? null
    }
    const memberInfo = (key) => {
      const effect = effectOf(CALL[`DELEGATE_${key}`])
      const instanceId = effect?.instanceId ?? null
      const stateRow = stateMembers.find((m) => m?.instanceId === instanceId) ?? null
      const childSessionId = effect?.childSessionId ?? stateRow?.childSessionId ?? stateRow?.row?.childSessionId ?? null
      return { key, instanceId, childSessionId, effect, stateRow }
    }
    const infoA = memberInfo('A')
    const infoB = memberInfo('B')
    const infoC = memberInfo('C')
    writeFileSync(join(bootDir, 'members.json'), JSON.stringify({ stateMembers, A: infoA, B: infoB, C: infoC }, null, 2) + '\n')
    log(`[boot${String(index)}] members A=${String(infoA.instanceId)}/${String(infoA.stateRow?.lifecycle)} B=${String(infoB.instanceId)}/${String(infoB.stateRow?.lifecycle)} C=${String(infoC.instanceId)}/${String(infoC.stateRow?.lifecycle)}`)

    const transcripts = {}
    for (const info of [infoA, infoB, infoC]) {
      if (info.childSessionId === null) continue
      const found = readMemberTranscript(world.home, info.childSessionId)
      if (found === null) continue
      transcripts[info.key] = found
      writeFileSync(join(bootDir, `member-${info.key}-transcript.json`), JSON.stringify(found, null, 2) + '\n')
      writeFileSync(join(bootDir, `member-${info.key}-transcript.txt`), renderTranscript(found) + '\n')
      try { writeFileSync(join(bootDir, `member-${info.key}-session.v4.jsonl.zstd`), readFileSync(found.file)) } catch { /* normalised transcript is enough */ }
    }
    if (transcripts.A !== undefined) {
      writeFileSync(join(bootDir, 'member-transcript.json'), JSON.stringify(transcripts.A, null, 2) + '\n')
      writeFileSync(join(bootDir, 'member-transcript.txt'), renderTranscript(transcripts.A) + '\n')
      try { writeFileSync(join(bootDir, 'member-session.v4.jsonl.zstd'), readFileSync(transcripts.A.file)) } catch { /* best effort */ }
    }
    try { rmSync(join(bootDir, 'sessions-final'), { recursive: true, force: true }) } catch { /* absent */ }

    // The LEADER's own durable session: the archive tool result and its place
    // in the chain, copied before teardown (the home is deleted after this).
    try {
      const leaderSession = findSessionFile(world.home, ACCEPTANCE_ROOT)
      if (leaderSession !== null) {
        writeFileSync(join(bootDir, 'leader-session.v4.jsonl.zstd'), leaderSession.buffer)
        const leaderLines = decompressZstdStream(leaderSession.buffer).toString('utf8').split('\n').filter((l) => l !== '')
          .map((l) => { try { return JSON.parse(l) } catch { return { unparsed: l.slice(0, 200) } } })
        writeFileSync(join(bootDir, 'leader-events.json'), JSON.stringify(leaderLines.map((row) => ({
          type: row?.type ?? row?.kind ?? null,
          seq: row?.seq ?? row?.data?.seq ?? null,
          time: row?.time ?? row?.data?.time ?? null,
          callId: row?.data?.callId ?? row?.data?.message?.source?.callId ?? null,
          name: row?.data?.name ?? null,
          from: row?.data?.from ?? null,
          to: row?.data?.to ?? null,
        })), null, 2) + '\n')
      }
    } catch { /* the normalised evidence still carries the archive result */ }
    writeFileSync(join(bootDir, 'timeline.json'), JSON.stringify(timelineRef, null, 2) + '\n')

    // ORDERING: did Member B's SECOND command start after the Leader had
    // already observed the archive's tool result (i.e. after the durable
    // RUNNING→ARCHIVED commit)? The decision clock is the mock's, the commit
    // window is [archive request, next Leader request that sees its result].
    const ordering = (() => {
      try {
        const tl = timelineRef
        const issueIndex = tl.findIndex((e) => e.replyCalls.some((c) => c.id === CALL.ARCHIVE_B))
        const issue = issueIndex === -1 ? null : tl[issueIndex]
        const observed = issueIndex === -1 ? null : (tl.slice(issueIndex + 1).find((e) => e.seen.includes(CALL.ARCHIVE_B)) ?? null)
        const bEvents = {}
        const bTranscript = transcripts.B
        if (bTranscript !== undefined) {
          const buf = readFileSync(bTranscript.file)
          const rows = decompressZstdStream(buf).toString('utf8').split('\n').filter((l) => l !== '')
            .map((l) => { try { return JSON.parse(l) } catch { return null } })
          for (const row of rows) {
            const type = row?.type ?? null
            const data = row?.data ?? {}
            if (type === 'tool/call') bEvents[data.callId] = { ...(bEvents[data.callId] ?? {}), callAt: row.time ?? data.time ?? null }
            if (type === 'tool/result') {
              const callId = data.toolCallId ?? data?.message?.source?.callId ?? null
              if (callId !== null) bEvents[callId] = { ...(bEvents[callId] ?? {}), resultAt: row.time ?? data.time ?? null }
            }
          }
        }
        const second = bEvents[CALL.B_SECOND] ?? null
        const issueAt = issue?.at ?? null
        const commitUpperAt = observed?.at ?? null
        return {
          archiveBIssuedAt: issueAt,
          archiveBResultObservedAt: commitUpperAt,
          archiveBCommitWindowMs: issueAt === null || commitUpperAt === null ? null : commitUpperAt - issueAt,
          bFirstCallAt: bEvents[CALL.B_LONG]?.callAt ?? null,
          bFirstResultAt: bEvents[CALL.B_LONG]?.resultAt ?? null,
          bSecondCallAt: second?.callAt ?? null,
          bSecondResultAt: second?.resultAt ?? null,
          bSecondAboutArchive: second?.callAt === undefined || second?.callAt === null || issueAt === null || commitUpperAt === null
            ? 'UNKNOWN'
            : second.callAt > commitUpperAt ? 'AFTER_ARCHIVE_COMMIT' : second.callAt < issueAt ? 'BEFORE_ARCHIVE_ISSUE' : 'INSIDE_COMMIT_WINDOW',
          bSecondAfterArchiveCommit: second?.callAt !== undefined && second?.callAt !== null && commitUpperAt !== null && second.callAt > commitUpperAt,
          bSecondBeforeArchiveIssue: second?.callAt !== undefined && second?.callAt !== null && issueAt !== null && second.callAt < issueAt,
        }
      } catch (error) {
        return { error: String(error?.message ?? error) }
      }
    })()
    writeFileSync(join(bootDir, 'ordering.json'), JSON.stringify({ timeline: timelineRef, ordering, bEvents: null }, null, 2) + '\n')

    const ownResult = (key, id) => {
      const found = transcripts[key]?.calls.find((c) => String(c.callId) === String(id))
      return found?.result ?? resultOf(id)
    }
    const sample = (key, id) => ({ call: callOf(id), result: ownResult(key, id), secretPath: paths.secret })
    const aAllow = sample('A', CALL.A_ALLOW)
    const aDenyRead = sample('A', CALL.A_DENY_READ)
    const aDenyWrite = sample('A', CALL.A_DENY_WRITE)
    const aDynVar = sample('A', CALL.A_DYN_VAR)
    const aDynSubst = sample('A', CALL.A_DYN_SUBST)
    const aBg = sample('A', CALL.A_BG)
    const aJobList = sample('A', CALL.A_JOBLIST)
    const bLong = sample('B', CALL.B_LONG)
    const bSecond = sample('B', CALL.B_SECOND)
    const cOne = sample('C', CALL.C_ONE)
    const xOne = sample('A', CALL.X_ONE)
    const archiveA = { call: callOf(CALL.ARCHIVE_A), result: resultOf(CALL.ARCHIVE_A) }
    const followupA = { call: callOf(CALL.FOLLOWUP_A), result: resultOf(CALL.FOLLOWUP_A) }
    const archiveB = { call: callOf(CALL.ARCHIVE_B), result: resultOf(CALL.ARCHIVE_B) }
    const delegateC = { call: callOf(CALL.DELEGATE_C), result: resultOf(CALL.DELEGATE_C) }
    writeFileSync(join(bootDir, 'revocation.json'), JSON.stringify({ archiveA, followupA, archiveB, bLong, bSecond, cOne, delegateC }, null, 2) + '\n')

    // The Member's model-visible surface (the agent request carrying OUR token).
    const memberRequest = requests.filter((r) => isMemberRequest(r) && surfaceNamesOf(r).length > 0).at(-1) ?? null
    const toolEntries = memberRequest === null ? [] : (memberRequest.body?.tools ?? []).map((schema) => {
      const fn = schema?.function ?? null
      return {
        name: String(schema?.name ?? fn?.name ?? ''),
        description: schema?.description ?? fn?.description ?? null,
        parameters: schema?.parameters ?? fn?.parameters ?? schema?.input_schema ?? schema?.inputSchema ?? null,
      }
    })
    const memberSurface = toolEntries.filter((s) => s.name === 'bash' || s.name.startsWith('job_'))
    const surfaceNames = memberRequest === null ? [] : toolEntries.map((s) => s.name)
    writeFileSync(join(bootDir, 'member-surface.json'), JSON.stringify({
      at: new Date().toISOString(),
      tools: surfaceNames,
      bash: memberSurface.find((s) => s.name === 'bash') ?? null,
      jobTools: memberSurface.filter((s) => s.name.startsWith('job_')),
    }, null, 2) + '\n')

    const presetRow = layer.rows.find((row) => row?.config?.id === PRESET_ID)
    const presetNames = []
    const visitPreset = (list) => {
      for (const plugin of list ?? []) {
        if (typeof plugin?.name === 'string') presetNames.push(plugin.name)
        if (Array.isArray(plugin?.config)) visitPreset(plugin.config)
      }
    }
    visitPreset(presetRow?.config?.plugins ?? [])
    const presetHasPersistentRow = presetNames.some((n) => n.includes('dsh-terminal') || n.includes('tool-bash-persistent'))

    // Guard facts: the product sink is the only channel they reach.
    const factsAll = parseJsonl(paths.sink).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const shellReadFacts = factsAll.filter((f) => f.method === 'shellRead')
    writeFileSync(join(bootDir, 'guard-facts.json'), JSON.stringify(factsAll, null, 2) + '\n')

    // Independent /proc counters (deduped by pid inside the whole window).
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
    const shellChildPids = sightingPids('shell-child')
    const ptyHolders = sightingPids('pty-holder', (h) => h.cmdline.includes(paths.workspace) || h.cmdline.includes(paths.inLane) || h.cmdline.includes(paths.secret) || h.cmdline.includes(paths.outsideWrite))
    const payloadInLane = sightingPids('payload-in-lane')
    const payloadSecret = sightingPids('payload-secret')
    const baseBwrap = sightingPids('base-bwrap', (h) => h.namesInLane === true || h.namesSecret === true)
    const procFacts = []
    const seenProc = new Set()
    for (const batch of procLog) {
      for (const hit of batch.hits) {
        if (hit.marker !== 'shell-child' && hit.marker !== 'confined-launcher' && hit.marker !== 'pty-holder') continue
        const key = `${hit.marker}:${String(hit.pid)}`
        if (seenProc.has(key)) continue
        seenProc.add(key)
        procFacts.push(hit)
      }
    }
    counters.confinedTurnLaunchers = launcherPids.size
    counters.preflightLaunchers = preflightPids.size
    counters.shellChildPids = shellChildPids.size
    counters.ptyHolders = ptyHolders.size
    const shellChildByPid = new Map()
    for (const batch of procLog) {
      for (const hit of batch.hits) if (hit.marker === 'shell-child') shellChildByPid.set(hit.pid, hit)
    }
    counters.shellChildFd0 = [...shellChildByPid.values()].reduce((acc, hit) => {
      const target = hit.fds?.[0] ?? 'missing'
      const kind = String(target).startsWith('/dev/pts/') ? 'pty' : String(target).startsWith('socket:') ? 'socket' : target === '/dev/null' ? 'dev-null' : 'other'
      acc[kind] = (acc[kind] ?? 0) + 1
      return acc
    }, {})
    counters.shellChildCommandSightings = [...shellChildByPid.values()].map((hit) => ({
      pid: hit.pid, ppid: hit.ppid, fd0: hit.fds?.[0] ?? null, state: hit.state,
      namesInLane: hit.namesInLane, namesSecret: hit.namesSecret, cmdline: String(hit.cmdline ?? '').slice(0, 220),
    }))
    counters.payloadInLaneSightings = payloadInLane.size
    counters.procSecretCommandSightings = payloadSecret.size
    counters.baseBwrapWithMarkers = baseBwrap.size
    counters.guardFacts = {
      allow: factsAll.filter((f) => f.decision === 'allow').length,
      deny: factsAll.filter((f) => f.decision === 'deny').length,
      shellReadAllow: shellReadFacts.filter((f) => f.decision === 'allow').length,
      shellReadDeny: shellReadFacts.filter((f) => f.decision === 'deny').length,
      spawnWriteDeny: factsAll.filter((f) => f.method === 'spawn:write' && f.decision === 'deny').length,
    }
    counters.mockRequests = requests.length
    counters.memberModelRequests = requests.filter((r) => isMemberRequest(r) && surfaceNamesOf(r).length > 0).length
    counters.procBatches = procLog.length
    counters.otherBwrapPids = otherBwrapPids.size
    counters.memberWindow = { from: memberPromptAt, to: memberDoneAt }
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')
    writeFileSync(join(bootDir, 'proc-observations.json'), JSON.stringify({
      schema: 'a5sf-recon-shell/proc-observations/1', at: new Date().toISOString(),
      note: 'independent /proc/<pid> scan; a sighting is an OS-level fact. fdIsPty is the legacy-PTY signature; NSpid separates the child\'s namespace-local view from its host pid.',
      uniqueProcessFacts: procFacts,
      batches: procLog.length,
      sightings: procLog.filter((batch) => batch.hits.some((h) => h.marker === 'shell-child' || h.marker === 'pty-holder' || h.marker === 'confined-launcher' || h.marker === 'payload-secret' || h.marker === 'payload-in-lane')),
    }, null, 2) + '\n')

    const dynVarVerdict = judgeDynamic(aDynVar, { facts: factsAll, kind: '$VAR path' })
    const dynSubstVerdict = judgeDynamic(aDynSubst, { facts: factsAll, kind: '$(...) substitution' })
    const dynamic = {
      verdict: dynVarVerdict.verdict === 'PROVEN' && dynSubstVerdict.verdict === 'PROVEN' ? 'PROVEN' : 'REFUTED',
      proposition: 'dynamic shell reads ($VAR path, $(...) substitution) are NOT attributed by the lexical read axis; the OS profile is the boundary and returns no secret bytes',
      failed: [...dynVarVerdict.failed, ...dynSubstVerdict.failed],
      clauses: [...dynVarVerdict.clauses.map((c) => ({ ...c, id: `var:${c.id}` })), ...dynSubstVerdict.clauses.map((c) => ({ ...c, id: `subst:${c.id}` }))],
    }
    const verdicts = {
      admitted: judgeAdmittedRead(aAllow),
      deniedRead: judgeDeniedRead(aDenyRead),
      deniedWrite: judgeDeniedWrite(aDenyWrite, { facts: factsAll, writeTargetExists: existsSync(paths.outsideWrite) }),
      dynamic,
      surface: judgeSurface(memberSurface, { presetHasPersistentRow }),
      jobs: judgeJobs(aBg, aJobList, memberSurface),
      revocation: judgeRevocation({ archiveA, followupA, archiveB, bSecond, cOne, counters, ordering }),
      revokedEntry: judgeRevokedEntry({ probe: revokedProbe, xOne, facts: factsAll, counters }),
    }
    // NOTE: `detail` must NOT carry a `verdict` key — the record spreads it
    // AFTER the passed verdict and would silently overwrite it.
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}`)
    }
    add('rc:bash-admitted-read', verdicts.admitted.verdict, verdicts.admitted)
    add('rc:bash-denied-read', verdicts.deniedRead.verdict, verdicts.deniedRead)
    add('rc:bash-denied-write', verdicts.deniedWrite.verdict, verdicts.deniedWrite)
    add('rc:bash-dynamic-read', verdicts.dynamic.verdict, verdicts.dynamic)
    add('rc:surface-shell-and-jobs', verdicts.surface.verdict, verdicts.surface)
    add('rc:managed-job-absent', verdicts.jobs.verdict, verdicts.jobs)
    add('rc:revocation-terminal', verdicts.revocation.verdict, verdicts.revocation)
    add('rc:revoked-session-entry', verdicts.revokedEntry.verdict, verdicts.revokedEntry)


    collectDiagnostics('final')
    const final = record.finalize()
    const summary = formatSummary(final)
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), summary + '\n')
    log(`[boot${String(index)}] ${summary}`)

    result = {
      boot: index, worldId: world.id, port: bootInfo.port, hostLog: bootInfo.logPath,
      runId, summary, overall: final.overall,
      childSessionId: infoA.childSessionId, instanceId: infoA.instanceId,
      instanceIds: { A: infoA.instanceId, B: infoB.instanceId, C: infoC.instanceId },
      transcript: transcripts.A === undefined ? null : {
        file: transcripts.A.file, sessionId: transcripts.A.sessionId, lineCount: transcripts.A.lineCount,
        user: transcripts.A.user, finalAssistant: transcripts.A.finalAssistant,
        calls: transcripts.A.calls,
      },
      transcripts: Object.fromEntries(Object.entries(transcripts).map(([k, t]) => [k, {
        file: t.file, sessionId: t.sessionId, lineCount: t.lineCount,
        user: t.user, finalAssistant: t.finalAssistant, calls: t.calls,
      }])),
      counters, facts: factsAll, shellReadFacts, verdicts,
      locus: buildLocus({ world, bootInfo, transcript: transcripts.A ?? null, facts: factsAll, paths, bootDir }),
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
      rowConfig: 'dev/agent-workflow/evidence/a5sf-recon-shell/plan-patch.yml (regenerated by --plan; boot copies live in the World home)',
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
    out.push(`  command: ${String(args.command ?? '')}`)
    out.push(`  workdir: ${String(args.workdir ?? '')}`)
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
    command: `node dev/agent-workflow/evidence/a5sf-recon-shell/run-boot.mjs${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
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
    deniedReadVerdict: r?.verdicts?.deniedRead?.verdict ?? null,
    deniedWriteVerdict: r?.verdicts?.deniedWrite?.verdict ?? null,
    dynamicVerdict: r?.verdicts?.dynamic?.verdict ?? null,
    surfaceVerdict: r?.verdicts?.surface?.verdict ?? null,
    jobsVerdict: r?.verdicts?.jobs?.verdict ?? null,
    revocationVerdict: r?.verdicts?.revocation?.verdict ?? null,
    revokedEntryVerdict: r?.verdicts?.revokedEntry?.verdict ?? null,
    shellReadAllow: r?.counters?.guardFacts?.shellReadAllow ?? null,
    shellReadDeny: r?.counters?.guardFacts?.shellReadDeny ?? null,
    confinedTurnLaunchers: r?.counters?.confinedTurnLaunchers ?? null,
    shellChildPids: r?.counters?.shellChildPids ?? null,
    ptyHolders: r?.counters?.ptyHolders ?? null,
    payloadInLane: r?.counters?.payloadInLaneSightings ?? null,
    payloadSecret: r?.counters?.procSecretCommandSightings ?? null,
    baseBwrapWithMarkers: r?.counters?.baseBwrapWithMarkers ?? null,
    bashHasNoRunInBackground: (() => {
      const bash = r?.verdicts?.surface?.clauses?.find((c) => c.id === 'bash-params')
      return bash?.ok === true && r?.verdicts?.jobs?.clauses?.find((c) => c.id === 'schema-no-run_in_background')?.ok === true
    })(),
    jobListEmpty: (() => {
      const c = r?.verdicts?.jobs?.clauses?.find((x) => x.id === 'job-list-empty')
      return c?.ok === true
    })(),
    newGenerationTerminal: (() => {
      const c = r?.verdicts?.revocation?.clauses?.find((x) => x.id === 'new-generation-terminal')
      return c?.ok === true
    })(),
    transcriptSourceCount: r?.transcript?.calls?.length ?? null,
  })
  const rows = ok.map((r) => ({ boot: r.boot, ...pick(r) }))
  const keys = [
    'overall', 'admittedVerdict', 'deniedReadVerdict', 'deniedWriteVerdict', 'dynamicVerdict',
    'surfaceVerdict', 'jobsVerdict', 'revocationVerdict', 'revokedEntryVerdict',
    // NOT included: `preflightLaunchers` (the realm's attach-time probe count is
    // environmental) and timings.
    'shellReadAllow', 'shellReadDeny', 'ptyHolders', 'baseBwrapWithMarkers',
    'bashHasNoRunInBackground', 'jobListEmpty', 'newGenerationTerminal', 'transcriptSourceCount',
  ]
  const differing = keys.filter((k) => new Set(rows.map((r) => JSON.stringify(r[k]))).size > 1)
  const agreeing = rows.length >= 2 && differing.length === 0
  const header = ['fact', ...rows.map((r) => `boot${String(r.boot)}`)]
  const body = keys.map((k) => [k, ...rows.map((r) => String(r[k]))])
  const width = Math.max(30, ...header.map((h) => h.length)) + 2
  const cell = (v) => String(v).padEnd(width)
  const table = [
    'TWO-RUN AGREEMENT (the same command, two boots; every row must be identical)',
    header.map(cell).join('').replace(/ +$/u, ''),
    ...body.map(([k, ...vals]) => `${cell(k)}${vals.map(cell).join('')}`.replace(/ +$/u, '')),
    '',
    `agreeing=${String(agreeing)} differing=${JSON.stringify(differing)}`,
  ].join('\n')
  return { schema: 'a5sf-recon-shell/agreement/1', at: new Date().toISOString(), boots: results.length, agreeing, differing, rows, table }
}

main().catch((error) => {
  log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
