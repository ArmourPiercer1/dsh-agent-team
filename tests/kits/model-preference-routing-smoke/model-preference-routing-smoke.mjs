#!/usr/bin/env node
/**
 * model-preference-routing-smoke.mjs — the REAL-HOST 0.1.7-rc.1 smoke kit for
 * the Blueprint `modelPreference` role-model routing fix (guide §7, R1–R8:
 * docs/plans/active/dsh-agent-team-model-preference-routing-fix-guide.md).
 * Structural template: tests/kits/mcp-initial-grant-smoke/mcp-initial-grant-smoke.mjs
 * (SIMPLIFIED: no mini-MCP servers, no MCP tools — the mock model is the
 * witness; we ASSERT on `body.model` of every ACTUAL provider request, the
 * guide FORBIDS checking only the projection).
 *
 * DEFECT UNDER TEST: the bound Blueprint template's `modelPreference` was
 * carried in the schema/hash/Remote projection but never reached the real
 * Agent model-selection path — every member silently ran the deployment
 * `staticModel` baseline (`global-default`). The fix makes it a TEMPLATE-STATIC
 * policy value the activation/resolver consumes (Gate C/D/E/F, commit 062d245).
 *
 * WHAT IT PROVES (one world, one row, sequential legs):
 *   R1 — team.create + leader initialWork: the leader's FIRST LLM request
 *        `body.model === 'role-leader'` (NOT 'global-default'), and
 *        governance override rows = 0 at that point (zero-seed proof).
 *   R2 — THE MOST IMPORTANT defect closure: the leader DIRECTLY calls
 *        team_delegate(delegationTemplateId='worker', prompt) — NO
 *        team_create_member + override.set + team_follow_up sequence — and
 *        the worker's FIRST LLM request `body.model === 'role-worker'`;
 *        no governance override record exists for that worker (the route
 *        did not come from any record).
 *   R3 — explicit team_create_member(worker): create ALONE triggers NO
 *        substantive worker model turn (the only new requests in the window
 *        are title side-calls); then team_follow_up → the worker's first
 *        (follow-up) LLM request `body.model === 'role-worker'`.
 *   R4 — durable override: on the R2 worker (already routing role-worker)
 *        write a durable HUMAN model override `deepseek-official/override-worker`
 *        (the remote `override.set` seam, instance scope); the state shows it
 *        pending at the next boundary; the NEXT request boundary (a
 *        team_follow_up) → that worker's next LLM request
 *        `body.model === 'override-worker'`; and the template static route
 *        created NO synthetic override record (override.get was null before
 *        the human write, exactly one record after).
 *   R5 — cold resume / host restart: on the expert member (ZERO model
 *        override) capture `body.model === 'role-expert'` BEFORE a host
 *        stop; stop the host; fresh boot the SAME DSH_HOME (phase=resume);
 *        the post-restart follow-up → `body.model === 'role-expert'`
 *        (the source is the bound Blueprint snapshot, re-derived on cold
 *        resume).
 *   R6 — projection agreement (one real member): actual provider request
 *        `body.model` == `effectiveConfig.model.value` ==
 *        `modelState.current.value` (read through the /team-remote
 *        projection + the /__p6t6/state seam), with the static template
 *        provenance source 'member-template', layer 'template', origin
 *        'static', recordId null.
 *   R7 — fallback control: a member on the NO-modelPreference control
 *        template → its LLM request `body.model === 'global-default'`
 *        (backward compatibility locked).
 *   R8 — cross-root: on the SAME host row, Team A (Blueprint A) and Team B
 *        (Blueprint B): Team A's worker `body.model === 'role-a'`, Team B's
 *        worker `body.model === 'role-b'` — no cross-root leak.
 *   H1 — test-use pristine pre/post (HEAD pinned 46a7f68b09…, porcelain
 *        empty) + the stable instance (:3080 / :3180) zero-touch (read-only
 *        probes identical before/after — those ports are NEVER bound or
 *        driven).
 *   H2 — run ports released (host + mock) at teardown.
 *
 * WORLD / RUNNER:
 *   - host = pristine test-use DSH 0.1.7-rc.1 (tests/deepseek-harness-test-use,
 *     MAIN checkout — gitignored, not in the worktree) launched via
 *     DshInstance (`node apps/cli/lib/bin.js web --port <port> --no-open`).
 *   - DSH_HOME = a fresh ephemeral world under <main-repo>/tests/homes/<RUN_STAMP>
 *     (TEST_METHODS §7 — the world is RETAINED at teardown, the path is
 *     recorded in the summary; nothing else enters the repo tree).
 *   - ports: host = FIRST FREE of 3181..3186 (the 3180 family; :3080/:3180
 *     are FORBIDDEN — stable dev instance); mock model = 3496.
 *   - env: DSH_HOME, DSH_CLIENT_COMMIT_HASH=46a7f68b09, DEEPSEEK_BASE_URL
 *     = http://127.0.0.1:3496 (the mock), DEEPSEEK_API_KEY = a smoke key.
 *   - rows mounted ONLY through the public profile-patch seam (the SEQUENCE
 *     form under `insert:` — the mapping form is silently ignored by the
 *     parser; verified via dump-config that the row carries our
 *     blueprints/staticModel):
 *       production row = <worktree>/packages/runtime/dist/.../host.js
 *         (row config: staticModel {provider: deepseek-official, model:
 *          global-default}, blueprintDir = the world's saved blueprints,
 *          glue = live/agent-bindings.mjs, seam = root-binding/harness/seam.mjs)
 *       observability row = <worktree>/packages/tools/harness/plugin.mjs (p6t6)
 *   - mock model = packages/tools/harness/mock-deepseek.mjs — records EVERY
 *     actual HTTP request (`body.model` = the model actually sent to the
 *     provider) and answers every turn with a deterministic SHORT TEXT ACK
 *     keyed on the marker embedded in the work prompt (multi-turn-safe:
 *     key on the LAST user message carrying the marker; the title
 *     side-call "Create a concise title…" returns neutral text). NO tool
 *     calls anywhere — every criterion is decided by `body.model`.
 *
 * 0.1.7-specific gates (from the PR #29 upgrade evidence
 * dsh-017rc1-upgrade/review-supplement/real-host-smoke.md):
 *   - the remote mount is MOUNT-BEFORE-BOOT: non-catalog /team-remote
 *     methods are refused with `runtime-not-ready` while the live boot
 *     settles → the kit polls team.create with 5s backoff (120s budget);
 *   - p6t6 readiness: /__p6t6/state must report status 'ready' AND
 *     bootPhase matching the boot phase BEFORE any team tool is driven;
 *   - mock records carry the parsed body under `.body` (bodyOf
 *     normalization);
 *   - session durability: the built glue's sessionIsDurable accepts the
 *     versioned session logs (`session.vN.jsonl(.zstd)`) — cold resume
 *     eligibility.
 *
 * HYGIENE (mirrors the mcp kit):
 *   - PRE: test-use porcelain EMPTY + HEAD == 46a7f68b09… (dieFatal
 *     otherwise); :3080 / :3180 NEVER bound or driven (read-only probe
 *     only, recorded for the zero-touch comparison); fresh home.
 *   - POST: test-use porcelain EMPTY + HEAD unchanged; host + mock ports
 *     released; world home RETAINED (path recorded — TEST_METHODS §7).
 *
 * USAGE:
 *   node model-preference-routing-smoke.mjs
 *     [--worktree <dir>]   (default: 3 levels up from this file)
 *     [--testuse <dir>]    (default: <worktree>/tests/deepseek-harness-test-use,
 *                           falling back to the PARENT repo's
 *                           tests/deepseek-harness-test-use — the pristine
 *                           checkout lives in the MAIN checkout only)
 *     [--host-port <n>]    (default: FIRST FREE of 3181..3186)
 *
 * Exit codes: 0 = all R1–R8 + H1 + H2 green; 2 = at least one criterion
 * failed (full evidence dump in RUN_DIR); 1 = kit-level fatal (preflight /
 * boot / infrastructure).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { findTestRepoRoot, homeDir, TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../tests/paths.mjs'
import { DshInstance, ensureProfile } from '../../../tests/characterization/lib/instance.mjs'
import { portInUse, waitForPortFree } from '../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../tests/characterization/lib/tree-clean.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

// ── CLI ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { _: [] }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--worktree') out.worktree = argv[++i]
    else if (a === '--testuse') out.testuse = argv[++i]
    else if (a === '--host-port') out.hostPort = argv[++i]
    else out._.push(a)
  }
  return out
}
const ARGS = parseArgs(process.argv.slice(2))

// ── fixed layout ───────────────────────────────────────────────────────────
const KIT_DIR = dirname(fileURLToPath(import.meta.url))
const WORKTREE = resolve(ARGS.worktree ?? join(KIT_DIR, '..', '..', '..'))
const TESTUSE = resolve(
  ARGS.testuse
    ?? (existsSync(join(WORKTREE, 'tests', 'deepseek-harness-test-use'))
      ? join(WORKTREE, 'tests', 'deepseek-harness-test-use')
      : join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use')),
)
const PRODUCTION_ROW_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_ROW_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const P6T6_ROW_NAME = pathToFileURL(P6T6_ROW_PATH).href

const STABLE_URLS = ['http://127.0.0.1:3080', 'http://127.0.0.1:3180'] // FORBIDDEN to bind; probe only
const HOST_PORT_CANDIDATES = [3181, 3182, 3183, 3184, 3185, 3186]
const MOCK_PORT = 3496
const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA // 46a7f68b0922371ce7144b668b90e377d8e799f4 (0.1.7-rc.1)

// The row static baseline (the deployment model every member WOULD run if
// the modelPreference route were broken).
const STATIC_MODEL = { provider: 'deepseek-official', model: 'global-default' }

function utcStamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-').slice(0, -5)
}
const RUN_STAMP = `mpr-${utcStamp()}`
const NONCE = RUN_STAMP
const REPO_ROOT = findTestRepoRoot(WORKTREE)
if (REPO_ROOT === null) {
  console.error('FATAL: cannot locate the team repo root (tests/deepseek-harness-test-use) above the worktree')
  process.exit(1)
}
const EVIDENCE_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'model-preference-routing', 'real-host')
const RUN_DIR = join(EVIDENCE_DIR, RUN_STAMP)
const HOME = homeDir(REPO_ROOT, RUN_STAMP)
const BLUEPRINT_DIR = join(HOME, 'blueprints')
const LOG_DIR = join(HOME, 'logs')

// Session ids (all under the one row).
const ROOT = `session-mpr-boot-${NONCE}` // the row's boot root (legacy anchor)
const ROOT_T1 = `session-mpr-t1-${NONCE}` // the main team (R1–R7)
const ROOT_TA = `session-mpr-ta-${NONCE}` // R8 Team A
const ROOT_TB = `session-mpr-tb-${NONCE}` // R8 Team B

// Blueprint ids.
const BP_MAIN_ID = 'team.mpr-main'
const BP_A_ID = 'team.mpr-a'
const BP_B_ID = 'team.mpr-b'
const BP_ANCHOR_ID = 'team.mpr-anchor'

// Model ids (the ACTUAL provider request body.model must equal these).
const M_GLOBAL = 'global-default'
const M_LEADER = 'role-leader'
const M_WORKER = 'role-worker'
const M_EXPERT = 'role-expert'
const M_OVR = 'override-worker'
const M_A = 'role-a'
const M_B = 'role-b'
const M_A_LEAD = 'role-a-leader'
const M_B_LEAD = 'role-b-leader'
const QUALIFIED_OVR = 'deepseek-official/override-worker'

// Per-leg markers (mutually substring-disjoint; every one embeds the nonce).
const MK_LEADER = `mpr_r1_leader_${NONCE}`
const MK_W_DELEG = `mpr_r2_w_deleg_${NONCE}`
const MK_W_CREATE = `mpr_r3_w_create_${NONCE}`
const MK_W_OVR = `mpr_r4_w_ovr_${NONCE}`
const MK_EXPERT_PRE = `mpr_r5_expert_pre_${NONCE}`
const MK_EXPERT_POST = `mpr_r5_expert_post_${NONCE}`
const MK_CONTROL = `mpr_r7_control_${NONCE}`
const MK_A_LEAD = `mpr_r8_a_lead_${NONCE}`
const MK_A_WORKER = `mpr_r8_a_worker_${NONCE}`
const MK_B_LEAD = `mpr_r8_b_lead_${NONCE}`
const MK_B_WORKER = `mpr_r8_b_worker_${NONCE}`

// The deterministic mock acks (what each role "answers" with).
const ACK_LEADER = `ack:role-leader:${NONCE}`
const ACK_W_DELEG = `ack:role-worker:deleg:${NONCE}`
const ACK_W_CREATE = `ack:role-worker:create:${NONCE}`
const ACK_W_OVR = `ack:role-worker:override:${NONCE}`
const ACK_EXPERT_PRE = `ack:role-expert:pre:${NONCE}`
const ACK_EXPERT_POST = `ack:role-expert:post:${NONCE}`
const ACK_CONTROL = `ack:global-default:${NONCE}`
const ACK_A_LEAD = `ack:role-a-leader:${NONCE}`
const ACK_A_WORKER = `ack:role-a:${NONCE}`
const ACK_B_LEAD = `ack:role-b-leader:${NONCE}`
const ACK_B_WORKER = `ack:role-b:${NONCE}`
const ACK_TITLE = `ack:title:${NONCE}`
const ACK_DEFAULT = `ack:default:${NONCE}`

const MARKER_ACKS = [
  [MK_LEADER, ACK_LEADER],
  [MK_W_DELEG, ACK_W_DELEG],
  [MK_W_CREATE, ACK_W_CREATE],
  [MK_W_OVR, ACK_W_OVR],
  [MK_EXPERT_PRE, ACK_EXPERT_PRE],
  [MK_EXPERT_POST, ACK_EXPERT_POST],
  [MK_CONTROL, ACK_CONTROL],
  [MK_A_LEAD, ACK_A_LEAD],
  [MK_A_WORKER, ACK_A_WORKER],
  [MK_B_LEAD, ACK_B_LEAD],
  [MK_B_WORKER, ACK_B_WORKER],
]

// The closed 13-tool team surface the created-team leaders carry.
const TEAM_TOOLS = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_send_message',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
  'team_list_pending_control',
  'team_collect',
  'team_archive_member',
]

const CRITERIA = ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'H1', 'H2']
const criteria = Object.fromEntries(CRITERIA.map((c) => [c, { checks: [] }]))

let LOG_PATH = null
function log(msg) {
  const line = `[mpr-smoke ${new Date().toISOString()}] ${msg}`
  process.stdout.write(line + '\n')
  if (LOG_PATH !== null) {
    try { writeFileSync(LOG_PATH, line + '\n', { flag: 'a' }) } catch { /* best-effort */ }
  }
}
function writeEvidence(subdir, name, value) {
  const dir = join(RUN_DIR, subdir)
  mkdirSync(dir, { recursive: true })
  const path = join(dir, name)
  writeFileSync(path, typeof value === 'string' ? value : JSON.stringify(value, null, 2))
  return path
}

function check(criterion, label, ok, detail = '') {
  const c = criteria[criterion]
  const entry = { label, ok: !!ok, detail: String(detail).slice(0, 1200) }
  c.checks.push(entry)
  log(`${criterion} ${ok ? 'PASS' : 'FAIL'} — ${label}${ok ? '' : ` | ${String(detail).slice(0, 500)}`}`)
  return !!ok
}
function finishCriterion(criterion) {
  const c = criteria[criterion]
  c.pass = c.checks.length > 0 && c.checks.every((x) => x.ok)
  return c.pass
}

class KitFatal extends Error {
  constructor(message) {
    super(message)
    this.name = 'KitFatal'
  }
}
function dieFatal(msg, extra = {}) {
  log(`FATAL: ${msg}`)
  throw new KitFatal(msg)
}

// ── blueprints (saved-source YAML, world-home only) ────────────────────────
// The row anchor: a plain LEGACY leader (no capabilities block at all — the
// shape mirrors the mcp kit's anchor; the closed top-level field set is
// authoritative: schema.ts BLUEPRINT_TOP_LEVEL_FIELDS).
export const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the boot anchor leader of the model-preference-routing smoke row."',
  'members: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

// The closed top-level field set is authoritative (schema.ts
// BLUEPRINT_TOP_LEVEL_FIELDS): revision is REQUIRED; the envelope is
// {allow, deny}; quotas is a {team, members} mapping; the document is
// frontmatter (closed by a `---` delimiter line).
export function savedMainBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${BP_MAIN_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "You are the leader of the model-preference-routing smoke team. You coordinate work for this team."',
    `  modelPreference: deepseek-official/${M_LEADER}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...TEAM_TOOLS.map((t) => `        - ${t}`),
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    'members:',
    '  - templateId: worker',
    '    persona: "You are a worker member of the model-preference-routing smoke team. You carry out delegated work."',
    `    modelPreference: deepseek-official/${M_WORKER}`,
    '  - templateId: expert',
    '    persona: "You are an expert member of the model-preference-routing smoke team. You carry out expert work."',
    `    modelPreference: deepseek-official/${M_EXPERT}`,
    '  - templateId: control',
    '    persona: "You are a control member of the model-preference-routing smoke team (this template declares no modelPreference)."',
    'requirements:',
    '  - domain: persona',
    '    name: standard',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes: []',
    'policyStates:',
    '  - id: default',
    '    description: "MPR main default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 8',
    '    maxConcurrent: 4',
    '  members:',
    '    maxInstances: 8',
    '    maxConcurrent: 4',
    'metadata: {}',
    '---',
  ].join('\n')
}

export function savedRoleBlueprintYaml(bpId, leadModel, workerModel) {
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    '  persona: "You are the leader of a model-preference cross-root smoke team."',
    `  modelPreference: deepseek-official/${leadModel}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...TEAM_TOOLS.map((t) => `        - ${t}`),
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    'members:',
    '  - templateId: worker',
    '    persona: "You are a worker member of a model-preference cross-root smoke team."',
    `    modelPreference: deepseek-official/${workerModel}`,
    'requirements:',
    '  - domain: persona',
    '    name: standard',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes: []',
    'policyStates:',
    '  - id: default',
    '    description: "MPR cross-root default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 8',
    '    maxConcurrent: 4',
    '  members:',
    '    maxInstances: 8',
    '    maxConcurrent: 4',
    'metadata: {}',
    '---',
  ].join('\n')
}

// ── row config + profile-patch seam ────────────────────────────────────────
function teamRowConfig(bootPhase) {
  return {
    rootSessionId: ROOT,
    bootPhase,
    // the row boot anchor's INLINE blueprint source (a YAML string — the
    // validator requires a non-empty string, not an object).
    blueprintSource: BP_ANCHOR_YAML,
    // the saved-source catalog (team.create blueprintId lookup). The files
    // live under the world home (written in preflight).
    blueprintDir: BLUEPRINT_DIR,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: STATIC_MODEL.provider, model: STATIC_MODEL.model },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    // the environment facts the created blueprints' `requirements` need
    // (persona/standard — declared by team.mpr-main / -a / -b).
    environmentFacts: [
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: pathToFileURL(GLUE_PATH).href,
    seamUrl: pathToFileURL(SEAM_PATH).href,
  }
}

// The mcp kit's YAML emitters, verbatim (the row patch is consumed by the
// host's cordis profile-patch parser — byte-identical emission matters).
function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}

function yamlValueLines(value, indent) {
  if (Array.isArray(value)) return value.flatMap((item) => yamlEmitItem(item, indent))
  return Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent))
}

function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    return [`${pad}${key}:`, ...yamlValueLines(value, indent + 1)]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}

function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  if (Array.isArray(item)) {
    if (item.length === 0) return [`${pad}- []`]
    return [`${pad}-`, ...yamlValueLines(item, indent + 1)]
  }
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

function writeTeamPatchFile(patchPath, bootPhase) {
  const lines = [
    '# mpr real-host smoke (modelPreference routing, guide §7 R1–R8) — row rows only',
    '# (the mcp row is NOT mounted: this scenario needs no MCP servers).',
    '# NOTE: the `insert:` entries MUST be a SEQUENCE (the mapping form is',
    '# silently ignored by the profile-patch parser — 0.1.7 upgrade evidence).',
    '# Row config: the world staticModel {provider: deepseek-official, model:',
    '# global-default}; blueprintDir = the world saved blueprints;',
    `# bootPhase = ${bootPhase}; boot root = the legacy anchor ${BP_ANCHOR_ID}.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig(bootPhase) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  mkdirSync(dirname(patchPath), { recursive: true })
  writeFileSync(patchPath, lines.join('\n'))
  return patchPath
}

// ── mock model: the witness (every ACTUAL provider request is recorded) ────
function bodyOf(recordOrBody) {
  if (recordOrBody === null || typeof recordOrBody !== 'object') return null
  return 'body' in recordOrBody ? (recordOrBody.body ?? null) : recordOrBody
}
function msgTexts(m) {
  const c = m?.content
  if (typeof c === 'string') return [c]
  if (Array.isArray(c)) return c.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text)
  return []
}
function lastUserText(body) {
  const msgs = body?.messages ?? []
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const texts = msgTexts(m)
    if (texts.length > 0) return texts.join('\n')
  }
  return ''
}
function anyText(body) {
  const msgs = body?.messages ?? []
  return msgs.map((m) => msgTexts(m).join('\n')).join('\n')
}
function firstText(body) {
  const msgs = body?.messages ?? []
  for (const m of msgs) {
    const texts = msgTexts(m)
    if (texts.length > 0) return texts.join('\n')
  }
  return ''
}
function isTitleSideCall(record) {
  const body = bodyOf(record)
  // 0.1.7 title side-call prompt (session-title-llm/lib/index.js):
  // "Generate the session title from this JSON array of human messages:\n[...]"
  // The older "concise title" phrasing is kept for cross-version tolerance.
  // These side-calls carry the session's messages (including any markers) in
  // their prompt JSON, so marker-based "first work request" lookups MUST
  // exclude them or they race the real work turn.
  return /generate the session title|concise title/i.test(firstText(body))
}
function modelOf(record) {
  return bodyOf(record)?.model ?? null
}

/** The mock `decide`: a deterministic SHORT TEXT ACK keyed on the marker in
 *  the LAST user message carrying a marker (multi-turn-safe); the title
 *  side-call returns neutral text; no tool calls, no errors. */
function decideMock({ req }) {
  const body = bodyOf(req)
  const lastUser = lastUserText(body)
  for (const [mk, ack] of MARKER_ACKS) {
    if (lastUser.includes(mk)) return { kind: 'text', content: ack }
  }
  if (isTitleSideCall(req)) return { kind: 'text', content: ACK_TITLE }
  return { kind: 'text', content: ACK_DEFAULT }
}

async function waitForRequest(mock, predicate, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    for (const r of mock.requests) {
      if (predicate(r)) return r
    }
    if (Date.now() >= deadline) {
      log(`TIMEOUT waiting for: ${what} (requests=${mock.requests.length})`)
      return null
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 250))
  }
}
/** The FIRST recorded actual request whose messages carry the marker. */
function firstRequestWithMarker(mock, marker) {
  return mock.requests.find((r) => anyText(bodyOf(r)).includes(marker)) ?? null
}

// ── host lifecycle (the mcp kit's boot/stop pattern, registry sweep) ───────
const LIVE_HOSTS = new Set()

function makeInstance(port, dshHome, hostTree, logDir) {
  return new DshInstance({ hostTree, dshHome, port, clientCommitHash: CLIENT_COMMIT_HASH, logDir })
}

async function bootHost(bootNum, phase, port, { home, hostTree, logDir } = {}) {
  log(`booting host ${bootNum} (${phase}) on port ${port} …`)
  const inst = makeInstance(port, home, hostTree, logDir)
  let url
  try {
    const r = await inst.start({ timeoutMs: 120_000 })
    url = r.url
  } catch (error) {
    dieFatal(`host ${bootNum} (${phase}) boot failed: ${error.message}`)
  }
  const m = /token=([A-Za-z0-9_-]+)/.exec(url)
  if (m === null) dieFatal(`host ${bootNum}: no token in boot url ${url}`)
  const origin = `http://127.0.0.1:${port}`
  const cookie = await authenticate(origin, m[1])
  if (cookie === null) dieFatal(`host ${bootNum}: authenticate failed`)
  LIVE_HOSTS.add(inst)
  log(`host ${bootNum} up: ${origin} (token cookie acquired)`)
  return { instance: inst, origin, port, cookie, phase, bootNum }
}

async function stopHost(host, label) {
  const port = host.port
  log(`stopping host ${host.bootNum} (${label}) on port ${port} …`)
  LIVE_HOSTS.delete(host.instance)
  const { portFree } = await host.instance.stop()
  if (!portFree) log(`WARNING: port ${port} not free after stop — sweeping live instances`)
  await sweepLiveHosts(port)
  const freed = await waitForPortFree(port, 15_000)
  if (!freed) log(`WARNING: port ${port} still bound after sweep`)
}

/** Kill every instance this kit still holds (the throwaway profile boot
 *  included) and wait for the port to free. */
async function sweepLiveHosts(port) {
  for (const inst of [...LIVE_HOSTS]) {
    try { await inst.stop() } catch { /* already stopped */ }
    LIVE_HOSTS.delete(inst)
  }
  await waitForPortFree(port, 20_000)
}

async function authenticate(origin, token) {
  try {
    const res = await fetch(`${origin}/?token=${encodeURIComponent(token)}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie !== null) {
      const first = setCookie.split(';')[0]
      if (first !== undefined && first.length > 0) return first
    }
    log(`authenticate: no set-cookie (status=${res.status}) — trying once more`)
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 1_500))
    const res2 = await fetch(`${origin}/?token=${encodeURIComponent(token)}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const setCookie2 = res2.headers.get('set-cookie')
    if (setCookie2 !== null) {
      const first2 = setCookie2.split(';')[0]
      if (first2 !== undefined && first2.length > 0) return first2
    }
    return null
  } catch {
    return null
  }
}

// ── HTTP seams (p6t6 observability + team-remote) ──────────────────────────
async function fetchJson(url, options = {}, timeoutMs = 30_000) {
  let res
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    const message = error && error.name === 'TimeoutError' ? `timeout after ${timeoutMs}ms` : String(error?.message ?? error)
    const err = new Error(`fetch ${url} failed: ${message}`)
    err.fatalNetwork = true
    throw err
  }
  let body = null
  const text = await res.text()
  if (text.length > 0) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { raw: text }
    }
  }
  return { status: res.status, body }
}

async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, { method: 'GET' }, 30_000)
}

/** The p6t6 health route (registered on BOTH success and setup-failure —
 *  the failure route carries `setupError`). Used for fail-fast readiness. */
async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, { method: 'GET' }, 10_000)
}

async function p6t6StateReady(port, rootSessionId, bootPhase, timeoutMs = 300_000) {
  const deadline = Date.now() + timeoutMs
  let last = null
  for (;;) {
    try {
      // fail-fast: a settled setup failure reports setupError on the health
      // route (and in <HOME>/setup-failure.json) — no point polling 180s.
      try {
        const health = await p6t6Health(port)
        if (health.body?.ok === false || health.body?.setupError !== undefined) {
          dieFatal(`p6t6 row setup failed: ${JSON.stringify(health.body?.setupError ?? health.body?.error ?? health.body).slice(0, 800)}`)
        }
      } catch { /* health not up yet — keep polling */ }
      const { status, body } = await p6t6State(port)
      last = body
      // the state route is registered ONLY after the row settles (a settled
      // setup failure exposes the failure health route instead and the state
      // route 404s) — a 200 with the expected identity IS readiness.
      if (status === 503 || body?.setupError !== undefined) {
        dieFatal(`p6t6 row setup failed (status=${status}): ${JSON.stringify(body?.setupError ?? body?.error ?? body).slice(0, 800)}`)
      }
      if (status === 200 && body?.rootSessionId === rootSessionId && body?.phase === bootPhase && body?.governance !== undefined) return body
    } catch { /* retry */ }
    if (Date.now() >= deadline) {
      dieFatal(`p6t6 readiness not reached in ${timeoutMs}ms (want root=${rootSessionId} phase=${bootPhase}; last state=${JSON.stringify(last)?.slice(0, 400)})`)
    }
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 1_000))
  }
}

/** The p6t6 row reads its run directive from <DSH_HOME>/p6t6-directive.json
 *  (boot number 1-4 + phase + reportDir + rootSessionId — required by
 *  readDirective; written before EVERY boot, the mcp kit pattern). */
function writeP6t6Directive(boot, phase) {
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot,
    phase,
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: ROOT,
  }, null, 2))
}

async function p6t6Tool(host, name, args, as, callId, timeoutMs = 240_000) {
  return fetchJson(`${host.origin}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as, callId }),
  }, timeoutMs)
}

/** The p6t6 tool response's `value` (dieFatal on a degraded execution). */
function toolValue(response, tag) {
  const { body } = response
  if (body?.ok !== true) {
    dieFatal(`p6t6 tool ${tag} degraded: ${JSON.stringify(body ?? response).slice(0, 600)}`)
  }
  return body.value
}

async function remoteCall(origin, cookie, method, params, tag = 'mpr', version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
  }, 240_000)
}

/**
 * remoteCall + the 0.1.7 MOUNT-BEFORE-BOOT readiness gate: while the live
 * boot settles, non-catalog methods are refused with `runtime-not-ready`
 * BEFORE the handler (nothing durable; retry-safe). 5s backoff, 120s budget.
 */
async function remoteCallReady(host, method, params, tag = 'mpr') {
  const notes = []
  const deadline = Date.now() + 120_000
  for (let attempt = 1; ; attempt += 1) {
    let res
    try {
      res = await remoteCall(host.origin, host.cookie, method, params, `${tag}${attempt}`)
    } catch (error) {
      if (error?.fatalNetwork === true) dieFatal(`remote ${method} network failure: ${error.message}`)
      throw error
    }
    const err = res?.body?.result?.error
    if (res?.body?.result?.ok === true || err === undefined) return { res, notes }
    notes.push({ attempt, code: err?.code ?? null, reason: err?.details?.reason ?? null, message: String(err?.message ?? '').slice(0, 200) })
    if (err?.details?.reason !== 'runtime-not-ready' || Date.now() >= deadline) return { res, notes }
    log(`remote ${method} attempt ${attempt}: runtime-not-ready — waiting 5s for the live boot`)
    await new Promise((resolveSleep) => setTimeout(resolveSleep, 5_000))
  }
}

async function stableProbe(urls) {
  const out = []
  for (const url of urls) {
    let status = null
    let error = null
    try {
      const res = await fetch(url, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(5_000) })
      status = res.status
      await res.body?.cancel()
    } catch (e) {
      error = String(e?.cause?.code ?? e?.message ?? e).slice(0, 80)
    }
    out.push({ url, status, error })
  }
  return out
}

// ── team helpers ───────────────────────────────────────────────────────────
/** One shipped team-tool execution on the agent bound to `as` (the p6t6
 *  seam — the same sanctioned surface the mcp kit drives). */
async function teamTool(host, toolName, args, as, tag) {
  const callId = `${tag}-${Math.random().toString(36).slice(2, 10)}`
  const res = await p6t6Tool(host, toolName, args, as, callId)
  writeEvidence('tools', `${tag}.json`, res)
  return { res, value: toolValue(res, `${toolName} ${tag}`) }
}

async function listMembers(host, rootSessionId, tag) {
  const { value } = await teamTool(host, 'team_list_members', {
    rootSessionId,
    requestToken: `tok-${tag}-${Math.random().toString(36).slice(2, 10)}`,
  }, rootSessionId, tag)
  const members = value?.effect?.members
  if (!Array.isArray(members)) dieFatal(`team_list_members ${tag}: unexpected effect ${JSON.stringify(value).slice(0, 400)}`)
  return members
}

function memberByLabel(members, label) {
  return members.find((m) => m.label === label) ?? null
}

/** team.create v1 (create + initialWork in one call — the 0.1.7 readiness
 *  gate handles the mount-before-boot window). */
async function createTeam(host, rootSessionId, blueprintId, prompt, tag) {
  const { res, notes } = await remoteCallReady(host, 'team.create', {
    rootSessionId,
    blueprintId,
    initialWork: { prompt },
  }, tag)
  writeEvidence('teams', `${tag}-create.json`, { res, readinessNotes: notes })
  const result = res?.body?.result
  if (result?.ok !== true) {
    dieFatal(`team.create ${tag} failed: ${JSON.stringify(result?.error ?? res).slice(0, 500)}`)
  }
  return { res, notes, value: result.value }
}

// ── pre/post hygiene ───────────────────────────────────────────────────────
async function checkPristine(phase) {
  const state = await captureGitState(TESTUSE, LOG_DIR)
  writeEvidence(phase === 'pre' ? 'pre' : 'post', `git-${phase}.json`, state)
  if (state.errors.length > 0) log(`git ${phase} warnings: ${state.errors.join('; ')}`)
  if (phase === 'pre') {
    if (state.head !== HOST_BASELINE_SHA) {
      dieFatal(`test-use HEAD is ${state.head} (expected ${HOST_BASELINE_SHA}) — refusing to run on the wrong baseline`)
    }
    if (!state.statusEmpty) {
      dieFatal(`test-use is NOT pristine before the run:\n${state.status}`)
    }
    log(`pre: test-use pristine @ ${HOST_BASELINE_SHA.slice(0, 10)} (HEAD source: ${state.headSource})`)
    return state
  }
  return state
}

function verifyWorktree() {
  for (const p of [PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH, P6T6_ROW_PATH, join(WORKTREE, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')]) {
    if (!existsSync(p)) dieFatal(`worktree artifact missing: ${p}`)
  }
  log(`worktree artifacts present (row ${PRODUCTION_ROW_PATH})`)
}

function assertFreshHome() {
  if (existsSync(HOME)) dieFatal(`HOME already exists (refusing to reuse a stale world): ${HOME}`)
  mkdirSync(HOME, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  mkdirSync(LOG_DIR, { recursive: true })
  mkdirSync(RUN_DIR, { recursive: true })
}

async function pickHostPort() {
  if (ARGS.hostPort !== undefined) {
    const p = Number(ARGS.hostPort)
    if (!Number.isInteger(p) || p < 3181 || p > 3186) dieFatal(`--host-port must be in 3181..3186, got ${ARGS.hostPort}`)
    if (await portInUse(p)) dieFatal(`port ${p} already in use — pick another with --host-port`)
    return p
  }
  for (const p of HOST_PORT_CANDIDATES) {
    if (!(await portInUse(p))) return p
  }
  dieFatal('no free host port in 3181..3186 — aborting')
  return HOST_PORT_CANDIDATES[0]
}

// ── run ────────────────────────────────────────────────────────────────────
let MOCK = null
let STABLE_PRE = null
let GIT_PRE = null
let HOST1 = null
let HOST2 = null
let HOST_PORT_ACTUAL = null

async function run() {
  LOG_PATH = join(RUN_DIR, 'run.log')
  log(`model-preference-routing real-host smoke (guide §7 R1–R8) — RUN_STAMP=${RUN_STAMP}`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${TESTUSE}`)
  log(`home (DSH_HOME)=${HOME}`)
  log(`run dir=${RUN_DIR}`)

  // ── preflight ────────────────────────────────────────────────────────────
  verifyWorktree()

  const hostPort = await pickHostPort()
  HOST_PORT_ACTUAL = hostPort
  if (await portInUse(MOCK_PORT)) dieFatal(`port ${MOCK_PORT} already in use — refusing to run`)
  log(`ports: host=${hostPort} mock=${MOCK_PORT} (both free; :3080/:3180 never bound)`)

  assertFreshHome() // the world dirs (logs/blueprints) must exist BEFORE any
                    // evidence/git-state write lands in them

  STABLE_PRE = await stableProbe(STABLE_URLS)
  writeEvidence('pre', 'stable-pre.json', STABLE_PRE)
  log(`pre: stable-instance probe (read-only, zero-touch): ${JSON.stringify(STABLE_PRE)}`)
  GIT_PRE = await checkPristine('pre')

  // world blueprints (the row's blueprintDir + the anchor inline).
  writeFileSync(join(BLUEPRINT_DIR, 'mpr-main.yaml'), savedMainBlueprintYaml())
  writeFileSync(join(BLUEPRINT_DIR, 'mpr-a.yaml'), savedRoleBlueprintYaml(BP_A_ID, M_A_LEAD, M_A))
  writeFileSync(join(BLUEPRINT_DIR, 'mpr-b.yaml'), savedRoleBlueprintYaml(BP_B_ID, M_B_LEAD, M_B))
  log(`blueprints written: ${BP_MAIN_ID}, ${BP_A_ID}, ${BP_B_ID} (+ inline anchor ${BP_ANCHOR_ID})`)

  // the mock model (the witness) — started BEFORE any host boot.
  MOCK = await startMockModel({
    port: MOCK_PORT,
    decide: decideMock,
    log: (msg) => log(`mock: ${msg}`),
  })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK.port}`
  process.env.DEEPSEEK_API_KEY = 'mpr-smoke-key'
  log(`mock model on ${MOCK.port}; DEEPSEEK_BASE_URL set`)

  // ensure the web profile exists (one throwaway boot on the first
  // candidate port — the mcp kit pattern).
  {
    const probeInst = makeInstance(hostPort, HOME, TESTUSE, LOG_DIR)
    LIVE_HOSTS.add(probeInst) // so a failed throwaway boot is still swept
    const prof = await ensureProfile({ instance: probeInst, log: (m) => log(`profile: ${m}`) })
    if (prof.created) log('profile initialized by the throwaway boot')
    LIVE_HOSTS.delete(probeInst)
    await waitForPortFree(hostPort, 20_000)
  }

  // ── boot 1 (phase create) ────────────────────────────────────────────────
  writeTeamPatchFile(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), 'create')
  writeP6t6Directive(1, 'create')
  HOST1 = await bootHost(1, 'create', hostPort, { home: HOME, hostTree: TESTUSE, logDir: LOG_DIR })

  // the dump-config guard: the composed tree MUST carry our row + row config
  // (the profile-patch parser silently ignores the WRONG `insert:` shape —
  // this is the documented 0.1.7 pitfall; verifying the row actually carries
  // our blueprints/staticModel).
  {
    const dump = await HOST1.instance.dumpConfig()
    writeFileSync(join(RUN_DIR, 'dump-config-boot1.log'), dump.text)
    const rowOk = DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME })
      && DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_ROW_NAME })
    // the row config the composed tree must carry (the anchor blueprint is
    // INLINE in the row; team.mpr-main/a/b live in the saved files the row's
    // blueprintDir points at — verified on disk below, not in the dump).
    const configCarried = dump.text.includes(`rootSessionId: ${ROOT}`)
      && dump.text.includes(`bootPhase: create`)
      && dump.text.includes(`blueprintId: ${BP_ANCHOR_ID}`)
      && dump.text.includes(`model: ${STATIC_MODEL.model}`)
      && dump.text.includes(BLUEPRINT_DIR)
    const savedBps = [
      [join(BLUEPRINT_DIR, 'mpr-main.yaml'), BP_MAIN_ID],
      [join(BLUEPRINT_DIR, 'mpr-a.yaml'), BP_A_ID],
      [join(BLUEPRINT_DIR, 'mpr-b.yaml'), BP_B_ID],
    ]
    const savedOk = savedBps.every(([p, id]) => existsSync(p) && readFileSync(p, 'utf8').includes(`blueprintId: ${id}`))
    if (!rowOk || !configCarried || !savedOk) {
      dieFatal(`dump-config: the row is NOT carrying our config (rowOk=${rowOk} configCarried=${configCarried} savedOk=${savedOk}) — the profile-patch insert shape was likely ignored; see dump-config-boot1.log`)
    }
    log('dump-config: the row carries the production+p6t6 rows AND our anchor/staticModel/blueprintDir (insert-sequence shape verified); the 3 saved blueprints exist on disk')
  }

  await p6t6StateReady(HOST1.port, ROOT, 'create')
  log('p6t6 ready (boot 1, phase=create) — the live boot settled')

  const created = {}

  // ── R1: team.create + leader initialWork (zero-seed) ─────────────────────
  log('── R1: team.create (T1) + leader initialWork ──')
  {
    const createRes = await createTeam(HOST1, ROOT_T1, BP_MAIN_ID, `${MK_LEADER} You are the leader. Your first task: acknowledge your role.`, 'r1-t1')
    created.t1 = createRes.value
    // the remote value is {data: {path, durable, bind}} (normalizeTeamCreateValue).
    check('R1', 'team.create v1 (T1) succeeds on a fresh root (data.path=fresh-root)',
      createRes.value?.data?.path === 'fresh-root', `value=${JSON.stringify(createRes.value ?? null).slice(0, 300)}`)

    const leaderReq = await waitForRequest(MOCK, (r) => anyText(bodyOf(r)).includes(MK_LEADER) && !isTitleSideCall(r), 180_000, 'the R1 leader first LLM request (marker ' + MK_LEADER + ')')
    writeEvidence('r1', 'leader-first-request.json', leaderReq === null ? null : { seq: leaderReq.seq, model: modelOf(leaderReq), reply: leaderReq.reply?.content ?? null })
    check('R1', "the leader's FIRST LLM request body.model === 'role-leader' (NOT the staticModel baseline 'global-default')",
      leaderReq !== null && modelOf(leaderReq) === M_LEADER,
      leaderReq === null ? 'no request with the marker' : `model=${modelOf(leaderReq)}`)

    // the leader's model-facing surface carries the team tool set (the
    // template's teamTools allow list materialized — evidence that the
    // bound blueprint drove the surface, not the row anchor).
    const leaderTools = (bodyOf(leaderReq)?.tools ?? []).map((t) => t?.function?.name ?? t?.name ?? null).filter((n) => n !== null)
    check('R1', 'the leader model surface carries the 13 team_ tools of the template allow list (the bound blueprint, not the legacy anchor)',
      leaderReq !== null && TEAM_TOOLS.every((t) => leaderTools.includes(t)),
      `teamTools=${leaderTools.filter((t) => t.startsWith('team_')).length}/${TEAM_TOOLS.length} surface=${leaderTools.length}`)

    const state = await p6t6State(HOST1.port)
    writeEvidence('r1', 'state.json', state.body)
    const overrides = state.body?.governance?.overrides
    check('R1', 'zero-seed proof: governance override rows = 0 at that point (no override anywhere before team work)',
      Array.isArray(overrides) && overrides.length === 0, `overrides=${JSON.stringify(overrides ?? null).slice(0, 300)}`)
    finishCriterion('R1')
  }

  // ── R2: direct team_delegate create+work (THE defect closure) ────────────
  log('── R2: leader DIRECTLY team_delegate(worker) — no create+override+follow-up ──')
  let wDeleg = null
  {
    const before = MOCK.requests.length
    const { value } = await teamTool(HOST1, 'team_delegate', {
      rootSessionId: ROOT_T1,
      requestToken: `tok-r2-deleg-${Math.random().toString(36).slice(2, 10)}`,
      delegationTemplateId: 'worker',
      label: 'w-deleg',
      prompt: `${MK_W_DELEG} Worker task: acknowledge your role and finish.`,
    }, ROOT_T1, 'r2-deleg')
    const effect = value?.effect
    wDeleg = effect?.instanceId ?? null
    // The delegate CREATE+WORK form's terminal effect keeps kind
    // 'member-activated' (the creation is the headline) and carries the
    // settled work chain on it (workSettled + memberResult) — source:
    // action-router/effects.ts runDelegate (R1 closure plan §16.2).
    check('R2', 'team_delegate(delegationTemplateId=worker) resolves as ONE member-activated effect with the SETTLED work chain embedded (workSettled + memberResult — the create+work form; no team_create_member + override.set + team_follow_up sequence)',
      effect?.kind === 'member-activated' && typeof wDeleg === 'string' && effect.workSettled === true && effect.memberResult?.status === 'succeeded',
      `effect=${JSON.stringify(effect ?? null).slice(0, 400)}`)

    const workerReq = await waitForRequest(MOCK, (r) => anyText(bodyOf(r)).includes(MK_W_DELEG) && !isTitleSideCall(r), 180_000, 'the R2 worker first LLM request (marker ' + MK_W_DELEG + ')')
    writeEvidence('r2', 'worker-first-request.json', workerReq === null ? null : { seq: workerReq.seq, model: modelOf(workerReq), reply: workerReq.reply?.content ?? null, from: before })
    check('R2', "the worker's FIRST LLM request body.model === 'role-worker' (the direct delegation created the member AND routed it to the Blueprint model — THE defect closure)",
      workerReq !== null && modelOf(workerReq) === M_WORKER,
      workerReq === null ? 'no request with the marker' : `model=${modelOf(workerReq)}`)

    const ovGet = await remoteCallReady(HOST1, 'override.get', {
      teamSessionId: ROOT_T1,
      capability: 'model',
      scope: 'instance',
      targetInstanceId: wDeleg,
    }, 'r2-ovget')
    writeEvidence('r2', 'override-get.json', ovGet.res)
    // override.get → {data: {override}} — unwrap the data envelope so the
    // null-check is real (a shape miss would pass vacuously).
    const ov = ovGet.res?.body?.result?.value?.data?.override
    check('R2', 'NO governance override record exists for the worker after the direct delegation (the route is template-static, not record-backed)',
      ovGet.res?.body?.result?.ok === true && (ov === null || ov === undefined),
      `override=${JSON.stringify(ov ?? null).slice(0, 300)}`)
    finishCriterion('R2')
  }

  // ── R3: explicit create (no substantive turn) + follow-up ────────────────
  log('── R3: team_create_member(worker) → no substantive turn → team_follow_up ──')
  let wCreate = null
  let wCreateChild = null
  {
    const { value } = await teamTool(HOST1, 'team_create_member', {
      rootSessionId: ROOT_T1,
      requestToken: `tok-r3-create-${Math.random().toString(36).slice(2, 10)}`,
      delegationTemplateId: 'worker',
      label: 'w-create',
    }, ROOT_T1, 'r3-create')
    const effect = value?.effect
    wCreate = effect?.instanceId ?? null
    wCreateChild = effect?.childSessionId ?? null
    check('R3', 'team_create_member(worker) activates the instance (member-activated effect)',
      effect?.kind === 'member-activated' && typeof wCreate === 'string' && typeof wCreateChild === 'string',
      `effect=${JSON.stringify(effect ?? value).slice(0, 300)}`)

    // create alone must NOT trigger a substantive worker model turn.
    const reqCountAfterCreate = MOCK.requests.length
    const stray = MOCK.requests.filter((r) => anyText(bodyOf(r)).includes(MK_W_CREATE))
    check('R3', 'create ALONE did not deliver a substantive worker turn (no request carrying the follow-up marker exists yet)',
      stray.length === 0, `stray=${stray.length}`)

    const follow = await teamTool(HOST1, 'team_follow_up', {
      rootSessionId: ROOT_T1,
      requestToken: `tok-r3-follow-${Math.random().toString(36).slice(2, 10)}`,
      targetInstanceId: wCreate,
      prompt: `${MK_W_CREATE} Follow-up worker task: acknowledge and finish.`,
    }, ROOT_T1, 'r3-followup')
    const followEffect = follow.value?.effect
    check('R3', 'team_follow_up(w-create) resolves settled (the work unit ran on the follow-up)',
      followEffect?.kind === 'work-admitted' && followEffect.settled === true,
      `effect=${JSON.stringify(followEffect ?? follow.value).slice(0, 300)}`)

    const workerReq = await waitForRequest(MOCK, (r) => anyText(bodyOf(r)).includes(MK_W_CREATE) && !isTitleSideCall(r), 180_000, 'the R3 worker first (follow-up) LLM request (marker ' + MK_W_CREATE + ')')
    writeEvidence('r3', 'worker-first-request.json', workerReq === null ? null : { seq: workerReq.seq, model: modelOf(workerReq), reply: workerReq.reply?.content ?? null })
    check('R3', "the worker's first (follow-up) LLM request body.model === 'role-worker'",
      workerReq !== null && modelOf(workerReq) === M_WORKER,
      workerReq === null ? 'no request with the marker' : `model=${modelOf(workerReq)}`)

    // the window between create and the follow-up request: only title
    // side-calls are legal (NO substantive worker model turn on create).
    const windowReqs = MOCK.requests.slice(reqCountAfterCreate, workerReq === null ? MOCK.requests.length : MOCK.requests.indexOf(workerReq) + 1)
    const unexplained = windowReqs.filter((r) => !anyText(bodyOf(r)).includes(MK_W_CREATE) && !isTitleSideCall(r))
    writeEvidence('r3', 'create-window.json', { reqCountAfterCreate, window: windowReqs.map((r) => { const b = bodyOf(r); return { seq: r.seq, model: modelOf(r), firstText: firstText(b).slice(0, 200), title: isTitleSideCall(r) } }) })
    check('R3', 'no SUBSTANTIVE worker model turn between create and follow-up (every new request in the window is the follow-up itself or a title side-call)',
      unexplained.length === 0,
      `unexplained=${JSON.stringify(unexplained.map((r) => ({ seq: r.seq, model: modelOf(r), first: firstText(bodyOf(r)).slice(0, 160) }))).slice(0, 600)}`)
    finishCriterion('R3')
  }

  // ── R6: projection agreement (on the w-create worker, pre-override) ──────
  log('── R6: projection agreement (actual body.model == effectiveConfig == modelState) ──')
  {
    const actualReq = firstRequestWithMarker(MOCK, MK_W_CREATE)
    const actualModel = modelOf(actualReq)
    const { res } = await remoteCallReady(HOST1, 'team.getProjection', { teamSessionId: ROOT_T1 }, 'r6-projection')
    // the remote value is {data: {projection}} (team.getProjection handler).
    const projection = res?.body?.result?.value?.data?.projection
    const member = projection?.members?.find((m) => m.instanceId === wCreate) ?? null
    writeEvidence('r6', 'projection.json', { projection, member })
    check('R6', 'team.getProjection carries the member row with effectiveConfig + modelState lanes',
      projection !== null && member !== null && member.effectiveConfig !== undefined && member.modelState !== undefined,
      `member=${JSON.stringify(member ?? null).slice(0, 300)}`)
    const eff = member?.effectiveConfig?.model
    const ms = member?.modelState
    const effValue = typeof eff?.value === 'string' ? eff.value : null
    const msValue = typeof ms?.current?.value === 'string' ? ms.current.value : null
    const expectedQualified = `deepseek-official/${M_WORKER}`
    check('R6', `effectiveConfig.model.value === '${expectedQualified}' (source 'member-template', state 'inherited')`,
      effValue === expectedQualified && eff?.source === 'member-template' && eff?.state === 'inherited',
      `model=${JSON.stringify(eff ?? null).slice(0, 300)}`)
    check('R6', `modelState.current.value === '${expectedQualified}' with static template provenance (layer 'template', origin 'static', recordId null)`,
      msValue === expectedQualified && ms?.current?.source === 'member-template'
      && ms?.provenance?.layer === 'template' && ms?.provenance?.origin === 'static' && ms?.provenance?.recordId === null,
      `current=${JSON.stringify(ms?.current ?? null).slice(0, 300)} provenance=${JSON.stringify(ms?.provenance ?? null).slice(0, 300)}`)
    check('R6', 'ACTUAL provider request body.model agrees with the projections (the three-way agreement: body.model == effectiveConfig.model.value == modelState.current.value)',
      actualModel === M_WORKER && effValue !== null && msValue !== null
      && effValue.split('/').slice(1).join('/') === actualModel && msValue.split('/').slice(1).join('/') === actualModel
      && effValue.split('/')[0] === 'deepseek-official',
      `actual=${actualModel} eff=${effValue} modelState=${msValue}`)
    const state = await p6t6State(HOST1.port)
    writeEvidence('r6', 'p6t6-state.json', state.body?.governance ?? state.body)
    const liveModel = state.body?.governance?.sessions?.[wCreateChild]?.model
    check('R6', 'the LIVE p6t6 state agrees too (governance.sessions[<child>].model.current == {provider: deepseek-official, model: role-worker})',
      liveModel?.current?.provider === 'deepseek-official' && liveModel?.current?.model === M_WORKER,
      `liveModel=${JSON.stringify(liveModel ?? null).slice(0, 300)}`)
    finishCriterion('R6')
  }

  // ── R4: durable human override beats the template-static route ───────────
  log('── R4: durable human model override on the R2 worker (next request boundary) ──')
  {
    const ovPre = await remoteCallReady(HOST1, 'override.get', {
      teamSessionId: ROOT_T1, capability: 'model', scope: 'instance', targetInstanceId: wDeleg,
    }, 'r4-ovpre')
    writeEvidence('r4', 'override-get-pre.json', ovPre.res)
    const ovPreVal = ovPre.res?.body?.result?.value?.data?.override
    check('R4', 'pre-write: NO override record for the worker (the template static route created no synthetic record, after its routed turn)',
      ovPre.res?.body?.result?.ok === true && (ovPreVal === null || ovPreVal === undefined),
      `override=${JSON.stringify(ovPreVal ?? null).slice(0, 300)}`)

    const ovSet = await remoteCallReady(HOST1, 'override.set', {
      teamSessionId: ROOT_T1,
      capability: 'model',
      value: { kind: 'allow', items: [QUALIFIED_OVR] },
      actor: { kind: 'human' },
      scope: 'instance',
      targetInstanceId: wDeleg,
    }, 'r4-ovset')
    writeEvidence('r4', 'override-set.json', ovSet.res)
    // override.set → {data: <record>} (evidence-verified: the record object
    // IS value.data — no .record wrapper on the wire).
    const setRecord = ovSet.res?.body?.result?.value?.data
    check('R4', 'the durable HUMAN override.set (model allow deepseek-official/override-worker, instance scope) is admitted with a recordId',
      ovSet.res?.body?.result?.ok === true && typeof setRecord?.recordId === 'string',
      `record=${JSON.stringify(setRecord ?? ovSet.res?.body?.result).slice(0, 300)}`)

    const ovPost = await remoteCallReady(HOST1, 'override.get', {
      teamSessionId: ROOT_T1, capability: 'model', scope: 'instance', targetInstanceId: wDeleg,
    }, 'r4-ovpost')
    writeEvidence('r4', 'override-get-post.json', ovPost.res)
    const ovPostVal = ovPost.res?.body?.result?.value?.data?.override
    const postModel = ovPostVal?.values?.model
    check('R4', 'post-write: EXACTLY the human override exists for the worker (the override row count reflects only the real human override — no synthetic record from the template static route)',
      ovPost.res?.body?.result?.ok === true && ovPostVal !== null && ovPostVal !== undefined
      && ovPostVal.recordId === setRecord?.recordId
      && postModel?.kind === 'allow' && Array.isArray(postModel?.items)
      && postModel.items.length === 1 && postModel.items[0] === QUALIFIED_OVR,
      `override=${JSON.stringify(ovPostVal ?? null).slice(0, 300)}`)

    // the state must show the override PENDING at the next request boundary
    // (the live consumption state for the worker's child session).
    const wDelegMembers = await listMembers(HOST1, ROOT_T1, 'r4-members')
    const wDelegRow = wDelegMembers.find((m) => m.instanceId === wDeleg) ?? null
    const state = await p6t6State(HOST1.port)
    writeEvidence('r4', 'state-pending.json', state.body?.governance ?? state.body)
    // pendingNextBoundary is an ARRAY of pending record objects (the live
    // consumption view: [{recordId, kind, scope, values, generation, ...}]).
    const pending = state.body?.governance?.sessions?.[wDelegRow?.childSessionId]?.model?.pendingNextBoundary
    const pendingEntry = Array.isArray(pending) ? pending[0] : null
    check('R4', 'the live state shows the override PENDING at the next request boundary (record-backed, awaiting the boundary)',
      Array.isArray(pending) && pending.length === 1 && pendingEntry?.recordId === setRecord?.recordId
      && pendingEntry?.values?.model?.kind === 'allow' && Array.isArray(pendingEntry?.values?.model?.items)
      && pendingEntry.values.model.items.includes(QUALIFIED_OVR),
      `pending=${JSON.stringify(pending ?? null).slice(0, 300)} child=${wDelegRow?.childSessionId}`)

    const follow = await teamTool(HOST1, 'team_follow_up', {
      rootSessionId: ROOT_T1,
      requestToken: `tok-r4-follow-${Math.random().toString(36).slice(2, 10)}`,
      targetInstanceId: wDeleg,
      prompt: `${MK_W_OVR} Post-override worker task: acknowledge and finish.`,
    }, ROOT_T1, 'r4-followup')
    const followEffect = follow.value?.effect
    check('R4', 'team_follow_up(w-deleg) after the override resolves settled (the NEXT request boundary)',
      followEffect?.kind === 'work-admitted' && followEffect.settled === true,
      `effect=${JSON.stringify(followEffect ?? follow.value).slice(0, 300)}`)

    const nextReq = await waitForRequest(MOCK, (r) => anyText(bodyOf(r)).includes(MK_W_OVR) && !isTitleSideCall(r), 180_000, 'the R4 worker next LLM request (marker ' + MK_W_OVR + ')')
    writeEvidence('r4', 'worker-next-request.json', nextReq === null ? null : { seq: nextReq.seq, model: modelOf(nextReq), reply: nextReq.reply?.content ?? null })
    check('R4', "the worker's NEXT LLM request (after the durable human override) body.model === 'override-worker' (the record-backed layer beats the template-static route)",
      nextReq !== null && modelOf(nextReq) === M_OVR,
      nextReq === null ? 'no request with the marker' : `model=${modelOf(nextReq)}`)
    finishCriterion('R4')
  }

  // ── R5 (pre): expert turn BEFORE the host restart ────────────────────────
  log('── R5 (pre): expert follow-up → role-expert (ZERO model override) ──')
  let expertId = null
  let expertChild = null
  {
    const { value } = await teamTool(HOST1, 'team_create_member', {
      rootSessionId: ROOT_T1,
      requestToken: `tok-r5-expert-${Math.random().toString(36).slice(2, 10)}`,
      delegationTemplateId: 'expert',
      label: 'expert-pre',
    }, ROOT_T1, 'r5-expert-create')
    expertId = value?.effect?.instanceId ?? null
    expertChild = value?.effect?.childSessionId ?? null
    if (typeof expertId !== 'string' || typeof expertChild !== 'string') {
      dieFatal(`R5: expert activation failed: ${JSON.stringify(value).slice(0, 400)}`)
    }
    const ovPre = await remoteCallReady(HOST1, 'override.get', {
      teamSessionId: ROOT_T1, capability: 'model', scope: 'instance', targetInstanceId: expertId,
    }, 'r5-ovpre')
    writeEvidence('r5', 'override-get-expert-pre.json', ovPre.res)
    const ovPreVal = ovPre.res?.body?.result?.value?.data?.override
    check('R5', 'the expert member has ZERO model overrides (its route is purely template-static)',
      ovPre.res?.body?.result?.ok === true && (ovPreVal === null || ovPreVal === undefined),
      `override=${JSON.stringify(ovPreVal ?? null).slice(0, 300)}`)

    await teamTool(HOST1, 'team_follow_up', {
      rootSessionId: ROOT_T1,
      requestToken: `tok-r5-follow-pre-${Math.random().toString(36).slice(2, 10)}`,
      targetInstanceId: expertId,
      prompt: `${MK_EXPERT_PRE} Expert task (pre-restart): acknowledge and finish.`,
    }, ROOT_T1, 'r5-expert-follow-pre')
    const preReq = await waitForRequest(MOCK, (r) => anyText(bodyOf(r)).includes(MK_EXPERT_PRE) && !isTitleSideCall(r), 180_000, 'the R5 expert pre-restart LLM request (marker ' + MK_EXPERT_PRE + ')')
    writeEvidence('r5', 'expert-pre-request.json', preReq === null ? null : { seq: preReq.seq, model: modelOf(preReq), reply: preReq.reply?.content ?? null })
    check('R5', "BEFORE restart: the expert's LLM request body.model === 'role-expert'",
      preReq !== null && modelOf(preReq) === M_EXPERT,
      preReq === null ? 'no request with the marker' : `model=${modelOf(preReq)}`)

    // record the durable session logs (the cold-resume eligibility facts).
    const sessionsTree = listSessionFiles(HOME)
    writeEvidence('r5', 'sessions-before-restart.json', sessionsTree)
    log(`sessions before restart: ${sessionsTree.length} files`)
  }

  // ── R7: fallback control (no modelPreference → global-default) ───────────
  log('── R7: control template (no modelPreference) → global-default ──')
  {
    await teamTool(HOST1, 'team_delegate', {
      rootSessionId: ROOT_T1,
      requestToken: `tok-r7-control-${Math.random().toString(36).slice(2, 10)}`,
      delegationTemplateId: 'control',
      label: 'w-control',
      prompt: `${MK_CONTROL} Control task: acknowledge and finish.`,
    }, ROOT_T1, 'r7-control-deleg')
    const controlReq = await waitForRequest(MOCK, (r) => anyText(bodyOf(r)).includes(MK_CONTROL) && !isTitleSideCall(r), 180_000, 'the R7 control first LLM request (marker ' + MK_CONTROL + ')')
    writeEvidence('r7', 'control-first-request.json', controlReq === null ? null : { seq: controlReq.seq, model: modelOf(controlReq), reply: controlReq.reply?.content ?? null })
    check('R7', "the control member (NO modelPreference) LLM request body.model === 'global-default' (the staticModel baseline — backward compatibility locked)",
      controlReq !== null && modelOf(controlReq) === M_GLOBAL,
      controlReq === null ? 'no request with the marker' : `model=${modelOf(controlReq)}`)
    finishCriterion('R7')
  }

  // ── R8: cross-root (two blueprints on the same row) ──────────────────────
  log('── R8: cross-root — Team A (role-a) vs Team B (role-b) on the same row ──')
  {
    const createA = await createTeam(HOST1, ROOT_TA, BP_A_ID, `${MK_A_LEAD} Team A leader: acknowledge and finish.`, 'r8-ta')
    created.ta = createA.value
    check('R8', 'team.create (Team A, Blueprint A) succeeds on the SAME row (fresh-root)',
      createA.value?.data?.path === 'fresh-root', `value=${JSON.stringify(createA.value ?? null).slice(0, 200)}`)
    const leadA = await waitForRequest(MOCK, (r) => anyText(bodyOf(r)).includes(MK_A_LEAD) && !isTitleSideCall(r), 180_000, 'the R8 Team A leader LLM request (marker ' + MK_A_LEAD + ')')
    writeEvidence('r8', 'ta-leader-first-request.json', leadA === null ? null : { seq: leadA.seq, model: modelOf(leadA) })
    check('R8', `Team A leader first request body.model === '${M_A_LEAD}'`,
      leadA !== null && modelOf(leadA) === M_A_LEAD, leadA === null ? 'no request' : `model=${modelOf(leadA)}`)

    await teamTool(HOST1, 'team_delegate', {
      rootSessionId: ROOT_TA,
      requestToken: `tok-r8-a-deleg-${Math.random().toString(36).slice(2, 10)}`,
      delegationTemplateId: 'worker',
      label: 'w-a',
      prompt: `${MK_A_WORKER} Team A worker task: acknowledge and finish.`,
    }, ROOT_TA, 'r8-a-deleg')
    const workerA = await waitForRequest(MOCK, (r) => anyText(bodyOf(r)).includes(MK_A_WORKER) && !isTitleSideCall(r), 180_000, 'the R8 Team A worker LLM request (marker ' + MK_A_WORKER + ')')
    writeEvidence('r8', 'ta-worker-first-request.json', workerA === null ? null : { seq: workerA.seq, model: modelOf(workerA) })
    check('R8', "Team A's worker request body.model === 'role-a' (NOT role-b — no cross-root leak)",
      workerA !== null && modelOf(workerA) === M_A && modelOf(workerA) !== M_B,
      workerA === null ? 'no request' : `model=${modelOf(workerA)}`)

    const createB = await createTeam(HOST1, ROOT_TB, BP_B_ID, `${MK_B_LEAD} Team B leader: acknowledge and finish.`, 'r8-tb')
    created.tb = createB.value
    check('R8', 'team.create (Team B, Blueprint B) succeeds on the SAME row (fresh-root, independent of Team A)',
      createB.value?.data?.path === 'fresh-root', `value=${JSON.stringify(createB.value ?? null).slice(0, 200)}`)
    const leadB = await waitForRequest(MOCK, (r) => anyText(bodyOf(r)).includes(MK_B_LEAD) && !isTitleSideCall(r), 180_000, 'the R8 Team B leader LLM request (marker ' + MK_B_LEAD + ')')
    writeEvidence('r8', 'tb-leader-first-request.json', leadB === null ? null : { seq: leadB.seq, model: modelOf(leadB) })
    check('R8', `Team B leader first request body.model === '${M_B_LEAD}'`,
      leadB !== null && modelOf(leadB) === M_B_LEAD, leadB === null ? 'no request' : `model=${modelOf(leadB)}`)

    await teamTool(HOST1, 'team_delegate', {
      rootSessionId: ROOT_TB,
      requestToken: `tok-r8-b-deleg-${Math.random().toString(36).slice(2, 10)}`,
      delegationTemplateId: 'worker',
      label: 'w-b',
      prompt: `${MK_B_WORKER} Team B worker task: acknowledge and finish.`,
    }, ROOT_TB, 'r8-b-deleg')
    const workerB = await waitForRequest(MOCK, (r) => anyText(bodyOf(r)).includes(MK_B_WORKER) && !isTitleSideCall(r), 180_000, 'the R8 Team B worker LLM request (marker ' + MK_B_WORKER + ')')
    writeEvidence('r8', 'tb-worker-first-request.json', workerB === null ? null : { seq: workerB.seq, model: modelOf(workerB) })
    check('R8', "Team B's worker request body.model === 'role-b' (NOT role-a — no cross-root leak in the other direction)",
      workerB !== null && modelOf(workerB) === M_B && modelOf(workerB) !== M_A,
      workerB === null ? 'no request' : `model=${modelOf(workerB)}`)
    finishCriterion('R8')
  }

  // ── R5 (post): host stop → fresh boot (phase=resume) → cold resume ───────
  log('── R5 (post): stop host, fresh boot the SAME DSH_HOME (phase=resume) ──')
  {
    await stopHost(HOST1, 'R5 pre-legs done')
    HOST1 = null
    writeTeamPatchFile(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), 'resume')
    writeP6t6Directive(2, 'resume')
    HOST2 = await bootHost(2, 'resume', hostPort, { home: HOME, hostTree: TESTUSE, logDir: LOG_DIR })
    await p6t6StateReady(HOST2.port, ROOT, 'resume')
    log('p6t6 ready (boot 2, phase=resume)')

    const follow = await teamTool(HOST2, 'team_follow_up', {
      rootSessionId: ROOT_T1,
      requestToken: `tok-r5-follow-post-${Math.random().toString(36).slice(2, 10)}`,
      targetInstanceId: expertId,
      prompt: `${MK_EXPERT_POST} Expert task (post-restart, cold resume): acknowledge and finish.`,
    }, ROOT_T1, 'r5-expert-follow-post')
    const followEffect = follow.value?.effect
    check('R5', 'post-restart team_follow_up(expert) resolves settled (the cold resume re-derived the member from the bound Blueprint)',
      followEffect?.kind === 'work-admitted' && followEffect.settled === true,
      `effect=${JSON.stringify(followEffect ?? follow.value).slice(0, 300)}`)
    const postReq = await waitForRequest(MOCK, (r) => anyText(bodyOf(r)).includes(MK_EXPERT_POST) && !isTitleSideCall(r), 240_000, 'the R5 expert post-restart LLM request (marker ' + MK_EXPERT_POST + ')')
    writeEvidence('r5', 'expert-post-request.json', postReq === null ? null : { seq: postReq.seq, model: modelOf(postReq), reply: postReq.reply?.content ?? null })
    check('R5', "AFTER restart: the expert's LLM request body.model === 'role-expert' (the source is the bound Blueprint snapshot, re-derived on cold resume — NOT a lost/denied selection)",
      postReq !== null && modelOf(postReq) === M_EXPERT,
      postReq === null ? 'no request with the marker' : `model=${modelOf(postReq)}`)
    finishCriterion('R5')
  }

  return { created, wDeleg, wCreate, expertId }
}

// ── teardown ───────────────────────────────────────────────────────────────
function listSessionFiles(home) {
  const out = []
  const root = join(home, 'sessions')
  const stack = [root]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) stack.push(full)
      else if (e.isFile() && /session(\.v\d+)?\.jsonl(\.zstd)?$/.test(e.name)) {
        try { out.push({ path: full, size: statSync(full).size }) } catch { /* skip */ }
      }
    }
  }
  return out
}

async function teardown(keepAlive = false) {
  // the full mock request surface (the evidence-of-record for every criterion).
  if (MOCK !== null) {
    writeEvidence('mock', 'requests-summary.json', MOCK.requests.map((r) => {
      const b = bodyOf(r)
      return {
        seq: r.seq,
        path: r.path,
        model: modelOf(r),
        firstText: firstText(b).slice(0, 240),
        ack: r.reply?.kind === 'text' ? String(r.reply?.content ?? '').slice(0, 120) : r.reply?.kind,
      }
    }))
  }
  if (keepAlive === false) {
    if (HOST1 !== null) await stopHost(HOST1, 'teardown')
    if (HOST2 !== null) await stopHost(HOST2, 'teardown')
    if (MOCK !== null) {
      try { await MOCK.close() } catch { /* already closed */ }
    }
  }
}

async function main() {
  let created = {}
  try {
    created = await run()
  } catch (error) {
    if (error instanceof KitFatal) {
      await teardown()
      writeSummary({ fatal: String(error?.message ?? error), exitCode: 1 })
      console.log(JSON.stringify({
        fatal: String(error?.message ?? error).slice(0, 2000),
        run: RUN_STAMP,
        home: HOME,
        criteria: Object.fromEntries(Object.entries(criteria).map(([id, c]) => [id, { pass: c.pass ?? false, checks: c.checks }])),
      }, null, 2))
      process.exit(1)
    }
    throw error
  }

  await teardown()

  // ── post hygiene ─────────────────────────────────────────────────────────
  {
    const gitPost = await checkPristine('post')
    const stablePost = await stableProbe(STABLE_URLS)
    writeEvidence('post', 'stable-post.json', stablePost)
    const headUnchanged = gitPost.head === HOST_BASELINE_SHA && gitPost.head === GIT_PRE?.head
    const porcelainClean = gitPost.statusEmpty === true
    const stableUntouched = JSON.stringify(stablePost) === JSON.stringify(STABLE_PRE)
    check('H1', `test-use HEAD unchanged after the run (${HOST_BASELINE_SHA.slice(0, 10)})`, headUnchanged, `head=${gitPost.head} pre=${GIT_PRE?.head}`)
    check('H1', 'test-use porcelain EMPTY after the run (zero upstream effect — CORE PATCH BUDGET = 0)', porcelainClean, `status=${JSON.stringify(gitPost.status).slice(0, 300)}`)
    check('H1', 'stable instance zero-touch: the :3080/:3180 read-only probes are IDENTICAL before/after (those ports were never bound or driven)', stableUntouched, `pre=${JSON.stringify(STABLE_PRE)} post=${JSON.stringify(stablePost)}`)
    finishCriterion('H1')
  }
  {
    const hostFree = await waitForPortFree(HOST_PORT_ACTUAL ?? HOST_PORT_CANDIDATES[0], 15_000)
    const mockFree = await waitForPortFree(MOCK_PORT, 15_000)
    check('H2', 'host port released at teardown', hostFree === true, `port ${HOST_PORT_ACTUAL} still bound`)
    check('H2', 'mock model port released at teardown', mockFree === true, `port ${MOCK_PORT} still bound`)
    finishCriterion('H2')
  }

  // the world home is RETAINED (TEST_METHODS §7: kept as evidence; the path
  // is registered here and in the task evidence dir).
  log(`world home RETAINED (per TEST_METHODS §7): ${HOME}`)

  const pass = Object.values(criteria).every((c) => c.pass === true)
  writeSummary({ fatal: null, exitCode: pass ? 0 : 2, retainedHome: HOME, wDeleg: created?.wDeleg, wCreate: created?.wCreate, expertId: created?.expertId })
  const table = Object.entries(criteria).map(([id, c]) => ({
    id,
    pass: c.pass === true,
    checks: c.checks.map((x) => ({ label: x.label, ok: x.ok, detail: x.detail.slice(0, 300) })),
  }))
  console.log(JSON.stringify({ run: RUN_STAMP, pass, exitCode: pass ? 0 : 2, home: HOME, criteria: table }, null, 2))
  process.exit(pass ? 0 : 2)
}

function writeSummary({ fatal, exitCode, retainedHome = null, ...extra }) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({
      task: 'model-preference-routing real-host smoke (guide §7 R1–R8)',
      runStamp: RUN_STAMP,
      worktree: WORKTREE,
      testuse: TESTUSE,
      baseline: HOST_BASELINE_SHA,
      home: HOME,
      retainedHome,
      fatal,
      criteria: Object.fromEntries(Object.entries(criteria).map(([id, c]) => [id, { pass: c.pass ?? false, checks: c.checks }])),
      pass: Object.values(criteria).every((c) => c.pass === true),
      exitCode,
      extra,
    }, null, 2))
  } catch { /* RUN_DIR may not exist yet */ }
}

const IS_MAIN = (() => {
  const entry = process.argv[1]
  if (entry === undefined) return false
  try { return resolve(entry) === fileURLToPath(import.meta.url) } catch { return false }
})()

if (IS_MAIN) {
  main().catch((error) => {
    const msg = String(error?.stack ?? error)
    log(`FATAL (kit-level, run aborted): ${msg}`)
    writeSummary({ fatal: msg.slice(0, 4000), exitCode: 1 })
    console.log(JSON.stringify({ fatal: msg.slice(0, 2000), criteria: Object.fromEntries(Object.entries(criteria).map(([id, c]) => [id, { pass: c.pass ?? false, checks: c.checks }])) }, null, 2))
    process.exit(1)
  })
}
