#!/usr/bin/env node
/**
 * pre-alpha3 PR-F F.6 — the real-host GAP kit: the plan §F.6 "real-host 20
 * 场景 floor" scenarios NOT covered by the E.12 kit (S1–S14) and the F15 kit
 * (PREF/C0/C1/C2/R1/R2/R4/R5/R3/H1), on the pristine 0.1.7-rc.1 host
 * (TEST_USE_BASELINE_SHA, `tests/deepseek-harness-test-use`), CORE PATCH
 * BUDGET = 0 (the worktree dist is mounted ONLY through the public
 * profile-patch seam — the same channel E.12/F15 use; no upstream patch, no
 * private API).
 *
 * F.6 20-scenario floor → covering kit+leg matrix (E.12 = the
 * pr-e-requirement-recovery-smoke kit; F15 = the f15-mcp-live-loss-smoke kit):
 *   1  normal team create/delegate        — E.12 S1 + F15 C1/C2; G1 reinforces
 *   2  Governance mutation + restart      — G2 (override.set v7 + F10 guard + restart durable)
 *   3  PolicyState + restart              — G3 (F11 bound-blueprint closed set + restart durable)
 *   4  multi-MCP A/B healthy, C down      — G4 (leader A/B pongs while C-blocked; restart remount)
 *   5  MCP restore                        — F15 R3 + E.12 S8 + G4c (restart remount → normal)
 *   6  startup optional consent           — E.12 S2
 *   7  startup required template disable  — E.12 S3
 *   8  Team-level required outage Rec.    — E.12 S4
 *   9  Leader Recovery + Human dispatch   — E.12 S5/S6/S9
 *   10 Member controlled bash recovery    — E.12 S7
 *   11 cancel approval → durable abandon  — E.12 S10 (abort leg)
 *   12 v1 frozen Blueprint cold resume    — E.12 S13
 *   13 v2 Blueprint create/resume         — E.12 S1 (v2 create) + F15 C1 + G1
 *   14 persona `ptc` regression           — G5 (the registry `ptc` preset actually mounted on the real host — the C.8 actual-mount donor; gate lane POST-RESOLUTION: finding PR-F-G5 (v2 kind subject vs provider preset-id lookup -> typed FATAL) was resolved on master by the persona-kind work (A-contract PR #46) — the create under the mounted ptc is now ACCEPTED with the persona genuinely satisfied (true OPEN, T9 durable team-root with positive durableGeneration); the fail-closed direction is asserted cross-kit (E.12 S12b leg + merged suite; this kit has no bare-preset cell of its own))
 *   15 dual Team isolation                — E.12 S14
 *   16 spill ArtifactReadGrant regression — G6 (read-spill → `artifact-read-granted` ledger fact)
 *   17 Remote v1–v7 compatibility         — G7 (the wire matrix; the plan's "v1–v6" wording
 *        predates master w1a contract v7 — the v1–v7 correction is recorded in the PR-F log)
 *   18 browser Team tab / ledger / pending — G8 (the tab's data surface: served page +
 *        getReadState/getProjection/getLedgerPage + the pending ask lifecycle over v4
 *        team.resolveControl; the real-browser variant is the separate
 *        team-view-sync-complete-e2e kit's agent-driven leg — endpoint-level proof here)
 *   19 subagent surface fail-closed       — G9 (the unmanaged surface carries subagent_fork;
 *        the A2C-2 coverage gate fails closed a strict-permissions member that does not
 *        owner-cover it)
 *   20 no upstream modification           — H1 (test-use pristine pre/post + :3080/:3180 zero-touch)
 *
 * ONE world (DSH_HOME in-workspace), ONE host port, 4 boots (B1 create /
 * B2 web-down / B3 restore / B4 ptc), the mock DeepSeek endpoint as the
 * wire witness, and the
 * durable surfaces (the team ledgers over `team.getLedgerPage`, the world
 * file) as the assertion basis. The p6t6 `__p6t6/tool` seam executes the
 * shipped team tools on the team's LEADER session (`as: <teamRootSessionId>`).
 *
 * W2-A LIVE-PROBE CONTRACT (the 2026-09-30 parent adjudication — the kit's
 * pre-W2-A mechanism was stale; the product contract is FROZEN and
 * plan-conformant):
 *   - SUPPLY AXIS: every MCP server the scenarios exercise is CONFIGURED on
 *     the row in EVERY boot (`mcpServers` — static, identical per boot:
 *     `mcp_repo`/3492, `mcp_leaderreq`/3491, `mcp_web`/3493). An
 *     UNCONFIGURED server is a deterministic `unreachable` (source
 *     'supply') — that is how the S2 optional-missing lives: `mcp_signal`
 *     is NEVER configured (no live server ever exists for it).
 *   - READINESS AXIS: the live probe is the IN-PROCESS MCP FIBER state of
 *     the row host (agent-bindings reconcile → mcpFibers / materialization
 *     slots): a mounted fiber on ANY live session = `reachable`; a failed
 *     mount slot on ANY live session = `unreachable`; nothing = `unknown`
 *     (fail-soft — the static bootstrap seed in `environmentFacts` fills
 *     ONLY `unknown` verdicts and is NEVER flipped per phase).
 *   - DOWN STATE = STOPPING THE RUNNING mini-MCP process (a LIVE state
 *     change, the C.10 real-host pattern — this kit's in-process
 *     `startMiniMcp`/`stopMiniMcp`); RESTORE = RESTARTING it. The boot
 *     phase that boots with a server stopped gets the failed mount slot at
 *     the first attach of the LEADER session (the p6t6 call's
 *     ensureLiveAgent runs the reconcile BEFORE the gate's fresh facts
 *     read), so the admission probe answers `unreachable` on time.
 *   - WORLD DESIGN: the main team's LEADER template mounts EVERY
 *     row-configured server (its `capabilities.mcp.allow` =
 *     [repo, leaderreq, signal, web]): the team-scoped servers (repo /
 *     leaderreq) have no other live mount surface, and the worker-scoped
 *     web must be proable at admission time — BEFORE the worker instance
 *     is attached (the gate reads fresh live facts before the effect
 *     runs; a cold worker member is `not-applicable`, never a fabricated
 *     failure). `mcp_signal` is allowed but never configured (excluded
 *     from the reconcile target by the configured∩allow filter — the
 *     structural guard never fires).
 *   - RESTART: the in-memory mount state is EPHEMERAL (plan §C.5/§E.11
 *     negative #10) — after every host restart NO live fiber survives
 *     (readiness `unknown` at boot, re-probed live at the next boundary);
 *     the durable facts (consent / disable / incidents) survive.
 *
 * THE G LEGS (this kit — the gap scenarios of the F.6 20-scenario floor):
 *  G0  preflight                       — worktree dist present; test-use
 *       pristine @ baseline (porcelain empty + HEAD); :3080/:3180 401
 *       baseline (the stable instances are NEVER touched); ports free.
 *  G1  world: v2 team + 3 mini-MCPs    — the E.12 main world shape
 *       (team-level required mcp_repo/3492 + leader team-scope required
 *       mcp_leaderreq/3491 + worker required mcp_web/3493; the leader mounts
 *       every configured server so the team-scoped fibers are proable; the
 *       worker carries the strict read-allow/bash-ask/default-deny permission
 *       surface owner-covered by the 19-tool unmanaged builtinToolDeny set —
 *       the A2C-2 documented escape): team.create (v2) + delegate g1 -> DONE.
 *  G2  governance mutation + restart   — scenario 2 + the F10 (w1a) guard:
 *       v7 override.set (team scope, capability mcp:mcp_repo, ADMIT-kind
 *       value) -> ack generation g1; a second writer's v7 set -> g2; the
 *       FIRST writer's next v7 set with the STALE expectedGeneration=g1 ->
 *       typed OVERRIDE_GENERATION_CONFLICT, zero write (the read still g2);
 *       RESTART -> override.get durable (g2 + values intact).
 *  G3  PolicyState + restart           — scenario 3 + the F11 (w1a) re-land:
 *       policyState.get(T) on the bound team (the durable row's bound
 *       blueprint ref resolves through the production three-case contract —
 *       case 3, the catalog snapshot with hash check): the closed set is the
 *       ADDRESSED team's bound policyStates (default + `paused` — the main
 *       fixture declares `paused`); policyState.set(T, paused) -> changed +
 *       entryId; an out-of-closed-set target -> typed POLICY_STATE_UNKNOWN;
 *       a foreign root -> typed FOREIGN_TEAM (assertBoundRoot); RESTART ->
 *       policyState.get(T) still `paused` (durable).
 *  G4  multi-MCP A/B healthy, C down   — scenario 4: with A(3492)/B(3491)/
 *       C(3493) all up, the worker delegate g4a -> DONE (web pong). The
 *       DOWN cell uses the W2-A pre-boot-stop mechanism (the E.12 B3
 *       pattern — 16/16 green on this same host): the kit STOPS ONLY C
 *       BEFORE the B2 boot, so the T leader's web mount FAILS at the B2
 *       attach (isolated per-server slot) and the admission probe answers
 *       `unreachable` for web before the worker instance is attached ->
 *       the worker delegate g4b (web required) is BLOCKED: the gate
 *       FATALs and the router OFFERS the human-reviewed recovery dispatch
 *       (a pending `recovery:` control request); the kit DENIES it -> the
 *       delegate closes typed COMPATIBILITY_BLOCKED ("denied by the
 *       reviewer — zero durable effect"). NOTE: the recovery-incident
 *       facts do NOT open on a deny — the gate writes them only on the
 *       ALLOWED-recovery boundary (the E.12 S1/S8 lifecycle, already
 *       recorded green on this lineage); scenario 4 is the multi-MCP
 *       isolation, not the recovery lifecycle. The A/B isolation witness
 *       is the PROBE (team-scoped repo/leaderreq still PASS — the
 *       team-scoped servers are requirement surfaces, NOT leader model
 *       tools; the run-3 pongB finding is recorded in the scenario
 *       evidence). The B3 boot with C remounted (fresh mini-MCP on 3493)
 *       -> delegate g4c -> DONE (the next boundary is NORMAL — web
 *       auto-mounted at the fresh reconcile; NO incident opens at the
 *       restored boundary — scenario 5's restore exit).
*  G5  persona `ptc` regression        — scenario 14: boot with
 *       rootPresetId/memberPresetId = the registry `ptc` preset (a shipped
 *       preset, ACTUALLY MOUNTED on the real host through the public row
 *       config — no scripted seam; the C.8 actual-mount donor). The persona
 *       team (team.persona.standard required): PROBE lane = the U5
 *       caller-only wire intent fact PASSes (OPEN). GATE lane = POST-
 *       RESOLUTION (2026-10-01 test-infra; review precision pass): the
 *       original finding PR-F-G5 was RECORDED at PR-F time as
 *       current-branch behavior — the v2 persona requirement's only legal
 *       subject is the required KIND `standard` (domain schema closed set)
 *       while the requirement-facts provider matched the subject against
 *       the mounted PRESET ID (v1 bespoke-preset-name semantics), so under
 *       a ptc mount the kind subject found no entry -> typed unknown ->
 *       the required Team-level requirement down -> team.create REFUSED
 *       typed (TEAM_RUNTIME_COMPATIBILITY_BLOCKED + the typed reason),
 *       ZERO durable effect; target design §16.1 / ADR-24 was NOT
 *       satisfied on that branch — a PR-E lineage cross-layer tension,
 *       escalated, out of PR-F scope. It has since been RESOLVED on
 *       master by the persona-kind work (A-contract, PR #46 — the kind
 *       subject resolves through the KIND path, no legacy preset-id
 *       shadowing; §16.1/ADR-24 satisfied). The cell now asserts the
 *       post-resolution contract: team.create ACCEPTED under the mounted
 *       ptc with the persona genuinely satisfied — TRUE OPEN, T9 minted
 *       durable as team-root with a POSITIVE durableGeneration (v6
 *       team-root contract: null only on the `none` relation — the
 *       remote handler rejects a null team-root answer,
 *       packages/remote/src/handlers/team.ts L563-566). The fail-closed
 *       direction (never a false OPEN) is asserted CROSS-KIT: the E.12
 *       S12b leg (bare/absent preset -> FATAL PERSONA_INCOMPATIBLE,
 *       admitInitialWork blocked) + the merged suite persona-kind tests
 *       (complete-mounted-preset chain FATALs end-to-end); this kit
 *       carries no bare-preset boot cell of its own. (The pre-resolution
 *       typed-FATAL + zero-effect behavior remains documented in the
 *       closure battery record — realhost-battery-post-merge — as
 *       historical evidence, unchanged.)
 *  G6  spill ArtifactReadGrant         — scenario 16, the PR#35 real-spill
 *       pattern (the proven E2E writer path — the run-3 worker-read variant
 *       produced NO durable fact): the leader-only spill team (the A2C-1
 *       leader allow-lane whole-tool `bash` under the mutation-envelope
 *       dual gate + the permissions policy + the 19-unmanaged
 *       builtinToolDeny) is created via team.create v1 + initialWork; the
 *       creation-time work unit runs one bash command (300KB stdout > the
 *       64KB inline cap) -> the executor spills -> the durable
 *       `artifact-read-granted` ledger fact (ARTIFACT_READ_GRANTED_FACT_
 *       TYPE) lands in the spill team ledger (instanceId inst-leader,
 *       source shell-foreground/bash — the executor spill -> observer ->
 *       authority -> durable fact chain). No kit-placed file: the spill is
 *       the tool output itself (the test-use tree stays untouched).
 *  G7  Remote v1–v7 compatibility      — scenario 17 (the F.3 de-version +
 *       the F11 v7 re-land, at the wire): for EVERY version v in 1..7 the
 *       stable read set {catalog.list, team.getProjection,
 *       team.getLedgerPage, override.get, policyState.get} is accepted
 *       (ok=true); the projection shape is version-sensitive (v<6 = the
 *       base shape; v>=6 = durableGeneration + liveToken — asserted); the
 *       version-gated methods are SERVED at their own version (team.listRoots
 *       v3, team.getReadState v6, team.resolveControl v4 — a well-formed typed
 *       response proves dispatch); the v7-only expectedGeneration field is
 *       REJECTED on the v1-v6 wire (typed — the closed field set is byte-
 *       exact legacy; the version closed sets live in the contracts + the
 *       client boundary, the server dispatch is a plain method switch); v8
 *       -> typed contract-version-unsupported; v0 / non-integer -> typed
 *       malformed-request. The v7 override expectedGeneration guard is G2;
 *       the v1 legacy no-guard path is the contract's documented ABSENT =
 *       legacy semantics (unit-backed, params.ts F10).
 *  G8  browser tab / ledger / pending  — scenario 18 (endpoint-level — the
 *       tab's data surface, the real-browser variant is the separate
 *       team-view-sync-complete-e2e agent-driven kit): GET / serves the UI
 *       (200, token-gated); team.getReadState (v6) on the worker session =
 *       the member read state; team.getProjection (v6) = the live tab shape;
 *       team.getLedgerPage feeds the ledger; the pending-review lifecycle:
 *       the worker's bash ASK opens a durable control request -> visible in
 *       the ledger page (the pending-review surface) -> v4 team.resolveControl
 *       allow -> bash executes -> DONE.
 *  G9  subagent surface fail-closed    — scenario 19: the subagent team's
 *       worker declares the strict permission surface WITHOUT the unmanaged
 *       builtinToolDeny set -> the A2C-2 coverage gate (0.1.7-rc.1 host: 19
 *       unmanaged tools, 12 known-sensitive incl. subagent_fork) fails
 *       CLOSED at the worker's setup: the first delegate errors typed and
 *       the error's uncovered-tool witness carries subagent_fork (the
 *       current surface includes the possible subagent); zero durable
 *       member instance (the fail-closed create).
 *
 * HYGIENE (mandatory):
 *  H1  test-use porcelain EMPTY + HEAD baseline BEFORE and AFTER;
 *       :3080/:3180 ZERO-TOUCH (read-only probes pre == post). The
 *       member workspaces ARE the test-use tree -> the worker bash is a
 *       NO-OP `echo` (any write = H1 fail).
 *  H2  all run ports released after teardown (worldCleaned=true ONLY on
 *       a full PASS; the world is retained on any non-zero exit).
 *  The ENTIRE evidence dir is token-scrubbed (`\bsk-[A-Za-z0-9]{24,}` = 0
 *  matches); `mock-requests.json` is NOT part of the evidence.
 *
 * EXIT: 0 = all 11 criteria (G1-G9 + H1/H2) PASS (world deleted);
 *        2 = a criterion failed (evidence dumped, world retained);
 *        1 = fatal (infrastructure / pre-flight).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import {
  TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH,
} from '../../paths.mjs'
import { DshInstance, ensureProfile } from '../../characterization/lib/instance.mjs'
import { logTail, portInUse } from '../../characterization/lib/util.mjs'
import { captureGitState } from '../../characterization/lib/tree-clean.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
// Ledger row byte form: the storage layer's `readRecordFromRaw` requires
// `serialize(record) === raw` — rows are canonicalJsonStringify output
// (sorted-keys compact JSON). Import the runtime's own validators +
// serializers so the kit's offline seeds are byte-identical to host writes
// (a plain JSON.stringify in insertion order makes the NEXT host boot fail
// closed: "row '<seq>' of store 'ledger' is not in canonical byte form").
import {
  LEDGER_SEQUENCE_COUNTER_KEY,
  parseLedgerEntry,
  serializeLedgerSequenceCounter,
} from '../../../packages/runtime/dist/packages/storage/schema/ledger.js'
import { canonicalJsonStringify } from '../../../packages/runtime/dist/packages/contracts/src/remote-safe.js'

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
let TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
// The gitignored test-use checkout exists only in the MAIN checkout, not in
// task worktrees (<main>/.worktrees/<task>). Fallback: parent repo.
if (!existsSync(TESTUSE) && existsSync(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))) {
  TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
}

// ── frozen facts / paths ────────────────────────────────────────────────────

const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA // 0.1.7-rc.1 (paths.mjs pin)
const HOST_TREE = TESTUSE
const PRODUCTION_ROW_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
const GLUE_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href

// ── ports (TEST_METHODS §5: 3180 host family; 3491-3500 test band) ──────────
// :3080 / :3180 are the STABLE dev instance — read-only probes only, NEVER
// booted/bound here.
const HOST_PORT_CANDIDATES = [3182, 3183, 3184, 3185, 3186, 3181] // NEVER 3080 / 3180
const MOCK_PORT_CANDIDATES = [3497, 3496]
const PORT_REPO = 3492 // mini-MCP: mcp_repo (the team-level required MCP — S4 outage)
const PORT_LEADERREQ = 3491 // mini-MCP: mcp_leaderreq (the leader's required MCP, team-scope — S5)
const PORT_WEB = 3493 // mini-MCP: mcp_web (the worker's required MCP — S3/S7/S8)
// All three are CONFIGURED on the row in EVERY boot (static `mcpServers` —
// the W2-A supply axis); the per-phase live state is the RUNNING/STOPPED
// process (see the W2-A LIVE-PROBE CONTRACT header). `mcp_signal` (S2) is
// never configured: its optional-missing lives on the supply axis.
const STABLE_URLS = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']

const S_REPO = 'mcp_repo' // team-level required (S4 outage)
const S_LEADERREQ = 'mcp_leaderreq' // the leader's required MCP, team-scope model (S5)
const S_WEB = 'mcp_web' // worker template required (S3/S7/S8)
const S_SIGNAL = 'mcp_signal' // leader OPTIONAL (S2) — NEVER configured on the row: the optional-missing is live via the supply axis (deterministic unreachable; no live server ever)

/** The EXACT unmanaged tool set on the 0.1.7-rc.1 host's model-facing
 *  surface for a permissions-declaring worker (probe witness:
 *  PermissionCoverageUnmanagedError, 19 tools — 12 known-sensitive
 *  [glob, grep, interrupt_agent, job_kill, job_list, job_output,
 *  list_agents, send_message, subagent_fork, web_fetch, web_search,
 *  workflow] + 7 unknown [ask_user_question, create_goal, exit_plan_mode,
 *  get_goal, present, skill, update_goal]). The A2C-2 coverage gate is
 *  fail-closed (permission-coverage.ts §7.3): a strict
 *  capabilities.permissions surface must owner-cover every tool, so the
 *  kit removes this set via builtinToolDeny (the documented escape) — the
 *  scenario-relevant surface (read allow / bash ask / default deny) is
 *  untouched. Sorted for stable blueprint bytes. */
const WORKER_SURFACE_DENY = [
  'ask_user_question',
  'create_goal',
  'exit_plan_mode',
  'get_goal',
  'glob',
  'grep',
  'interrupt_agent',
  'job_kill',
  'job_list',
  'job_output',
  'list_agents',
  'present',
  'send_message',
  'skill',
  'subagent_fork',
  'update_goal',
  'web_fetch',
  'web_search',
  'workflow',
]

const TOOL_WEB_PING = `mcp__${S_WEB}__ping`

// ── run stamp / world paths ─────────────────────────────────────────────────

function utcStamp() {
  const d = new Date().toISOString()
  return d.replace(/[:.]/g, '-').slice(0, 19)
}
const RUN_STAMP = `prf-${utcStamp()}`
// EVIDENCE lives in the WORKTREE (committed from the worktree branch).
const EVIDENCE_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'pre-alpha3-refactor', 'pr-f')
const RUN_DIR = join(EVIDENCE_DIR, RUN_STAMP)
// DSH_HOME world: IN-WORKSPACE (the worktree) — host source (HOST_TREE) and
// the data home are independent.
const HOME = join(WORKTREE, 'tests', 'homes', RUN_STAMP)
const LOCK_FILE = `${HOME}.lock`
const BLUEPRINT_DIR = join(HOME, 'blueprints') // saved sources live IN the world home
const WORLD_FILE = join(HOME, 'storages', 'team_domain.json')

const ROOT = `session-prf-boot-${RUN_STAMP}` // the row anchor's boot root
const T = `session-prf-main-${RUN_STAMP}` // the main gap team (v2)
const T2 = `session-prf-iso-${RUN_STAMP}` // (inherited fixture — E.12 S14 covers dual-team isolation; not created here)
const T9 = `session-prf-persona-${RUN_STAMP}` // the persona ptc team (v2) — G5
const TSUB = `session-prf-subagent-${RUN_STAMP}` // the subagent-surface fail-closed team (v2) — G9
const T13 = `session-prf-v1-${RUN_STAMP}` // (inherited fixture — E.12 S13 covers frozen v1; not created here)

const BP_MAIN_ID = 'team.prf-main'
const BP_ISO_ID = 'team.prf-iso'
const BP_PERSONA_ID = 'team.prf-persona'
const BP_SUB_ID = 'team.prf-subagent' // the G9 subject (strict worker, NO unmanaged deny)
const BP_ANCHOR_ID = 'team.prf-anchor' // the row anchor (v1, capabilities-less)
const BP_V1_ID = 'team.mpr-anchor' // the EXACT pre-PR-E v1 blueprint (S13)

// S13 — the byte-exact pre-PR-E `team.mpr-anchor@1` saved source (from the
// pre-PR-E world `prb-ep-2026-09-28T20-50-34` blueprint_registry) and the
// pre-PR-E contentHash it carried there.
const V1_ANCHOR_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.mpr-anchor',
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
const V1_ANCHOR_HASH_PRE_PR_E = 'sha256:6a7fba9ffce952639cf85b01714b1ca61a7d4816efe32607f3d7061da0c15a37'

// Distinct markers (no substring collisions; the oracle routes on the LAST
// user message carrying one of them). THE LEADER TOOL CALLS GO THROUGH THE
// p6t6 SEAM DIRECTLY (executeTool on the leader session — NO leader model
// turn), so the mock model only ever sees: title requests, the WORKER
// (work-unit) turns, and ONE leader initialWork turn (G6 — the spill team's
// creation-time work unit; the synchronous initial-work vertical models the
// root session, PR#35 pattern). The worker markers ride in the delegate
// `prompt` arg (the work-unit prompt delivered to the member session); the
// spill marker rides in the team.create initialWork prompt.
const NONCE = RUN_STAMP
const MKW = (tag) => `PRREQ_W_${tag}_${NONCE}`
const DONE_W = (tag) => `PRREQ_DONE_W_${tag}`
const WORKER_TAGS = ['g1', 'g4a', 'g4b', 'g4c', 'g5', 'g8', 'g9']
// G6 (the PR#35 real-spill pattern — the run-3 worker-read variant
// produced NO durable fact: the spill writer path is the LEADER's
// allow-lane bash under the permissions policy — executor spill ->
// observer -> authority -> durable fact). The leader-only spill team's
// creation-time work unit runs ONE bash command whose 300KB stdout
// exceeds the 64KB inline cap -> real spill.
const TSPILL = `session-prf-spill-${RUN_STAMP}`
const BP_SPILL_ID = 'team.prf-spill'
const MK_SPILL = `PRREQ_SPILL_${NONCE}`
const SPILL_COMMAND = "head -c 300000 /dev/zero | tr '\\0' 'x'" // 300KB stdout > 64KB cap
const SPILL_PROMPT =
  `${MK_SPILL} — run exactly one bash command for me: ${SPILL_COMMAND} — then tell me the approximate output size.`

// ── logging / criteria ──────────────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try { writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' }) } catch { /* evidence best-effort */ }
  }
}

const CRITERIA = [
  { id: 'G1', name: 'world: v2 team + 3 mini-MCPs (the E.12 main shape): row carries all three mcpServers + each answers initialize; team.create (v2) + delegate g1 EXECUTED (web pong)' },
  { id: 'G2', name: 'governance mutation + restart (scenario 2, F10 guard): v7 override.set ack g1 -> second writer v7 set ack g2 -> FIRST writer stale expectedGeneration=g1 -> typed OVERRIDE_GENERATION_CONFLICT, zero write (read still g2) -> RESTART -> override.get durable g2 + values intact' },
  { id: 'G3', name: 'PolicyState + restart (scenario 3, F11 re-land): bound team policyState.get closed set = default + paused (the bound blueprint, not the boot anchor); set paused -> changed + entryId; unknown state -> typed POLICY_STATE_UNKNOWN; foreign root -> typed FOREIGN_TEAM; RESTART -> still paused (durable)' },
  { id: 'G4', name: 'multi-MCP A/B healthy, C down (scenario 4, the W2-A pre-boot-stop down mechanism — the E.12 B3 pattern): all-up delegate DONE; C(3493) STOPPED BEFORE the B2 boot (leader web mount fails at attach -> unreachable at the gate) -> probe still shows team.mcp.repo + team.mcp.leaderreq PASS (A/B multi-MCP isolation) while worker delegate BLOCKED -> typed COMPATIBILITY_BLOCKED (the recovery request is OFFERED then DENIED — zero effect, no work fact); B3 boot with C remounted -> delegate DONE (next boundary NORMAL, web auto-mounted; no incident opens at the restored boundary)' },
  { id: 'G5', name: 'persona ptc regression (scenario 14): the registry ptc preset ACTUALLY MOUNTED on the real host (rootPresetId/memberPresetId = ptc — the C.8 actual-mount donor); probe lane = the U5 caller-only wire intent fact PASSes (OPEN); GATE lane (POST-RESOLUTION — finding PR-F-G5 was resolved on master by the persona-kind work, A-contract PR #46: the v2 persona kind subject resolves through the KIND path, no legacy preset-id shadowing; §16.1/ADR-24 satisfied) = team.create ACCEPTED under the mounted ptc with the persona requirement genuinely satisfied — TRUE OPEN (T9 minted durable as team-root — the inverse of the pre-fix zero-effect assertion; the fail-closed direction is asserted cross-kit by the E.12 S12b leg + the merged suite persona-kind tests: bare preset -> FATAL PERSONA_INCOMPATIBLE, never a false OPEN)' },
  { id: 'G6', name: 'spill ArtifactReadGrant regression (scenario 16, the PR#35 real-spill pattern): the leader-only spill team (bash allow-lane + teamEnvelope exec token + 19-unmanaged builtinToolDeny + permissions policy) is created via team.create v1 + initialWork; the creation-time work unit runs one bash command (300KB stdout > 64KB inline cap) -> the durable artifact-read-granted fact lands in the spill team ledger (instanceId inst-leader, source shell-foreground/bash — the executor spill -> observer -> authority -> durable fact chain)' },
  { id: 'G7', name: 'Remote v1-v7 compatibility (scenario 17, the v1-v7 wording correction): every version 1..7 accepted on the stable read set (catalog.list/team.getProjection/team.getLedgerPage/override.get/policyState.get); projection v<6 base vs v>=6 durableGeneration+liveToken (shape-sensitive); gated methods served at their own version (listRoots v3, getReadState v6, resolveControl v4 — well-formed typed dispatch); the v7-only expectedGeneration is REJECTED on the v6 wire (typed — the v1-v6 closed field set is byte-exact); v8 -> contract-version-unsupported; v0 / 1.5 -> malformed-request' },
  { id: 'G8', name: 'browser tab / ledger / pending review (scenario 18, endpoint-level): GET / serves the UI; team.getReadState (v6) worker session = member read state; team.getProjection (v6) live shape; the worker bash ASK opens a control request -> visible in team.getLedgerPage (the pending-review surface) -> v4 team.resolveControl allow -> bash executes -> DONE' },
  { id: 'G9', name: 'subagent surface fail-closed (scenario 19): strict-permissions worker WITHOUT the unmanaged deny set -> first delegate fails CLOSED typed (the A2C-2 coverage gate) and the uncovered-tool witness carries subagent_fork; zero durable member instance' },
  { id: 'H1', name: 'test-use pristine BEFORE + AFTER (porcelain empty, HEAD baseline); :3080/:3180 zero-touch (pre == post); the worker bash is a no-op echo' },
  { id: 'H2', name: 'all run ports released after teardown (worldCleaned=true on PASS only)' },
]
const VERDICT = new Map() // id -> { pass, note }

function check(id, label, ok, detail = '') {
  const prev = VERDICT.get(id) ?? { pass: true, note: '' }
  const line = `[${id}] ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` :: ${detail}` : ''}`
  log(line)
  if (!ok) {
    VERDICT.set(id, { pass: false, note: (prev.note ? `${prev.note}; ` : '') + `${label}${detail ? ` :: ${String(detail).slice(0, 500)}` : ''}` })
  }
  return ok
}

function dieFatal(msg) {
  log(`FATAL: ${msg}`)
  try { finalizeEvidence('FATAL', msg) } catch { /* best effort */ }
  process.exit(1)
}

// ── small utils ─────────────────────────────────────────────────────────────

function sha256Hex(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

/** Deterministic JSON: keys in ascending code-unit order, compact (the
 *  contracts `canonicalJsonStringify` — recomputed for the S9 digest). */
function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, init, timeoutMs = 30_000) {
  let res
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    return { status: 0, body: null, error: String(error?.message ?? error) }
  }
  const text = await res.text().catch(() => '')
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = text }
  return { status: res.status, body, error: null }
}

async function probeStableInstance(url) {
  // Refusal-safe (2026-10-01, test-infra): the stable-instance probe is a
  // RED-LINE OBSERVATION (EVID.stableBefore/stableAfter — the zero-touch
  // record for :3080/:3180), never a test input. The previous form's
  // fetch().catch() returned a bare object on a REFUSED connection
  // (e.g. :3180 not listening on the test host) and then threw
  // 'r.text is not a function', fast-failing the whole kit in environments
  // where the stable slot is empty. Record the refusal as data instead —
  // the same semantics the F15 kit's safe probe (f15-mcp-live-loss-smoke,
  // L294) has always used. No assertion changes.
  let r
  try { r = await fetch(url, { signal: AbortSignal.timeout(10_000) }) } catch (e) { return { status: 0, error: String(e?.message ?? e) } }
  const text = await r.text().catch(() => '')
  return { status: r.status, length: text.length, head: text.slice(0, 200) }
}

async function authenticate(origin, token) {
  // redirect: 'manual' is MANDATORY: the authorized launch-token exchange
  // answers 303 + Set-Cookie, and Node's fetch (undici) otherwise follows
  // the 303 to '/' where the (not-yet-cooked) session answers 401 — the
  // kit would then misread its own successful authentication as a failure
  // (E.12 run prereq-2026-09-29T01-46-21: host hook captured 303 for the
  // exact marker token, then the followed GET / -> 401 that the kit saw).
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
  const cookie = res.headers.get('set-cookie') ?? ''
  if (res.status !== 303) throw new Error(`authenticate: expected 303 (status=${res.status})`)
  if (!cookie) throw new Error(`authenticate: no set-cookie on 303`)
  return cookie.split(';')[0]
}

// ── the remote surface (POST /team-remote/<method>) ─────────────────────────

function scrubTokens(text) {
  return String(text)
    .replace(/\bsk-[A-Za-z0-9]{24,}/g, 'sk-REDACTED')
    // K8 (run-5 hygiene gap): the RAW launch tokens (`?token=<40+>`) leaked
    // into instance logs / run.log of every run (boot URLs, auth exchanges)
    // — redact both the query-param form and the bare `token=<long>` form.
    .replace(/[?&]token=[A-Za-z0-9_-]{16,}/g, (m) => `${m[0]}token=REDACTED`)
    .replace(/\btoken=[A-Za-z0-9_-]{24,}/g, 'token=REDACTED')
}

async function remoteCall(host, method, params, tag, version = 1, timeoutMs = 60_000) {
  const body = {
    type: 'client-request',
    rpcId: `${tag}-${randomUUID().slice(0, 8)}`,
    method,
    payload: { version, params },
  }
  const r = await fetchJson(`${host.origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: host.cookie },
    body: JSON.stringify(body),
  }, timeoutMs)
  const entry = {
    at: new Date().toISOString(),
    boot: host.boot,
    method,
    version,
    tag,
    status: r.status,
    error: r.error,
    ok: r.body?.result?.ok === true,
    code: r.body?.result?.ok === false ? r.body?.result?.error?.code : undefined,
    params: params ?? null,
    body: r.body,
  }
  EVID.transcript.push(entry)
  log(`remote ${method} v${version} [${tag}] -> ${r.status} ok=${entry.ok === true}${entry.code ? ` code=${entry.code}` : ''}${r.error ? ` (net: ${scrubTokens(r.error)})` : ''}`)
  return r
}

async function remoteCallReady(host, method, params, tag, version = 1, retries = 20, timeoutMs = 60_000) {
  // The 429 retry budget is unchanged; `timeoutMs` is PASSED THROUGH to
  // the underlying call — the G6 spill create (initialWork synchronous
  // vertical: create returns AFTER the terminal delivered fact, so the
  // call spans the whole leader work unit) needs 240s, not the 60s
  // default.
  let last = null
  for (let i = 0; i < retries; i += 1) {
    last = await remoteCall(host, method, params, tag, version, timeoutMs)
    if (last.status !== 429) return last
    await sleep(1500)
  }
  return last
}

function remoteValue(result, method) {
  if (result.status !== 200) throw new Error(`${method}: HTTP ${result.status}: ${scrubTokens(JSON.stringify(result.body).slice(0, 400))}`)
  const r = result.body?.result
  if (r === undefined) throw new Error(`${method}: no result envelope: ${scrubTokens(JSON.stringify(result.body).slice(0, 400))}`)
  if (r.ok !== true) throw new Error(`${method}: remote error: ${scrubTokens(JSON.stringify(r.error ?? r).slice(0, 800))}`)
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v && 'provenance' in v) return v.data
  return v
}

function resultError(body) {
  const r = body?.result
  if (r === undefined) return { code: 'NO_RESULT', message: String(body).slice(0, 200) }
  if (r.ok !== true) return r.error ?? { code: 'UNKNOWN', message: JSON.stringify(r).slice(0, 200) }
  return null
}

function resultData(body) {
  const r = body?.result
  if (r === undefined || r.ok !== true) return null
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v) return v.data
  return v
}

/** K6 (run-5 live finding): a CLOSED team-tool result (the typed gate
 *  block, the envelope block, the deny/abort zero-effect) travels as
 *  p6t6 `{ok:true, value:{status:'rejected', code, message, details}}` —
 *  the /__p6t6/tool route (tools/harness/plugin.mjs) only sets the
 *  `ok:false`/`error` branch for THROWN tool faults (outcome.isError),
 *  never for closed results. Checks on closed outcomes must read
 *  `value.{status,code,message,details}`, never `body.error`. */
function closedRejection(resp) {
  return resp.body?.ok === true && resp.body?.value?.status === 'rejected'
}

// ── the p6t6 seam ───────────────────────────────────────────────────────────

async function p6t6Tool(port, name, argsObj, as, timeoutMs = 200_000) {
  const r = await fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args: argsObj, as }),
  }, timeoutMs)
  EVID.transcript.push({
    at: new Date().toISOString(),
    boot: port === HOST_PORT ? host?.boot : null,
    method: `__p6t6/tool ${name}`,
    as,
    args: argsObj,
    status: r.status,
    body: r.body,
  })
  log(`p6t6 tool ${name} as=${as} -> ${r.status} ok=${r.body?.ok === true}${r.body?.ok === false ? ` err=${scrubTokens(String(r.body?.error?.message ?? '').slice(0, 300))}` : ''}`)
  return r
}

async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

async function p6t6StateReady(port, { rootSessionId, phase, timeoutMs = 120_000, intervalMs = 500 }) {
  const deadline = Date.now() + timeoutMs
  let last = await p6t6State(port)
  for (;;) {
    const b = last.body
    if (last.status === 200 && b !== null && typeof b === 'object'
      && b.rootSessionId === rootSessionId && b.phase === phase
      && b.teamSession !== null && typeof b.teamSession === 'object'
      && b.teamSession.rootSessionId === rootSessionId) {
      return last
    }
    if (Date.now() >= deadline) {
      throw new Error(`row state not well-formed within ${timeoutMs}ms (expected rootSessionId=${rootSessionId} phase=${phase}); last: status=${last.status} body=${JSON.stringify(last.body).slice(0, 400)}`)
    }
    await sleep(intervalMs)
    last = await p6t6State(port)
  }
}

/** The mcp materialization slot of server `name` across ALL live sessions
 *  (governance.sessions is host-wide; the team control/members sections are
 *  directive-ROOT-scoped and do NOT cover scenario teams).
 *  K10 (run-5): returns EVERY session's slot for the server — the configured
 *  fiber appears in each session with a live agent (boot-root leader, every
 *  worker), and only the sessions whose template ALLOWS the server show
 *  `mounted:true` (the others stay `materialization:pending`). Callers
 *  pick the mounted slot (the materialized boundary) instead of assuming
 *  the first map entry is the right session. */
function findMcpSlots(stateBody, serverName) {
  const sessions = stateBody?.governance?.sessions
  if (sessions === undefined || sessions === null || typeof sessions !== 'object') return []
  const out = []
  for (const [sessionId, view] of Object.entries(sessions)) {
    const servers = view?.mcp?.servers
    if (servers === undefined || servers === null || typeof servers !== 'object') continue
    const s = servers[serverName]
    if (s === undefined || s === null || typeof s !== 'object') continue
    out.push({
      sessionId,
      mounted: s.mounted === true,
      materialization: typeof s.materialization === 'string' ? s.materialization : null,
      attempts: typeof s.mcpAttempts === 'number' ? s.mcpAttempts : null,
      reason: s.mcpFailureReason !== undefined ? String(s.mcpFailureReason) : null,
    })
  }
  return out
}

// ── the durable requirement-fact / control readers ──────────────────────────

/** All ledger entries of one root (the team-scoped durable read surface).
 *  Paginates: the remote contract bounds `limit` at 500 (params.ts
 *  parseRemoteBoundedInt), so a single over-limit request answers
 *  MALFORMED_PARAMS — walk `nextAfterSequence` until the page is short. */
async function ledgerEntries(host, teamSessionId) {
  const entries = []
  let afterSequence = 0
  for (let pageNo = 0; pageNo < 100; pageNo += 1) { // 100 × 500 safety cap
    const page = await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId, afterSequence, limit: 500 }, `ledger-p${pageNo}`, 1)
    const data = remoteValue(page, 'team.getLedgerPage') // loud on any non-ok (never swallow a durable-read failure)
    const pageEntries = Array.isArray(data?.entries) ? data.entries : []
    entries.push(...pageEntries)
    const next = data?.nextAfterSequence
    if (typeof next !== 'number' || pageEntries.length === 0) break
    afterSequence = next
  }
  return entries.sort((a, b) => (a?.sequence ?? 0) - (b?.sequence ?? 0))
}

/** One fact type's entries (durable requirement facts live in the frozen
 *  `compatibility` category, carried in the root ledger). */
function factEntries(entries, factType) {
  return entries.filter((e) => e?.factType === factType)
}

/** The durable compatibility AGGREGATE of one root (contract v1 exposes
 *  aggregate ONLY: {status, generation, environmentFingerprint, recordedAt,
 *  counts} — the per-requirement rows travel on `intent.probe`). */
async function compatibilityOf(host, teamSessionId) {
  const r = await remoteCallReady(host, 'compatibility.get', { teamSessionId }, 'compat-get', 1)
  const err = resultError(r.body)
  if (err !== null) return { error: err }
  const data = resultData(r.body)
  const row = data?.verdict ?? data
  return { row }
}

/** The FULL engine verdict (status + per-requirement rows + counts) for a
 *  saved blueprint against the row's live facts — the pre-create probe. */
async function probeBlueprint(host, blueprintId, tag) {
  const r = await remoteCallReady(host, 'intent.probe', {
    blueprintId,
    environmentFacts: [],
  }, tag, 1)
  const err = resultError(r.body)
  if (err !== null) return { error: err }
  return { verdict: resultData(r.body)?.compatibility ?? null }
}

/** The pending control requests of one root: `control-request-recorded`
 *  entries with NO matching `control-decision-recorded` and NO matching
 *  abandon fact. (The p6t6 `control` section is directive-ROOT-scoped —
 *  scenario teams are read from their OWN ledgers.) */
function pendingControlRequests(entries) {
  const requests = factEntries(entries, 'control-request-recorded')
  const decided = new Set(factEntries(entries, 'control-decision-recorded').map((e) => e?.payload?.requestId))
  const abandoned = new Set(factEntries(entries, 'control-request-abandoned').map((e) => e?.payload?.requestId))
  return requests
    .filter((e) => e?.payload?.requestId !== undefined && !decided.has(e.payload.requestId) && !abandoned.has(e.payload.requestId))
    .map((e) => e.payload)
}

async function resolveControl(host, teamSessionId, requestId, decision, note, tag) {
  return remoteCallReady(host, 'team.resolveControl', { teamSessionId, requestId, decision, note }, tag ?? `resolve-${requestId.slice(0, 12)}`, 4)
}

// ── the world file (seeded durable facts — host STOPPED) ───────────────────

function readWorld() {
  return JSON.parse(readFileSync(WORLD_FILE, 'utf8'))
}

function writeWorld(world) {
  writeFileSync(WORLD_FILE, JSON.stringify(world, null, 1))
}

/** Append ONE durable requirement fact (the `compatibility` category of the
 *  root ledger, canonical-JSON table values) — host must be STOPPED. The
 *  gate's READ of these facts is the behavior under test (no live writer
 *  exists for consents/availability in this increment). */
function seedFact(rootSessionId, factType, payload) {
  const world = readWorld()
  const ledger = world.tables.ledger
  let maxSeq = 0
  for (const key of Object.keys(ledger)) {
    const n = Number(key)
    if (Number.isInteger(n) && n > maxSeq) maxSeq = n
  }
  const seq = maxSeq + 1
  const entry = {
    schemaVersion: 2,
    sequence: seq,
    rootSessionId,
    factType,
    payload,
    createdAt: new Date().toISOString(),
  }
  // Validate fail-fast (RECORD_INVALID on any malformed field) and write
  // the row in canonical byte form (sorted keys, compact) — the exact form
  // the host's LedgerRepository.readRecordFromRaw byte-compares against.
  ledger[String(seq)] = canonicalJsonStringify(parseLedgerEntry(entry))
  // Bump the sequence-counter row to the new high-water mark, canonical
  // form too: leaving it stale makes the host's next allocation collide
  // with the seeded sequence.
  ledger[LEDGER_SEQUENCE_COUNTER_KEY] = serializeLedgerSequenceCounter({
    schemaVersion: 2,
    kind: 'ledger-sequence-counter',
    value: seq,
  })
  writeWorld(world)
  log(`world: seeded ${factType} seq=${seq} root=${rootSessionId} payload=${JSON.stringify(payload)}`)
  return seq
}

// ── the mock model oracle (the wire witness) ────────────────────────────────

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-prf-${randomUUID().slice(0, 8)}`, name, arguments: argumentsObj }] }
}

/** Mutable per-boot oracle inputs (the follow-up target, set before B4). */
const ORACLE = {}

function leaderDelegateCall(tag, { rootSessionId, templateId, requestToken, workerMarker, followUp }) {
  if (followUp !== undefined) {
    // team_follow_up: required [rootSessionId, requestToken, targetInstanceId,
    // prompt] — NO label (absent async would mean ASYNC — always explicit).
    return {
      name: 'team_follow_up',
      args: {
        rootSessionId,
        requestToken,
        targetInstanceId: followUp,
        prompt: `${workerMarker} work unit ${tag} (nonce ${NONCE})`,
        async: false,
      },
    }
  }
  // team_delegate: required [rootSessionId, requestToken, label, prompt] +
  // exactly one of delegationTemplateId / delegationInstanceId.
  return {
    name: 'team_delegate',
    args: {
      rootSessionId,
      requestToken,
      label: `w-${tag}`,
      prompt: `${workerMarker} work unit ${tag} (nonce ${NONCE})`,
      delegationTemplateId: templateId,
      async: false,
    },
  }
}

/** K14 (run-6) + K16 (run-7 live finding): the delegate's instance id
 *  rides on the EFFECT in BOTH forms — `member-activated` (the FIRST
 *  delegate on a template creates) and `work-admitted` (the live default
 *  context policy CONTINUES an existing instance — provider.ts
 *  resolveDelegationTarget 'continue' short-circuit; the kit world has no
 *  fresh_per_delegation policy, so every later delegate on the same
 *  template continues on the first instance, fromLifecycle SETTLED). The
 *  outcome's top-level targetInstanceId is ABSENT on both forms in this
 *  world (router.ts sets it only when resolved.target is defined — never
 *  for these tool-surface delegates). Read effect.instanceId first. */
function delegateInstanceId(value) {
  const eff = value?.effect
  if (eff && typeof eff.instanceId === 'string') return eff.instanceId
  return value?.targetInstanceId ?? null
}

/** One scripted leader boundary call, keyed by tag. */
function leaderCallFor(tag) {
  switch (tag) {
    case 'g1': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-g1-${NONCE}`, workerMarker: MKW('g1') })
    case 'g4a': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-g4a-${NONCE}`, workerMarker: MKW('g4a') })
    case 'g4b': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-g4b-${NONCE}`, workerMarker: MKW('g4b') })
    case 'g4c': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-g4c-${NONCE}`, workerMarker: MKW('g4c') })
    case 'g5': return leaderDelegateCall(tag, { rootSessionId: T9, templateId: 'worker', requestToken: `rt-g5-${NONCE}`, workerMarker: MKW('g5') })
    case 'g8': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-g8-${NONCE}`, workerMarker: MKW('g8') })
    case 'g9': return leaderDelegateCall(tag, { rootSessionId: TSUB, templateId: 'worker', requestToken: `rt-g9-${NONCE}`, workerMarker: MKW('g9') })
    default:
      throw new Error(`oracle: unknown leader tag '${tag}'`)
  }
}

function workerTurnFor(tag, roundsAfter, issueToolCall) {
  switch (tag) {
    case 'g1':
    case 'g4a':
    case 'g4b':
    case 'g4c':
      // the worker's work unit: ping its required web MCP (the wire witness
      // of the materialization) then finish.
      if (roundsAfter === 0) return issueToolCall(tag, toolCall(TOOL_WEB_PING, { msg: `g-${tag}` }))
      if (roundsAfter === 1) return { kind: 'text', content: DONE_W(tag) }
      break
    case 'g8':
      // G8: the pending-review lifecycle — read (allow lane: executes on the
      // ORIGINAL permission), then bash (ASK lane: a durable control request
      // opens — the pending-review surface — and the kit approves it via the
      // v4 team.resolveControl wire), then DONE.
      if (roundsAfter === 0) return issueToolCall(tag, toolCall('read', { file_path: 'package.json' }))
      if (roundsAfter === 1) return issueToolCall(tag, toolCall('bash', { command: `echo prf-g8-${NONCE}`, description: `echo the g8 nonce marker (G8 oracle round 1; the ASK lane opens the durable control request)` }))
      if (roundsAfter === 2) return { kind: 'text', content: DONE_W(tag) }
      break
    default:
      // every other work unit (g5, g9): a single DONE turn.
      return { kind: 'text', content: DONE_W(tag) }
  }
  return { kind: 'text', content: `${DONE_W(tag)}_FALLTHROUGH rounds=${roundsAfter}` }
}

function makeDecide() {
  const allWorker = WORKER_TAGS.map((t) => MKW(t))
  const toolCallCounts = {}
  const issueToolCall = (mk, tc) => {
    toolCallCounts[mk] = (toolCallCounts[mk] ?? 0) + 1
    if (toolCallCounts[mk] > 5) {
      log(`ORACLE loop guard: ${mk} issued >5 tool calls — breaking the loop`)
      return { kind: 'text', content: 'PRREQ_LOOP_GUARD' }
    }
    return tc
  }
  return function decide({ req }) {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    const first = msgs[0]
    if (typeof first?.content === 'string' && first.content.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'prf smoke session' }
    }
    // G6 spill work unit (the team.create initialWork prompt on the ROOT
    // session — the PR#35 leader allow-lane bash pattern): round 0 issues
    // the bash command (300KB stdout > 64KB inline cap -> the executor
    // spills), the next round answers DONE. The ROOT-session transcript
    // does not count tool-call assistant messages the way the worker turns
    // do (run-4: roundsAfter stayed 0 and the bash looped), so the round is
    // tracked by the per-marker tool-call counter instead (issueToolCall
    // increments it; >=1 means the bash already went out -> answer DONE).
    let spillIdx = -1
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const m = msgs[i]
      if (m?.role !== 'user') continue
      const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
      if (t.includes(MK_SPILL)) { spillIdx = i; break }
    }
    if (spillIdx !== -1) {
      if ((toolCallCounts[MK_SPILL] ?? 0) >= 1) {
        return { kind: 'text', content: `PRREQ_DONE_SPILL_${NONCE}` }
      }
      log(`ORACLE spill round 0: bash (${SPILL_COMMAND.slice(0, 40)}...)`)
      return issueToolCall(MK_SPILL, toolCall('bash', { command: SPILL_COMMAND, description: 'emit 300KiB of filler to trip the 64KiB early-spill (G6 oracle; stdout.spillPath is the grant source)' }))
    }
    // The LAST user message carrying a worker marker = the current work unit
    // (the delegate prompt; resumed sessions keep older marker turns earlier
    // in the transcript). KEY: the DSH agent appends TOOL RESULTS as
    // `user`-role messages, so tool round-trips are counted by the
    // ASSISTANT (tool-call) messages that follow the marker user message.
    let workerIdx = -1
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const m = msgs[i]
      if (m?.role !== 'user') continue
      const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
      if (allWorker.some((mk) => t.includes(mk))) { workerIdx = i; break }
    }
    if (workerIdx !== -1) {
      const lastUser = typeof msgs[workerIdx].content === 'string' ? msgs[workerIdx].content : JSON.stringify(msgs[workerIdx].content)
      const tag = WORKER_TAGS.find((t) => lastUser.includes(MKW(t)))
      const roundsAfter = msgs.slice(workerIdx + 1).filter((m) => m?.role === 'assistant').length
      if (roundsAfter > 3) return { kind: 'text', content: 'PRREQ_LOOP_GUARD' }
      if (tag !== undefined) {
        const r = workerTurnFor(tag, roundsAfter, issueToolCall)
        if (r.kind === 'tool-call') log(`ORACLE worker ${tag} round ${roundsAfter}: ${r.toolCalls[0].name}`)
        return r
      }
    }
    return { kind: 'text', content: `PRREQ_DEFAULT_ACK_${NONCE}` }
  }
}

function msgContentHas(m, needle) {
  const c = m?.content
  const t = typeof c === 'string' ? c : JSON.stringify(c ?? '')
  return t.includes(needle)
}

/** The mock request where the turn carrying `marker` ENDED (final text). */
async function waitForTurnDone(mock, marker, doneText, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find((r) => r.reply?.kind === 'text' && r.reply.content === doneText && (r.body?.messages ?? []).some((m) => msgContentHas(m, marker)))
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) return null
    await sleep(500)
  }
}

/** TRUE if ANY captured model request shows the needle after the marker
 *  turn (executed tool outputs — the pong strings — ride in as user-role
 *  messages). */
function mockWitness(mock, marker, needle) {
  const reqs = mock.requests.filter((r) => (r.body?.messages ?? []).some((m) => msgContentHas(m, marker)))
  return reqs.some((r) => (r.body?.messages ?? []).some((m) => msgContentHas(m, needle)))
}

// ── the mini-MCP servers (the live capability surfaces) ─────────────────────

function miniMcpRpc(serverLabel, msg) {
  const { id, method, params } = msg ?? {}
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: serverLabel, version: '1.0.0' },
      },
    }
  }
  if (method === 'notifications/initialized') return null
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: `ping`,
            description: `ping ${serverLabel}`,
            inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
          },
        ],
      },
    }
  }
  if (method === 'tools/call') {
    const toolName = String(params?.name ?? '')
    if (toolName === 'ping') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: `pong:${serverLabel}:${String(params?.arguments?.msg ?? '?')}` }],
          isError: false,
        },
      }
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `unknown tool ${toolName}` } }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${String(method)}` } }
}

async function startMiniMcp(port, label) {
  const { createServer } = await import('node:http')
  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end()
      return
    }
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      let msg = null
      try { msg = JSON.parse(raw || 'null') } catch { /* null */ }
      const reply = miniMcpRpc(label, msg)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(reply === null ? '' : JSON.stringify(reply))
    })
  })
  await new Promise((resolveP, rejectP) => {
    server.once('error', rejectP)
    server.listen(port, '127.0.0.1', () => resolveP())
  })
  log(`mini MCP ${label} up on 127.0.0.1:${port}`)
  return { port, server }
}

/** Stop a running mini-MCP (the W2-A DOWN state — a LIVE state change, the
 *  C.10 real-host pattern: the row config stays CONFIGURED; the next mount
 *  attempt against the dead port fails into the isolated per-server slot).
 *  `server.close` waits for open connections to drain (the C.10 kit proves
 *  this is safe to re-listen on the same port afterwards). */
async function stopMiniMcp(mini, label) {
  if (mini === null) return
  await new Promise((r) => mini.server.close(r))
  log(`mini MCP ${label ?? mini.port} STOPPED on 127.0.0.1:${mini.port} (the live down state)`)
}

/** A BLACKHOLE mini-MCP (the B5 transient-window mechanic): a raw
 *  TCP listener that ACCEPTS connections but NEVER answers — the MCP
 *  client's mount materialization hangs in flight against it (the request
 *  is sent; no response ever comes). For the session whose mount hangs,
 *  the live readiness probe (the mcpFiber state read, s6/host
 *  capabilityReadiness) reports that materialization IN-FLIGHT — under
 *  the PF-2 tri-state (option A) the typed PENDING state (PENDING means
 *  in-flight ONLY).
 *
 *  (At the S4 ADMI moment the main root is still COLD — the gate precedes
 *  the root attach — so that moment is NEVER-OBSERVED and the SEED truth
 *  decides; see the S4a block.)
 *
 *  Closing it DESTROYS the in-flight sockets (a plain `server.close()`
 *  would keep them — Node keeps connections that are waiting for a
 *  response): the client's in-flight initialize then fails (ECONNRESET)
 *  into the isolated per-server slot → the slot settles `failed` → the
 *  probe answers `unreachable` at the next boundary (the D-3 B5 second
 *  half: the typed FATAL). */
async function startBlackholeMcp(port, label) {
  const { createServer } = await import('node:net')
  const sockets = new Set()
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.on('close', () => sockets.delete(socket))
    socket.resume() // swallow the data; never answer
  })
  await new Promise((resolveP, rejectP) => {
    server.once('error', rejectP)
    server.listen(port, '127.0.0.1', () => resolveP())
  })
  log(`blackhole MCP ${label} up on 127.0.0.1:${port} (accepts, never answers — the deterministic transient window)`)
  return {
    port,
    server,
    label,
    sockets,
    async close() {
      for (const s of [...sockets]) {
        try { s.destroy() } catch { /* ignore */ }
      }
      sockets.clear()
      await new Promise((r) => server.close(r))
      log(`blackhole MCP ${label} DESTROYED on 127.0.0.1:${port} (the in-flight materialization fails into the slot)`)
    },
  }
}

/** Poll the p6t6 governance state until ONE `serverName` materialization
 *  slot matches `match` (the deterministic B5 sync point — no race
 *  against the materialization state machine). Returns the matching slot
 *  (or throws past the deadline with the last observed slot set). */
async function waitForMcpSlot(host, serverName, match, { timeoutMs = 60_000, intervalMs = 500 } = {}) {
  const deadline = Date.now() + timeoutMs
  let last = null
  for (;;) {
    const st = await p6t6State(host.port)
    const slots = findMcpSlots(st.body, serverName)
    last = slots
    const hit = slots.find(match)
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) {
      throw new Error(`no ${serverName} materialization slot matched within ${timeoutMs}ms; slots=${JSON.stringify(slots)}`)
    }
    await sleep(intervalMs)
  }
}

// ── the saved team blueprints ───────────────────────────────────────────────

const LEADER_TEAM_TOOLS = [
  'team_delegate', 'team_follow_up', 'team_create_member', 'team_collect',
  'team_send_message', 'team_report_progress', 'team_request_control',
  'team_resolve_control', 'team_list_pending_control', 'team_list_members',
  'team_list_templates', 'team_inspect_config', 'team_archive_member',
]
// The 19 production-host built-ins the A2C-2 Permission Coverage Gate names
// as ownerless under this world's row (7 unknown-unmanaged + 12
// known-sensitive-unmanaged) — the spill team's `builtinToolDeny` removes
// exactly these so the narrow `bash` + team-tools surface passes the gate
// (the PR#35 TVS fixture answer — a fixture, not a plugin change).
const UNMANAGED_BUILTINS = [
  'ask_user_question', 'create_goal', 'exit_plan_mode', 'get_goal',
  'glob', 'grep', 'interrupt_agent', 'job_kill', 'job_list', 'job_output',
  'list_agents', 'present', 'send_message', 'skill', 'subagent_fork',
  'update_goal', 'web_fetch', 'web_search', 'workflow',
]

/** The main scenario team (v2): the requirement matrix under test. */
function mainTeamBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 2',
    `blueprintId: ${BP_MAIN_ID}`,
    'revision: "1"',
    'teamRequirements:',
    '  - requirementId: team.mcp.repo',
    '    type: mcpServer',
    `    subjects: [${S_REPO}]`,
    '    complete: true',
    '  - requirementId: team.mcp.leaderreq',
    '    type: mcpServer',
    `    subjects: [${S_LEADERREQ}]`,
    '    complete: true',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the PR-F gap smoke team. Nonce ${NONCE}. When asked to delegate, call the delegated tool EXACTLY once and then answer with the done marker.`)}`,
    // The main gap team declares NO optional requirements — team.create
    // proceeds without a consent seed (E.12 S2 owns the consent scenario).
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS.map((t) => `        - ${t}`),
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    // W2-A live-probe world design: the LEADER (the team's always-live
    // session) mounts EVERY row-configured MCP server. The team-scoped
    // servers (repo/leaderreq) have no other live mount surface, and the
    // worker-scoped web must be proable at admission time — BEFORE the
    // worker instance is attached (the gate reads fresh live facts before
    // the effect runs; a cold worker is `not-applicable`, never a
    // fabricated failure). A STOPPED server therefore fails the leader's
    // mount (isolated per-server slot) → the probe answers `unreachable`
    // → the DOWN cell. `mcp_signal` is allowed but never configured
    // (excluded from the reconcile target by the configured∩allow filter).
    '    mcp:',
    '      kind: allow',
    '      items:',
    `        - ${S_REPO}`,
    `        - ${S_LEADERREQ}`,
    `        - ${S_SIGNAL}`,
    `        - ${S_WEB}`,
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify('You are a worker of the PR-E smoke team. Do exactly what the work unit says, then finish.')}`,
    '    requirements:',
    '      - requirementId: worker.mcp.web',
    '        type: mcpServer',
    `        subjects: [${S_WEB}]`,
    '        complete: true',
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    // A2C-2 permission-coverage gate: the worker DECLARES
    // capabilities.permissions (read allow / bash ask / default deny), so
    // EVERY tool on the final model-facing surface needs an authority
    // owner. The 0.1.7-rc.1 host surface carries 19 tools outside the
    // closed SAFE/managed registries (12 known-sensitive + 7 unknown:
    // ask_user_question, create_goal, exit_plan_mode, get_goal, present,
    // skill, update_goal) — FATAL unless the capability layer removes them
    // first (permission-coverage.ts: "unless the capability layer (e.g.
    // builtinToolDeny) removed it first"). Deny exactly the unmanaged set
    // observed on this host; the remaining surface (read/bash + the
    // managed vocabulary + todo_write) is owner-covered.
    '      builtinToolDeny:',
    ...WORKER_SURFACE_DENY.map((t) => `        - ${t}`),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items:',
    `          - ${S_WEB}`,
    '      permissions:',
    '        default: deny',
    '        allow:',
    '          - tool: read',
    '            resource:',
    '              kind: any',
    '        ask:',
    '          - tool: bash',
    '            resource:',
    '              kind: any',
    '        deny: []',
    '  - templateId: helper',
    `    persona: ${JSON.stringify('You are a helper of the PR-E smoke team. Do exactly what the work unit says, then finish.')}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    // K4 (run-5 live finding): the PR-E recovery dispatch (plan §E.9) opens
    // the human-reviewed control request THROUGH the caller's mutation
    // envelope as the `request-control` op (router.ts requestControl
    // caller = the leader; P6-T4 requester-envelope semantics). Every
    // canonical leader fixture (p6t2/p8s6/t12*) carries it; a leader
    // without it fails closed with TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS on
    // every requiredScopeDown recovery offer (the E.11 unit world's fake
    // control service never enforced the envelope). The same op is added
    // to the iso + persona leader envelopes below (uniform leader shape).
    // K12 (run-6 prep, source-verified): the router's abort branch
    // (action-router/router.ts:367) calls abandonControlRequest with
    // caller = the leader, and control/service.ts abandonControlRequest
    // enforces the RESOLVE_CONTROL_SPEC envelope (reused op — abandon is a
    // control-request mutation). Without resolve-control in the leader
    // envelope the durable control-request-abandoned fact is never written
    // (best-effort catch) and S10's terminal-abandon evidence check fails.
    // The canonical leader fixture (p6t2-helpers.ts) carries it.
    '    - request-control',
    '    - resolve-control',
    '  deny:',
    '    - delete-team',
  // K11 (run-6 prep, source-verified): a MEMBER's effective envelope is
    // teamEnvelope.allow INTERSECTED with its template's memberEnvelopes
    // entry allow (admission/envelope.ts callerEnvelope — role 'member' →
    // templateAllow gate). The A2C permission-ask path
    // (operation-permission/pre-execute-adapter.ts:1321) opens the durable
    // control request with caller = the WORKER, and control/service.ts:1337
    // enforces requestControl against THAT envelope (REQUEST_CONTROL_SPEC).
    // Without this entry the S7 degraded member's controlled bash (ASK lane)
    // fails closed with TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS before any
    // control row exists (the ask never opens; the worker's turn ends with
    // the call denied). Canonical P6-T2 fixtures grant request-control to
    // the scout template for exactly this reason.
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - request-control',
    'policyStates:',
    '  - id: default',
    '    description: "PR-F main team default state."',
    // G3 subject: a second declared state — the bound blueprint's closed set
    // (default + paused) is the policyState.get/set authority (F11: the
    // ADDRESSED team's bound Blueprint, resolved under the production
    // three-case contract — case 3, the catalog snapshot with hash check).
    '  - id: paused',
    '    description: "PR-F main team paused state (the G3 closed-set subject)."',
    'quotas:',
    '  team:',
    '    maxInstances: 12',
    '    maxConcurrent: 12',
    '  members:',
    '    maxInstances: 8',
    '    maxConcurrent: 4',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/** The isolation team (v2): NARROWER requirements (repo only) — the S14
 *  proof that per-ROOT durable state is isolated even though the world
 *  facts (row level) are shared. */
/** The subagent-surface team (v2): the G9 subject — the worker declares
 *  the strict permission surface WITHOUT the unmanaged builtinToolDeny set:
 *  on the 0.1.7-rc.1 host the A2C-2 coverage gate (19 unmanaged tools, 12
 *  known-sensitive incl. subagent_fork) must fail the worker's setup
 *  CLOSED (no false open, zero durable instance). The leader is plain (no
 *  strict surface) so team.create itself proceeds — the gate fires at the
 *  first delegate (the worker agent's setup). */
function subagentTeamBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 2',
    `blueprintId: ${BP_SUB_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the PR-F subagent-surface team. Nonce ${NONCE}. When asked to delegate, call the delegated tool EXACTLY once and then answer with the done marker.`)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS.map((t) => `        - ${t}`),
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify('You are a worker of the PR-F subagent-surface team. Do exactly what the work unit says, then finish.')}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    // G9 subject: the strict surface with NO unmanaged builtinToolDeny set —
    // the A2C-2 coverage gate must fail closed (the E.12 main worker is the
    // same surface WITH the 19-tool deny — the documented escape).
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: deny',
    '        allow:',
    '          - tool: read',
    '            resource:',
    '              kind: any',
    '        ask:',
    '          - tool: bash',
    '            resource:',
    '              kind: any',
    '        deny: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - request-control',
    'policyStates:',
    '  - id: default',
    '    description: "PR-F subagent-surface team default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 6',
    '    maxConcurrent: 6',
    '  members:',
    '    maxInstances: 4',
    '    maxConcurrent: 2',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/** The spill team (v1, the PR#35 real-spill fixture — the proven E2E
 *  writer path; the run-3 worker-read variant produced NO durable fact).
 *  Leader-only: the A2C-1 shell contract rejects a positive whole-tool
 *  `bash` allow for MEMBER templates; the leader allow-lane whole-tool
 *  'any' rule is the exec-autonomy-contract exception, runtime-valid only
 *  under the mutation-envelope dual gate — satisfied by teamEnvelope.
 *  allow carrying the 'bash' exec token (no memberEnvelopes entry -> the
 *  effective set is the teamEnvelope allow minus deny). The `permissions`
 *  block is what makes the agent grant-eligible at all (the live glue
 *  installs the tools/result observer ONLY alongside a permissions
 *  policy; a policy-free agent would only mint inert dead facts).
 *  `builtinToolDeny` carries the 19 production-host built-ins the A2C-2
 *  Permission Coverage Gate names as ownerless — the surface is
 *  deliberately narrow: `bash` + the team tools. */
function spillTeamBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${BP_SPILL_ID}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the PR-F spill team (nonce ${NONCE}). When given a work unit, do exactly what it says, then answer with the done marker.`)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS.map((t) => `        - ${t}`),
    '    builtinToolDeny:',
    ...UNMANAGED_BUILTINS.map((t) => `      - ${t}`),
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: bash',
    '          resource:',
    '            kind: any',
    '      ask: []',
    '      deny: []',
    'members: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - bash',
    '  deny: []',
    'memberEnvelopes: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

function isoTeamBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 2',
    `blueprintId: ${BP_ISO_ID}`,
    'revision: "1"',
    'teamRequirements:',
    '  - requirementId: team.mcp.repo',
    '    type: mcpServer',
    `    subjects: [${S_REPO}]`,
    '    complete: true',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the PR-E isolation team. Nonce ${NONCE}. When asked to delegate, call the delegated tool EXACTLY once and then answer with the done marker.`)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_delegate',
    '        - team_follow_up',
    '        - team_list_members',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify('You are a worker of the PR-E isolation team. Do exactly what the work unit says, then finish.')}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    // K4 (run-5 live finding): the PR-E recovery dispatch (plan §E.9) opens
    // the human-reviewed control request THROUGH the caller's mutation
    // envelope as the `request-control` op (router.ts requestControl
    // caller = the leader; P6-T4 requester-envelope semantics). Every
    // canonical leader fixture (p6t2/p8s6/t12*) carries it; a leader
    // without it fails closed with TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS on
    // every requiredScopeDown recovery offer (the E.11 unit world's fake
    // control service never enforced the envelope). The same op is added
    // to the iso + persona leader envelopes below (uniform leader shape).
    // K12 (run-6 prep, source-verified): the router's abort branch
    // (action-router/router.ts:367) calls abandonControlRequest with
    // caller = the leader, and control/service.ts abandonControlRequest
    // enforces the RESOLVE_CONTROL_SPEC envelope (reused op — abandon is a
    // control-request mutation). Without resolve-control in the leader
    // envelope the durable control-request-abandoned fact is never written
    // (best-effort catch) and S10's terminal-abandon evidence check fails.
    // The canonical leader fixture (p6t2-helpers.ts) carries it.
    '    - request-control',
    '    - resolve-control',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes: []',
    'policyStates:',
    '  - id: default',
    '    description: "PR-E isolation team default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 6',
    '    maxConcurrent: 6',
    '  members:',
    '    maxInstances: 4',
    '    maxConcurrent: 2',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/** The persona team (v2): the S12 `ptc` regression subject. */
function personaTeamBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 2',
    `blueprintId: ${BP_PERSONA_ID}`,
    'revision: "1"',
    'teamRequirements:',
    '  - requirementId: team.persona.standard',
    '    type: persona',
    '    subjects: [standard]',
    '    complete: true',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the PR-F persona team. Nonce ${NONCE}. When asked to delegate, call the delegated tool EXACTLY once and then answer with the done marker.`)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_delegate',
    '        - team_follow_up',
    '        - team_list_members',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify('You are a worker of the PR-F persona team. Do exactly what the work unit says, then finish.')}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    // K4 (run-5 live finding): the PR-E recovery dispatch (plan §E.9) opens
    // the human-reviewed control request THROUGH the caller's mutation
    // envelope as the `request-control` op (router.ts requestControl
    // caller = the leader; P6-T4 requester-envelope semantics). Every
    // canonical leader fixture (p6t2/p8s6/t12*) carries it; a leader
    // without it fails closed with TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS on
    // every requiredScopeDown recovery offer (the E.11 unit world's fake
    // control service never enforced the envelope). The same op is added
    // to the iso + persona leader envelopes below (uniform leader shape).
    // K12 (run-6 prep, source-verified): the router's abort branch
    // (action-router/router.ts:367) calls abandonControlRequest with
    // caller = the leader, and control/service.ts abandonControlRequest
    // enforces the RESOLVE_CONTROL_SPEC envelope (reused op — abandon is a
    // control-request mutation). Without resolve-control in the leader
    // envelope the durable control-request-abandoned fact is never written
    // (best-effort catch) and S10's terminal-abandon evidence check fails.
    // The canonical leader fixture (p6t2-helpers.ts) carries it.
    '    - request-control',
    '    - resolve-control',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes: []',
    'policyStates:',
    '  - id: default',
    '    description: "PR-F persona team default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 6',
    '    maxConcurrent: 6',
    '  members:',
    '    maxInstances: 4',
    '    maxConcurrent: 2',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/** The row anchor: a plain LEGACY v1 leader (no capabilities, no
 *  requirements) — the directive root (C.10 pattern). */
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: ${JSON.stringify(`You are the leader of the PR-F gap smoke boot team. ${NONCE} is the run nonce.`)}`,
  'members: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

// ── the production row config + profile-patch emitter ───────────────────────

/** The STATIC row `mcpServers` config — identical in EVERY boot (W2-A: the
 *  supply axis is a row-level CONFIGURATION, not a per-boot knob; "recovery
 *  is reconfiguration" — a down cell is the STOPPED process, never a
 *  removed/absent config entry). `mcp_signal` is deliberately ABSENT — the
 *  S2 optional-missing lives on the supply axis (deterministic
 *  `unreachable`, source 'supply'; no probe, no live server ever). */
const ROW_MCP_SERVERS = [
  { name: S_REPO, port: PORT_REPO },
  { name: S_LEADERREQ, port: PORT_LEADERREQ },
  { name: S_WEB, port: PORT_WEB },
]

/** One boot's row config: the per-boot world truth (environmentFacts = the
 *  STATIC bootstrap seed — under W2-A it fills only `unknown` live verdicts
 *  and is never flipped per phase; mcpServers = the configured supply axis;
 *  presetSubstrate = the SCRIPTED persona seam (the legacy test-world port);
 *  rootPresetId / memberPresetId = the LIVE substrate authority (the
 *  D-2a re-scope — ABSENT presetSubstrate + the production host's
 *  requirementFacts authority → the production persona observer reads the
 *  actually-mounted preset through the DSH public `agentPresets` seam:
 *  `compositionInventory` + `readDocument`; a no-persona-row preset
 *  observes `absent` — never a shipped-state guess). */
function teamRowConfig({ bootPhase, facts, mcpServers, presetSubstrate, rootPresetId, memberPresetId }) {
  return {
    rootSessionId: ROOT,
    bootPhase,
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'prf-smoke-model' },
    deniedSelection: null,
    mcpServers,
    mcpServer: null,
    environmentFacts: facts,
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    ...(presetSubstrate !== undefined ? { presetSubstrate } : {}),
    ...(rootPresetId !== undefined ? { rootPresetId } : {}),
    ...(memberPresetId !== undefined ? { memberPresetId } : {}),
    glueUrl: pathToFileURL(GLUE_PATH).href,
    seamUrl: pathToFileURL(SEAM_PATH).href,
  }
}

function envFacts({ repo, leaderreq, web, signal, persona }) {
  const f = []
  // Fact domain == the v2 requirement TYPE (engine.ts: factByKey =
  // `${requirement.type}\u0000${subject}`) — mcpServer, not 'mcp'.
  const add = (subject, available) => {
    if (available !== null) f.push({ domain: 'mcpServer', subject, available, generation: 1 })
  }
  add(S_REPO, repo)
  add(S_LEADERREQ, leaderreq)
  add(S_WEB, web)
  add(S_SIGNAL, signal)
  if (persona !== null) f.push({ domain: 'persona', subject: 'standard', available: persona, generation: 1 })
  return f
}

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

function writeTeamPatchFile(patchPath, rowConfig, comment) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# pre-alpha3 PR-F F.6 gap patch layer (world ${RUN_STAMP}): production dsh-agent-team row (WORKTREE dist — this branch's build) + p6t6 observability row + the D-2a \`bare\` preset (a composable preset with NO persona row — the LIVE-ABSENT persona world; the production persona observer maps it to kind \`absent\` (source effective-composition) and the required-standard persona requirement FATALs (PERSONA_INCOMPATIBLE) — the S12b re-scope subject) — mounted ONLY through this public profile-patch seam (CORE PATCH BUDGET = 0).`,
    `# ${comment}`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: rowConfig }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...yamlEmitItem({
      id: 'preset-bare',
      name: '@deepseek-ai/dsh-agent-preset',
      config: {
        id: 'bare',
        order: 9,
        plugins: [
          { id: 'agent-instructions', name: '@deepseek-ai/dsh-agent-instructions', config: { maxBytes: 65536 } },
        ],
      },
    }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── world boot / stop ───────────────────────────────────────────────────────

let host = null // the single live host record (one world, one port, 12 boots)
const liveHosts = new Set()

function assertFreshHome(homePath, label) {
  if (existsSync(homePath)) {
    const entries = readdirSync(homePath)
    if (entries.length > 0) {
      dieFatal(`${label}: DSH home ${homePath} exists and is non-empty (${entries.length} entries) — fail CLOSED; delete it to re-run`)
    }
  }
  mkdirSync(homePath, { recursive: true })
  writeFileSync(LOCK_FILE, JSON.stringify({
    world: homePath,
    pid: process.pid,
    kit: 'pr-f-closure-smoke.mjs',
    runStamp: RUN_STAMP,
    at: new Date().toISOString(),
  }, null, 2))
}

async function bootHost({ label, port, boot, phase, facts, mcpServers, presetSubstrate, rootPresetId, memberPresetId, comment }) {
  const instLogDir = join(RUN_DIR, 'instances', label)
  mkdirSync(instLogDir, { recursive: true })
  const instance = new DshInstance({
    hostTree: HOST_TREE,
    dshHome: HOME,
    port,
    clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: instLogDir,
  })
  const rec = {
    label, port, boot, phase, instance,
    logPath: null, url: null, token: null, cookie: null, origin: null, health: null, dumpText: null,
  }
  const rowConfig = teamRowConfig({ bootPhase: phase, facts, mcpServers, presetSubstrate, rootPresetId, memberPresetId })
  writeTeamPatchFile(instance.patchFile, rowConfig, comment)
  // p6t6 directive: the parser validates `boot` to 1-4 (plugin.mjs:170) and
  // the semantic mode is `phase` — the kit's 12 boots compress to
  // 1=create / 2=resume (the kit's own counter rides in the labels/EVID).
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: phase === 'create' ? 1 : 2,
    phase,
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    kitBoot: boot,
    rootSessionId: ROOT,
    mcpPort: PORT_LEADERREQ,
  }, null, 2))
  log(`${label}: patch (bootPhase=${phase}, facts=${JSON.stringify(facts.map((f) => `${f.subject}=${f.available}`))}, mcp=${JSON.stringify(mcpServers)}, preset=${presetSubstrate !== undefined ? JSON.stringify(presetSubstrate) : `live root=${rootPresetId ?? 'default'} member=${memberPresetId ?? 'default'}`}) + directive (boot=${boot}) written`)
  const started = await instance.start({ timeoutMs: 240_000 })
  rec.url = started.url
  rec.logPath = started.logPath
  liveHosts.add(rec)
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) dieFatal(`${label}: unexpected boot url shape: ${scrubTokens(started.url)}`)
  rec.token = m[2]
  rec.origin = `http://127.0.0.1:${m[1]}`
  const bare = await fetch(`http://127.0.0.1:${m[1]}/`, { signal: AbortSignal.timeout(15_000) }).catch(() => null)
  log(`${label}: bare GET / -> ${bare === null ? 'unreachable' : bare.status} (expected 401 = launch-token gate)`)
  rec.cookie = await authenticate(rec.origin, rec.token)
  log(`${label}: booted at ${rec.origin}; auth cookie exchanged`)
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  rec.dumpText = dump.text
  writeFileSync(join(RUN_DIR, 'instances', label, 'dump-config.txt'), dump.text)
  if (!DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME })) {
    dieFatal(`${label}: production row not in composed profile dump`)
  }
  if (!DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_ROW_NAME })) {
    dieFatal(`${label}: p6t6 row not in composed profile dump`)
  }
  const deadline = Date.now() + 240_000
  for (;;) {
    const hb = await p6t6Health(port)
    rec.health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      dieFatal(`${label}: row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}; log tail:\n${logTail(rec.logPath, 25)}`)
    }
    if (Date.now() >= deadline) {
      dieFatal(`${label}: row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 400)}; log tail:\n${logTail(rec.logPath, 25)}`)
    }
    await sleep(1000)
  }
  host = rec
  log(`${label}: row ready — toolCount=${rec.health.body?.toolCount}`)
  return rec
}

async function stopHost(rec) {
  try {
    const res = await rec.instance.stop({ timeoutMs: 20_000 })
    log(`${rec.label}: stopped (killed=${res.killed} portFree=${res.portFree})`)
  } finally {
    liveHosts.delete(rec)
    if (host === rec) host = null
  }
}

async function sweepLiveHosts() {
  for (const rec of [...liveHosts]) {
    log(`sweep: stopping still-live host ${rec.label}`)
    try { await stopHost(rec) } catch (error) { log(`sweep: ${rec.label} stop error: ${error.message}`) }
  }
}

// ── the scripted delegate attempt (the heart of the gate) ───────────────────

/**
 * Fire ONE leader team-tool call through the p6t6 seam (async:false — the
 * call returns when the work unit settles) and, in parallel, resolve the
 * control requests it opens per `policy`:
 *   recovery: 'allow' | 'deny' | 'abandon' (the recovery dispatch request —
 *             correlation prefix `recovery:`)
 *   approval: 'allow' | 'never'   (the member's permission-ASK requests —
 *             e.g. the S7 bash ask)
 * Returns { tool, decisions, pendingSeen } — `tool` is the p6t6 response,
 * `decisions` the resolved requests (requestId + class + decision),
 * `pendingSeen` every pending request observed (the S9 payload capture).
 */
async function leaderAttempt(rec, tag, policy, { timeoutMs = 200_000 } = {}) {
  const call = leaderCallFor(tag)
  const toolPromise = p6t6Tool(rec.port, call.name, call.args, call.args.rootSessionId, timeoutMs)
  const decisions = []
  const pendingSeen = []
  const seen = new Set()
  let stop = false
  const rootSessionId = call.args.rootSessionId
  const poll = (async () => {
    while (!stop) {
      await sleep(600)
      try {
        const entries = await ledgerEntries(rec, rootSessionId)
        const pending = pendingControlRequests(entries)
        for (const req of pending) {
          const rid = req.requestId
          if (seen.has(rid)) continue
          seen.add(rid)
          pendingSeen.push({ requestId: rid, kind: req.kind, correlation: req.correlation ?? null, toolName: req.toolName ?? null, actionName: req.actionName ?? null, reviewPayload: req.reviewPayload ?? null, reviewPayloadDigest: req.reviewPayloadDigest ?? null, executionCoupling: req.executionCoupling ?? null })
          const isRecovery = typeof req.correlation === 'string' && req.correlation.startsWith('recovery:')
          if (isRecovery) {
            if (policy.recovery === 'abandon') continue // NEVER resolve — the 120s abort seam
            const r = await resolveControl(rec, rootSessionId, rid, policy.recovery, `kit e12 ${tag} (${policy.recovery})`, `resolve-${tag}-${rid.slice(0, 8)}`)
            decisions.push({ requestId: rid, class: 'recovery', decision: policy.recovery, resolveStatus: r.status, resolveError: resultError(r.body)?.code ?? null })
          } else {
            if (policy.approval === 'allow') {
              const r = await resolveControl(rec, rootSessionId, rid, 'allow', `kit e12 ${tag} (ask approval)`, `resolve-${tag}-${rid.slice(0, 8)}`)
              decisions.push({ requestId: rid, class: 'ask', decision: 'allow', resolveStatus: r.status, resolveError: resultError(r.body)?.code ?? null })
            }
          }
        }
      } catch (error) {
        log(`leaderAttempt ${tag}: poll error (transient): ${String(error?.message ?? error).slice(0, 200)}`)
      }
    }
  })()
  let tool
  try {
    tool = await toolPromise
  } finally {
    stop = true
    await poll.catch(() => { /* settled */ })
  }
  return { tool, decisions, pendingSeen, call }
}

// ── evidence ────────────────────────────────────────────────────────────────

const EVID = {
  transcript: [],
  hostLogs: [],
  stableBefore: null,
  stableAfter: null,
  testUse: null,
  scenarios: {},
  world: {},
}

function saveScenario(name, obj) {
  EVID.scenarios[name] = obj
  try { writeFileSync(join(RUN_DIR, `scenario-${name}.json`), JSON.stringify(obj, null, 2)) } catch { /* best effort */ }
}

function scrubFile(path) {
  let text
  try { text = readFileSync(path, 'utf8') } catch { return 0 }
  const next = scrubTokens(text)
  if (next !== text) writeFileSync(path, next)
  return next !== text ? 1 : 0
}

function scrubDir(dir) {
  let count = 0
  const stack = [dir]
  while (stack.length > 0) {
    const d = stack.pop()
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory()) stack.push(p)
      else count += scrubFile(p)
    }
  }
  return count
}

function finalizeEvidence(verdict, summary) {
  const out = join(RUN_DIR, 'summary.json')
  const results = CRITERIA.map((c) => ({
    id: c.id,
    name: c.name,
    pass: VERDICT.has(c.id) ? VERDICT.get(c.id).pass : true,
    note: VERDICT.get(c.id)?.note ?? '',
  }))
  const allPass = results.every((r) => r.pass)
  writeFileSync(out, JSON.stringify({
    kit: 'pr-f-closure-smoke.mjs',
    runStamp: RUN_STAMP,
    verdict: allPass ? 'PASS' : verdict,
    summary,
    world: HOME,
    testUse: EVID.testUse,
    scenarios: EVID.scenarios,
    worldDumps: EVID.world,
    results,
    at: new Date().toISOString(),
  }, null, 2))
}

// ── main ────────────────────────────────────────────────────────────────────

async function pickPort(candidates) {
  for (const p of candidates) if (!(await portInUse(p))) return p
  return null
}

let HOST_PORT = null
let MOCK_PORT = null
let MOCK = null
const MINI = { repo: null, leaderreq: null, web: null }

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`=== pre-alpha3 PR-F F.6 real-host GAP kit (11 criteria: G1-G9 + H1/H2) ${RUN_STAMP} ===`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${HOST_TREE} @ ${HOST_BASELINE_SHA.slice(0, 10)}`)
  log(`world=${HOME}`)
  log(`evidence=${RUN_DIR}`)

  // ── pre-flight: worktree dist + stable + test-use + ports ─────────────────
  for (const p of [PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH]) {
    if (!existsSync(p)) dieFatal(`required worktree file missing: ${p}`)
  }
  EVID.stableBefore = {}
  for (const u of STABLE_URLS) EVID.stableBefore[u] = await probeStableInstance(u)
  log(`stable pre-probes: ${STABLE_URLS.map((u) => `${new URL(u).port}=${EVID.stableBefore[u].status}`).join(' ')}`)

  const gitPreDir = join(RUN_DIR, 'git-pre')
  mkdirSync(gitPreDir, { recursive: true })
  const gitPre = await captureGitState(HOST_TREE, gitPreDir)
  EVID.testUse = { pre: gitPre }
  writeFileSync(join(RUN_DIR, 'testuse-pre.json'), JSON.stringify({ ...gitPre, baselineSha: HOST_BASELINE_SHA, at: new Date().toISOString() }, null, 2))
  if (gitPre.statusEmpty !== true || gitPre.diffEmpty !== true) {
    dieFatal(`test-use worktree is NOT pristine before the run (porcelain non-empty) — fix before running (TEST_METHODS §3.5)`)
  }
  if (gitPre.head !== HOST_BASELINE_SHA) {
    dieFatal(`test-use HEAD ${gitPre.head} != baseline ${HOST_BASELINE_SHA}`)
  }
  check('H1', 'test-use pristine BEFORE', true, `head=${gitPre.head.slice(0, 12)}`)

  HOST_PORT = await pickPort(HOST_PORT_CANDIDATES)
  if (HOST_PORT === null) dieFatal(`no free host port in ${HOST_PORT_CANDIDATES.join(',')}`)
  MOCK_PORT = await pickPort(MOCK_PORT_CANDIDATES)
  if (MOCK_PORT === null) dieFatal(`no free mock port in ${MOCK_PORT_CANDIDATES.join(',')}`)
  for (const [label, p] of [['repo', PORT_REPO], ['leaderreq', PORT_LEADERREQ], ['web', PORT_WEB]]) {
    if (await portInUse(p)) dieFatal(`port ${label}=${p} is already in use — refusing to start`)
  }
  log(`ports: host=${HOST_PORT} mock=${MOCK_PORT} mcpRepo=${PORT_REPO} mcpLeaderreq=${PORT_LEADERREQ} mcpWeb=${PORT_WEB} (mcp_signal: never configured — the inert supply-axis fact; E.12 owns the consent scenario)`)

  assertFreshHome(HOME, 'smoke world')
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'prf-main.yaml'), mainTeamBlueprintYaml())
  writeFileSync(join(BLUEPRINT_DIR, 'prf-persona.yaml'), personaTeamBlueprintYaml())
  writeFileSync(join(BLUEPRINT_DIR, 'prf-subagent.yaml'), subagentTeamBlueprintYaml())
  writeFileSync(join(BLUEPRINT_DIR, 'prf-spill.yaml'), spillTeamBlueprintYaml())
  // The row anchor (v1, capabilities-less) — the boot-root binding subject
  // (the E.12 S13 frozen-v1 + the dual-team isolation fixtures are E.12-
  // owned and not created by this kit).
  writeFileSync(join(BLUEPRINT_DIR, 'prf-anchor.yaml'), BP_ANCHOR_YAML)
  log(`world materialized: home=${HOME} blueprints=${BLUEPRINT_DIR}`)

  // Services: mock model + the THREE mini-MCPs up front (the C.10 in-process
  // pattern). All three are CONFIGURED on the row in every boot (static
  // `mcpServers`); the per-phase DOWN states are `stopMiniMcp` calls before
  // the relevant boots (B3 web; B5/B6 repo; B7 leaderreq) and the RESTORES
  // are re-`startMiniMcp` (B4 web; B7 repo; B8 leaderreq).
  const mockLogPath = join(RUN_DIR, 'mock.log')
  MOCK = await startMockModel({
    port: MOCK_PORT,
    decide: makeDecide(),
    log: (msg) => { try { writeFileSync(mockLogPath, `${msg}\n`, { flag: 'a' }) } catch { /* ignore */ } },
  })
  if (MOCK.port !== MOCK_PORT) dieFatal(`mock model landed on ${MOCK.port}, expected ${MOCK_PORT}`)
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = 'prf-smoke-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${MOCK.port}`)
  MINI.repo = await startMiniMcp(PORT_REPO, S_REPO)
  MINI.leaderreq = await startMiniMcp(PORT_LEADERREQ, S_LEADERREQ)
  MINI.web = await startMiniMcp(PORT_WEB, S_WEB)

  // The STATIC bootstrap seed (W2-A: it fills only `unknown` live verdicts —
  // it is NEVER flipped per phase; every phase's live state is the
  // RUNNING/STOPPED mini-MCP + the static configured row).
  const factsAll = (persona = null) => envFacts({ repo: true, leaderreq: true, web: true, signal: true, persona })

  try {
    // ── web profile (throwaway boot if first use) ───────────────────────────
    await ensureProfile({
      instance: new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: HOST_PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir: join(RUN_DIR, 'instances', 'profile-init') }),
      log,
      timeoutMs: 180_000,
    })
    log('web profile ensured (throwaway boot if first use)')

    // ══ B1 (create): all up (LIVE) — the G1/G2/G4/G9 world ══════════════
    // All three mini-MCPs RUNNING + all CONFIGURED on the row (static
    // config) — the all-ready cell under the W2-A live-probe contract.
    // The main gap team declares NO optional requirements — team.create
    // proceeds without a consent seed (E.12 S2 owns the consent scenario).
    let G2_STATE = { g1: null, g2: null }
    let WORKER_SESSION = null
    let B = await bootHost({
      label: 'B1-CREATE', port: HOST_PORT, boot: 1, phase: 'create',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B1 create: all three mini-MCPs RUNNING + configured (the all-ready cell; static config in every boot)',
    })
    EVID.hostLogs.push({ bootNum: 1, phase: 'create', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'create' })

    // ── G1: world + v2 create + delegate (scenarios 1 + 13) ────────────────
    {
      // Live preconditions (the E.12 S1 pattern): the row CARRIES the
      // servers (the configured supply axis) AND each mini-MCP ANSWERS live
      // on its port (a JSON-RPC initialize from the kit itself).
      const dumpCarries = [S_REPO, S_LEADERREQ, S_WEB].every((n) => B.dumpText.includes(n))
      const liveUp = {}
      for (const [name, port] of [[S_REPO, PORT_REPO], [S_LEADERREQ, PORT_LEADERREQ], [S_WEB, PORT_WEB]]) {
        const r = await fetchJson(`http://127.0.0.1:${port}/mcp`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'kit-prf', version: '0' } } }),
        }, 10_000)
        liveUp[name] = r.status === 200 && r.body !== null && typeof r.body === 'object' && r.body.result !== undefined
      }
      // The pre-create probe (team scope): OPEN, both team requirements PASS.
      const probe = await probeBlueprint(B, BP_MAIN_ID, 'g1-probe')
      saveScenario('g1-live-preconditions', { dumpCarries, liveUp, probe: probe.verdict ?? probe.error })
      check('G1', 'live preconditions: row config CARRIES all three mcpServers + every mini-MCP ANSWERS initialize; intent.probe team scope OPEN (repo + leaderreq PASS)',
        dumpCarries && Object.values(liveUp).every(Boolean) && (probe.error ?? null) === null
        && probe.verdict?.status === 'OPEN'
        && probe.verdict?.requirements?.every((rq) => rq.outcome === 'PASS'),
        `dumpCarries=${dumpCarries} live=${JSON.stringify(liveUp)} status=${probe.verdict?.status} reqs=${JSON.stringify(probe.verdict?.requirements?.map((rq) => `${rq.requirementId}=${rq.outcome}`) ?? null)}`)

      // The v2 team create (scenario 13) — proceeds without a consent seed.
      const cr = await remoteCallReady(B, 'team.create', { rootSessionId: T, blueprintId: BP_MAIN_ID }, 'g1-create', 1)
      const cErr = resultError(cr.body)
      if (cErr !== null) dieFatal(`team.create (T main) failed: ${cErr.code} — ${String(cErr.message).slice(0, 300)}`)
      log(`T created: durable=${JSON.stringify(resultData(cr.body)?.durable ?? null).slice(0, 300)}`)
      saveScenario('g1-create', { data: resultData(cr.body) })

      // PR-F-CORRECTION round 2 (G4 rerun-1 determination): the W2-A live
      // surface must exist BEFORE the FIRST instance setup. The mcp mount
      // target is computed at session setup ONLY (agent-bindings.mjs
      // L2246-2261: configured ∩ template-allow ∩ durable-cell-per-server;
      // reconcileMcpSet once at setup) — a live session is NOT
      // re-reconciled on override.set (only the resume/restart boot path
      // re-applies the durable truth, L2230-2231). The baseline is
      // fail-closed ("no durable allow -> no mount", L2229): at the g1
      // delegate there is no override yet, so the worker (and the leader)
      // never target mcp_web -> every "web ping" is an unknown-tool fake
      // and the B3 web-down cell can never engage the worker-boundary
      // recovery (the rerun-1 g4a turn hung 90s with no web tool). This
      // setup write (the full configured surface, web INCLUDED) puts the
      // durable cell in place before any instance exists. It is the
      // world-design precondition, NOT part of the G2 generation-guard
      // sequence — G2 runs on TOP of it (its acks therefore start at
      // generation 2).
      const setupOv = await remoteCallReady(B, 'override.set', { teamSessionId: T, capability: 'mcp', scope: 'team', value: { kind: 'allow', items: [S_REPO, S_WEB, S_LEADERREQ, 'extra-surface'] }, actor: { kind: 'human' } }, 'g2-setup-world-cell', 7)
      if (resultError(setupOv.body) !== null) dieFatal(`G2 world-setup override failed: ${JSON.stringify(resultError(setupOv.body)).slice(0, 300)}`)
      saveScenario('g2-setup-world-cell', { data: resultData(setupOv.body) })

      // Delegate g1: the worker's web ping + DONE (scenario 1's delegate).
      const { tool, pendingSeen } = await leaderAttempt(B, 'g1', { recovery: 'abandon', approval: 'never' })
      const g1Done = await waitForTurnDone(MOCK, MKW('g1'), DONE_W('g1'), 90_000)
      check('G1', 'delegate g1 EXECUTED (worker web pong + DONE; no control request)',
        tool.body?.ok === true && tool.body?.value?.status === 'executed' && g1Done !== null && pendingSeen.length === 0,
        `toolOk=${tool.body?.ok === true} targetInstanceId=${delegateInstanceId(tool.body?.value ?? null) ?? '?'} doneWitness=${g1Done !== null} pendingControlRequests=${pendingSeen.length}`)
      saveScenario('g1-delegate', { toolOutcome: tool.body?.value ?? tool.body?.error ?? null, pendingSeen })
    }

    // ── G2: governance mutation — v7 override + the F10 guard ──────────────
    {
      // The slot writer: capability `mcp`, TEAM scope — an ADMIT-kind value
      // (an explicit admission of the already-available repo surface). The
      // wire is v7 (the w1a contract — the v1–v7 correction), actor = the
      // kit as human (the governance lane).
      // PR-F-CORRECTION (G4 determination, kit-side defect (a)): the
      // team-scope mcp cell is a CLOSED allow-list (mcp-facet.ts L96
      // fail-closed) and record-backed layers WIN over the template static
      // grant — the original [S_REPO] payload excluded mcp_web from EVERY
      // agent's mount target (mount target = template-allow ∩ durable cell,
      // agent-bindings.mjs L2251), so the worker's web requirement was
      // "satisfied by declaration" and the down cell never engaged. The
      // cell now carries the full configured surface list — web INCLUDED —
      // so the durable cell stops closing the web mount off and the
      // pre-boot-stop down cell exercises the real W3-A mechanism.
      // PR-F-CORRECTION round 2 (rerun-1 G2 determination): set1 and set2
      // must carry DIFFERENT values. override.set is an IDEMPOTENT NO-OP on
      // an unchanged value (s6-remote.ts L2740-2759: `result.changed ?
      // result.record : result.current` — the ack carries the CURRENT
      // winner's generation + `noChange: true`, NO generation bump).
      // Rerun-1 evidence: with set1 == set2 (both 4-item) the set2 ack was
      // `noChange: true, generation: 1` (scenario-g2-override-guard.json),
      // the "stale" set3 then wrote against gen 1 (no conflict — gen 2),
      // and the slot ended at [mcp_repo] — which is why the B3 boot's
      // fresh reconcile again excluded web from every mount target.
      // set1 = 3-item surface, set2 = 4-item (adds 'extra-surface'): both
      // are real writes (gen bump), the guard sequence is intact, and the
      // slot ENDS at the 4-item web-included cell (the G4 precondition).
      const set1 = await remoteCallReady(B, 'override.set', { teamSessionId: T, capability: 'mcp', scope: 'team', value: { kind: 'allow', items: [S_REPO, S_WEB, S_LEADERREQ] }, actor: { kind: 'human' } }, 'g2-set-1', 7)
      const e1 = resultError(set1.body)
      const d1 = resultData(set1.body)
      G2_STATE.g1 = typeof d1?.generation === 'number' ? d1.generation : null
      // The SECOND writer updates the same slot (fresh expectedGeneration =
      // the first writer's ack) -> generation g2.
      const set2 = await remoteCallReady(B, 'override.set', { teamSessionId: T, capability: 'mcp', scope: 'team', value: { kind: 'allow', items: [S_REPO, S_WEB, S_LEADERREQ, 'extra-surface'] }, actor: { kind: 'human' }, expectedGeneration: G2_STATE.g1 }, 'g2-set-2', 7)
      const e2 = resultError(set2.body)
      const d2 = resultData(set2.body)
      G2_STATE.g2 = typeof d2?.generation === 'number' ? d2.generation : null
      // The FIRST writer returns with the STALE expectedGeneration (its own
      // g1 ack) -> the optimistic guard fires: typed OVERRIDE_GENERATION_
      // CONFLICT, ZERO write.
      const set3 = await remoteCallReady(B, 'override.set', { teamSessionId: T, capability: 'mcp', scope: 'team', value: { kind: 'allow', items: [S_REPO] }, actor: { kind: 'human' }, expectedGeneration: G2_STATE.g1 }, 'g2-set-stale', 7)
      const e3 = resultError(set3.body)
      const rd = await remoteCallReady(B, 'override.get', { teamSessionId: T, capability: 'mcp', scope: 'team' }, 'g2-read-after-stale', 7)
      const rdData = resultData(rd.body)
      // run-3 shape pin: override.get wraps the record under `override`
      // (the set response is the FLAT record; the get response is
      // {override: {schemaVersion, kind, recordId, scope, rootSessionId,
      // values: {mcp: {kind, items}}, generation, updatedAt}}).
      const rdOv = rdData?.override ?? rdData
      check('G2', 'v7 override: ack g1 -> second writer (expectedGeneration=g1) ack g2 -> FIRST writer STALE expectedGeneration=g1 -> typed OVERRIDE_GENERATION_CONFLICT + zero write (the read still g2)',
        e1 === null && G2_STATE.g1 !== null && e2 === null && G2_STATE.g2 === (G2_STATE.g1 ?? 0) + 1
        && e3?.code === 'OVERRIDE_GENERATION_CONFLICT'
        && rdOv?.generation === G2_STATE.g2
        && rdOv?.values?.mcp?.kind === 'allow'
        && Array.isArray(rdOv?.values?.mcp?.items) && rdOv.values.mcp.items.includes('extra-surface'),
        `g1=${G2_STATE.g1} g2=${G2_STATE.g2} staleErr=${e3?.code ?? 'null'} readGen=${rdOv?.generation} readItems=${JSON.stringify(rdOv?.values?.mcp?.items ?? null)}`)
      saveScenario('g2-override-guard', {
        set1: { error: e1, data: d1 }, set2: { error: e2, data: d2 },
        stale: { error: e3 }, readAfterStale: rdData,
      })
    }

    // ── G4: multi-MCP A/B healthy, C down (scenario 4) ─────────────────────
    {
      // All up: delegate g4a -> DONE (the worker's web pong).
      const { tool: ta, pendingSeen: psa } = await leaderAttempt(B, 'g4a', { recovery: 'abandon', approval: 'never' })
      const g4aDone = await waitForTurnDone(MOCK, MKW('g4a'), DONE_W('g4a'), 90_000)
      check('G4', 'all up: delegate g4a EXECUTED (worker web pong + DONE)',
        ta.body?.ok === true && ta.body?.value?.status === 'executed' && g4aDone !== null && psa.length === 0,
        `toolOk=${ta.body?.ok === true} doneWitness=${g4aDone !== null}`)

      // The C-down cell is the B3 boot below — the W2-A down mechanism is
      // the STOPPED mini-MCP BEFORE the boot (the E.12 B3 pattern, 16/16
      // green on the same host). PR-F-CORRECTION (G4 determination): the
      // run-4/5 webSlots diagnostic (all three web slots "pending",
      // mounted false) was read as a "stale durable mounted" state —
      // DISPROVEN: the slot map is EPHEMERAL (agent-bindings.mjs L2028
      // fresh mcpFibers per boot; L2032 "rebuilt from the first
      // post-restart reconcile; never a persisted fabricated failure").
      // The G4 failure had THREE kit-side causes (round-2 record, rerun-1
      // world prf-2026-09-30T05-58-47, inspect-only): (a) the G2 cell
      // excluded mcp_web from every agent's mount target, so the web mount
      // was never attempted (the worker's web requirement was satisfied by
      // declaration) — fixed by the 4-surface G2 payload; (b) the
      // criterion gated on admission-time block, which W3-A (root.ts
      // L845-848) makes impossible for a COLD member — fixed by the
      // worker-boundary criterion (the E.12 S10 shape); (c) SETUP TIMING —
      // the mount target is computed at session setup ONLY (agent-
      // bindings.mjs L2246-2261; a live session is NOT re-reconciled on
      // override.set; the no-record baseline is fail-closed, L2229), and
      // the FIRST worker instance was created by the g1 delegate — BEFORE
      // any override existed. Rerun-1 consequence: no session ever
      // targeted mcp_web (all slots 'pending', attempts null at B3), every
      // "web ping" was an unknown-tool fake, the g4a turn hung the full
      // 90s (mock.log: no DONE_W_g4a; the later requests resolved to the
      // g4b/g4c markers on the shared worker session — the continue-policy
      // reuses ONE instance for g1/g4a/g4b/g4c), and g4b's "work" was a
      // fake pong with no real MCP failure -> no incident -> no recovery
      // dispatch -> no typed rejection. Fixed by the world-setup override
      // written right after team.create (BEFORE the first instance
      // exists — see the G1 block) + the distinct-value G2 sequence (the
      // slot ends at the 4-item web-included cell). Pre-boot stop +
      // web-in-cell -> the worker's web mount FAILS at the B3 fresh
      // reconcile (isolated per-server slot) -> the worker-boundary
      // recovery dispatch is DENIED -> the delegate closes TYPED. (The
      // run-3 pongB finding — the leader session does NOT expose
      // mcp__mcp_leaderreq__ping; the team-scoped servers are requirement
      // surfaces probed at the team scope, not leader model tools — is
      // why the A/B witness is the PROBE, not a leader pong.)
    }

    // ── G9: subagent surface fail-closed (scenario 19) ─────────────────────
    {
      // The subagent team: the plain leader (create proceeds) + the strict-
      // permissions worker WITHOUT the unmanaged builtinToolDeny set — the
      // A2C-2 coverage gate must fail the worker's setup CLOSED on the
      // 0.1.7-rc.1 host (19 unmanaged tools, 12 known-sensitive incl.
      // subagent_fork).
      const cs = await remoteCallReady(B, 'team.create', { rootSessionId: TSUB, blueprintId: BP_SUB_ID }, 'g9-create', 1)
      const csErr = resultError(cs.body)
      if (csErr !== null) dieFatal(`team.create (TSUB subagent-surface) failed: ${csErr.code} — ${String(csErr.message).slice(0, 300)}`)
      log('TSUB created (the plain leader passed the gate; the worker setup is the subject)')
      const { tool: t9 } = await leaderAttempt(B, 'g9', { recovery: 'abandon', approval: 'never' })
      const outcome = JSON.stringify(t9.body ?? null)
      const errText = scrubTokens(String(t9.body?.error?.message ?? t9.body?.value?.message ?? ''))
      // K6 (run-3 shape pin): the coverage-gate closure travels as a
      // CLOSED p6t6 result {ok:true, value:{status:'rejected', code,
      // message, details}} — the ok:false/error branch is reserved for
      // THROWN tool faults.
      const failClosed = closedRejection(t9) || (t9.body?.ok === false && errText.length > 0)
      const citesFork = /subagent_fork/.test(outcome)
      const subLedger = await ledgerEntries(B, TSUB)
      const subInstances = factEntries(subLedger, 'provision-member-instance').length
      check('G9', 'strict worker WITHOUT the unmanaged deny set: team.create proceeds, the first delegate FAILS CLOSED typed (the A2C-2 coverage gate), the uncovered-tool witness carries subagent_fork, zero durable member instance',
        failClosed && citesFork && subInstances === 0,
        `failClosed=${failClosed} citesFork=${citesFork} subInstances=${subInstances} errHead=${errText.slice(0, 200)}`)
      saveScenario('g9-fail-closed', { toolOutcome: t9.body?.value ?? t9.body?.error ?? null, subInstances })
    }

    await stopHost(B)

    // ══ B2 (resume): all up — the intermediate all-up resume boot ═════════
    // The E.12 boot-order match: an all-up resume boot BEFORE the web-down
    // boot. PR-F-CORRECTION (G4 determination): the original comment here
    // argued the resume reconcile left the create-boot web fiber
    // stale-durable "mounted" (the "stale durable mounted" hypothesis) —
    // DISPROVEN: the slot map is EPHEMERAL (agent-bindings.mjs L2028 fresh
    // mcpFibers per boot; L2032 "rebuilt from the first post-restart
    // reconcile; never a persisted fabricated failure"), so EVERY boot's
    // reconcile is fresh. B2 is kept purely as the E.12 16/16 boot-order
    // match (create -> all-up resume -> web-down boot); the down cell
    // engages at the B3 boot's own fresh reconcile (web mount FAILS —
    // isolated per-server slot -> 'failed' materialization, attempts 1).
    B = await bootHost({
      label: 'B2-ALLUP-RESUME', port: HOST_PORT, boot: 2, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B2 resume: all up (the intermediate all-up resume boot — the E.12 16/16 boot-order match; the slot map is ephemeral, every boot reconciles fresh)',
    })
    EVID.hostLogs.push({ bootNum: 2, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })
    await stopHost(B)

    // ══ B3 (resume): C STOPPED before this boot — the G4 C-down cell ═════
    // The W2-A down mechanism (the E.12 B3 pattern): the web mini-MCP is
    // STOPPED (a live state change — the row config stays configured). At
    // this boot the T leader attaches first (the p6t6 call's ensureLive
    // Agent runs the reconcile BEFORE the gate's fresh facts read) and its
    // web mount FAILS (isolated per-server slot) -> the admission probe
    // answers `unreachable` for web before the worker instance is attached
    // -> the template:worker scope is FATAL. The team-scoped servers
    // (repo / leaderreq) stay up — their probes still PASS (the scenario-4
    // multi-MCP isolation witness).
    await stopMiniMcp(MINI.web, 'web')
    B = await bootHost({
      label: 'B3-WEBDOWN', port: HOST_PORT, boot: 3, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B3 resume: web mini-MCP STOPPED before boot (worker required DOWN — the W2-A pre-boot-stop down mechanism); config unchanged',
    })
    EVID.hostLogs.push({ bootNum: 3, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })

    // ── G4 (C-down cell): the pre-boot-stop down cell (scenario 4) ────────
    {
      // The A/B isolation witness: the TEAM-scoped requirements (repo /
      // leaderreq) still PASS at the probe — only the worker-scoped web
      // surface is down. (The team-scoped servers are requirement
      // surfaces, not leader model tools — the run-3 pongB finding — so
      // the witness is the probe, not a leader pong.)
      const probe = await probeBlueprint(B, BP_MAIN_ID, 'g4-probe')
      const pv = probe.verdict ?? null
      const reqOutcome = (id) => pv?.requirements?.find((rq) => rq.requirementId === id)?.outcome ?? null
      const abHealthy = (probe.error ?? null) === null
        && pv?.status === 'OPEN'
        && reqOutcome('team.mcp.repo') === 'PASS'
        && reqOutcome('team.mcp.leaderreq') === 'PASS'
      // C witness — PR-F-CORRECTION (G4 determination, kit-side defect (b):
      // the WRONG GATE). The original criterion asserted admission-time
      // typed COMPATIBILITY_BLOCKED + zeroEffect for the worker's
      // TEMPLATE-scoped requirement. Adjudicated design (root.ts L845-848
      // W3-A): "a COLD member is `not-applicable`, never a blocker; a
      // resident member's failed MCP mount blocks that template's work" —
      // the admission gate reads the TEAM scope (the probe's requirement
      // list is team.mcp.* only), so a cold worker's web requirement can
      // never block ADMISSION. The template-scope requirement is enforced
      // at the RESIDENT worker boundary — proven on this tree by the E.12
      // 16/16 reference (prereq-2026-09-30T03-07-57, b3a/b3b): the web
      // mount FAILS (isolated per-server slot, attempts 1), a recovery
      // dispatch is offered, and the DENY closes the delegate as a TYPED
      // zero-effect block — scenario-b3b-deny.json (16/16):
      //   {status:'rejected', code:'TEAM_RUNTIME_COMPATIBILITY_BLOCKED',
      //    message:'TeamRuntime: the recovery dispatch was denied by the
      //    reviewer — zero durable effect (the operation remains
      //    blocked)',
      //    details:{status:'BLOCKED_FATAL', gateReason:'requiredScopeDown',
      //             blockedScopes:['template:worker'],
      //             source:'requirement-gate', controlDecision:'deny',
      //             controlRequestId:...}}
      // with control-decision-recorded {deny}, NO new member instance and
      // NO new recovery incident (incidents open on the ALLOWED-recovery
      // boundary only — the E.12 S1/S8 lifecycle).
      const before4 = await ledgerEntries(B, T)
      const beforeMembers = before4.filter((e) => e?.factType === 'member-instance-created').length
      const beforeIncidents = factEntries(before4, 'recovery-incident-opened').length
      const { tool: tb, decisions: dc4b, pendingSeen: ps4b } = await leaderAttempt(B, 'g4b', { recovery: 'deny', approval: 'never' })
      const errBody = JSON.stringify(tb.body ?? null)
      const rejectCode = tb.body?.value?.code ?? null
      const denyDecision = dc4b.find((d) => d.class === 'recovery' && d.decision === 'deny')
      const recoveryPending = ps4b.filter((p) => typeof p.correlation === 'string' && p.correlation.startsWith('recovery:'))
      const after4 = await ledgerEntries(B, T)
      const afterMembers = after4.filter((e) => e?.factType === 'member-instance-created').length
      const afterIncidents = factEntries(after4, 'recovery-incident-opened').length
      const deniedRecord = factEntries(after4, 'control-decision-recorded').find((e) => e?.payload?.requestId === denyDecision?.requestId)
      const zeroEffect = deniedRecord?.payload?.decision === 'deny'
        && afterMembers === beforeMembers && afterIncidents === beforeIncidents
        && !after4.some((e) => e?.factType !== 'control-request-recorded' && e?.factType !== 'control-decision-recorded'
        && JSON.stringify(e?.payload ?? null).includes(`rt-g4b-${NONCE}`))
      // The down-cell live witness (the E.12 S7 shape, proven 16/16): the
      // mcp_web slot on the live surface is materialization 'failed' with
      // attempts >= 1 — on the B3 fresh reconcile BOTH mount targets
      // (the T leader, whose template allow carries web, and the worker
      // instance minted at the g1 delegate and continued for g4a/g4b by
      // the default context policy) target web and its mount FAILS; on
      // the deny path no NEW member/incident/work fact is minted and no
      // state is persisted (the slot map is ephemeral per boot, agent-
      // bindings.mjs L2028).
      let webSlots = []
      try { webSlots = findMcpSlots((await p6t6State(HOST_PORT)).body, S_WEB) } catch { webSlots = [{ error: 'p6t6State failed' }] }
      const webFailed = webSlots.some((s) => s.materialization === 'failed' && (s.attempts ?? 0) >= 1)
      check('G4', 'C down (pre-boot stop): probe shows team.mcp.repo + team.mcp.leaderreq still PASS (A/B multi-MCP isolation); delegate g4b ADMITTED at the team-scope gate (W3-A cold-member not-applicable) then CLOSED TYPED TEAM_RUNTIME_COMPATIBILITY_BLOCKED on the DENIED recovery dispatch — the tool error cites the denied control decision, control-decision-recorded {deny}, NO new member instance, NO new incident, no g4b work fact; the mcp_web slot is failed (attempts >= 1) on the live surface (the E.12 S10 proven-on-tree shape)',
        abHealthy && closedRejection(tb) && rejectCode === 'TEAM_RUNTIME_COMPATIBILITY_BLOCKED'
        && /deny|denied|blocked|required scope is down/i.test(errBody)
        && denyDecision !== undefined && recoveryPending.length >= 1 && zeroEffect && webFailed,
        `abHealthy=${abHealthy} (status=${pv?.status} repo=${reqOutcome('team.mcp.repo')} leaderreq=${reqOutcome('team.mcp.leaderreq')}) closedRejection=${closedRejection(tb)} code=${rejectCode} denyDecision=${denyDecision !== undefined} recoveryPending=${recoveryPending.length} zeroEffect=${zeroEffect} (members ${beforeMembers}->${afterMembers}, incidents ${beforeIncidents}->${afterIncidents}) webFailed=${webFailed} webSlots=${JSON.stringify(webSlots)}`)
      saveScenario('g4-c-down', {
        probe: pv ?? probe.error,
        toolOutcome: tb.body?.value ?? tb.body?.error ?? null,
        rejectCode,
        decisions: dc4b,
        pendingSeen: ps4b,
        before: { members: beforeMembers, incidents: beforeIncidents },
        after: { members: afterMembers, incidents: afterIncidents },
        zeroEffect,
        webSlots,
      })
    }

    await stopHost(B)

    // ══ B4 (resume): C remounted — G2 restart-durable + G3 + G4c + G6 +
    //     G8 + G7 ═════════════════════════════════════════════════════════
    // Restart with the web mini-MCP REMOUNTED (a fresh server on 3493) —
    // the scenario-5 restore exit shared with E.12 S8 / F15 R3. The
    // template:worker recovery dispatch (DENIED at the B3 boot's g4b)
    // leaves NO open durable incident (the deny path opens none — the
    // E.12 S1/S8 lifecycle); the next boundary is NORMAL (the fresh
    // reconcile mounts web — the live-state restore; no durable recovery
    // flag is ever written).
    MINI.web = await startMiniMcp(PORT_WEB, S_WEB)
    B = await bootHost({
      label: 'B4-RESTORE', port: HOST_PORT, boot: 4, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B4 resume: C remounted (fresh mini-MCP on 3493) — the restore boundary (scenario 5); governance + policy state restart durability',
    })
    EVID.hostLogs.push({ bootNum: 4, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })

    // ── G2 (second half): the override slot survives the restart ───────────
    {
      const rd = await remoteCallReady(B, 'override.get', { teamSessionId: T, capability: 'mcp', scope: 'team' }, 'g2-read-restart', 7)
      const rdData = resultData(rd.body)
      // run-3 shape pin: override.get wraps the record under `override`
      // (values keyed by capability).
      const rdOv = rdData?.override ?? rdData
      check('G2', 'restart durable: override.get after RESTART -> the slot is still g2 with the second writer values (the governance mutation persisted)',
        rdOv?.generation === G2_STATE.g2
        && rdOv?.values?.mcp?.kind === 'allow'
        && Array.isArray(rdOv?.values?.mcp?.items) && rdOv.values.mcp.items.includes('extra-surface'),
        `gen=${rdOv?.generation} (expected ${G2_STATE.g2}) items=${JSON.stringify(rdOv?.values?.mcp?.items ?? null)}`)
      saveScenario('g2-restart-durable', { read: rdData })
    }

    // ── G3: PolicyState + restart (scenario 3, the F11 re-land) ────────────
    {
      // The bound team's closed set = default + `paused` (the bound
      // blueprint's declared states — F11: the ADDRESSED team's bound
      // Blueprint under the production three-case contract, NOT the boot
      // anchor's states).
      // run-3 shape pin: policyState.get data = {state: {stateId,
      // availableTransitions}}; policyState.set data = {transition:
      // {entryId, origin, state: {stateId}, requestedAtStep,
      // effectiveFromStep}}.
      const g1r = await remoteCallReady(B, 'policyState.get', { teamSessionId: T }, 'g3-get-1', 1)
      const g1d = resultData(g1r.body)?.state ?? null
      check('G3', 'policyState.get (bound team): stateId default, availableTransitions carries `paused` (the bound blueprint closed set — not the boot anchor)',
        resultError(g1r.body) === null && g1d?.stateId === 'default'
        && Array.isArray(g1d?.availableTransitions) && g1d.availableTransitions.includes('paused')
        && !g1d.availableTransitions.includes('default'),
        `stateId=${g1d?.stateId} available=${JSON.stringify(g1d?.availableTransitions ?? null)}`)

      // The switch to `paused` (a changed transition -> entryId + state).
      const s1 = await remoteCallReady(B, 'policyState.set', { teamSessionId: T, target: { stateId: 'paused' }, actor: { kind: 'human' } }, 'g3-set-paused', 1)
      const s1d = resultData(s1.body)
      const s1t = s1d?.transition ?? s1d
      const g2r = await remoteCallReady(B, 'policyState.get', { teamSessionId: T }, 'g3-get-2', 1)
      const g2d = resultData(g2r.body)?.state ?? null
      const afterG3 = await ledgerEntries(B, T)
      const transitions = factEntries(afterG3, 'policy-state-transitioned')
      check('G3', 'policyState.set(paused): changed transition (entryId + state), the read is `paused`, the durable policy-state-transitioned fact lands',
        resultError(s1.body) === null && typeof s1t?.entryId === 'string' && (s1d?.noChange ?? s1t?.noChange) !== true
        && g2d?.stateId === 'paused'
        && Array.isArray(g2d?.availableTransitions) && g2d.availableTransitions.includes('default') && !g2d.availableTransitions.includes('paused')
        && transitions.length >= 1,
        `entryId=${s1t?.entryId ?? 'null'} noChange=${s1d?.noChange ?? s1t?.noChange ?? 'null'} stateAfter=${g2d?.stateId} available=${JSON.stringify(g2d?.availableTransitions ?? null)} transitions=${transitions.length}`)
      saveScenario('g3-paused', { set: s1d, getAfter: g2d })

      // The out-of-closed-set target: typed POLICY_STATE_UNKNOWN (invariant
      // 4b pass-through — zero write).
      const s2 = await remoteCallReady(B, 'policyState.set', { teamSessionId: T, target: { stateId: 'bogus-state' }, actor: { kind: 'human' } }, 'g3-set-bogus', 1)
      const e2 = resultError(s2.body)
      check('G3', 'policyState.set(bogus-state): typed POLICY_STATE_UNKNOWN (out of the closed set — zero write)',
        e2?.code === 'POLICY_STATE_UNKNOWN',
        `err=${e2?.code ?? 'null'} msg=${scrubTokens(String(e2?.message ?? '').slice(0, 200))}`)

      // The foreign root: assertBoundRoot -> typed FOREIGN_TEAM. run-3
      // shape pin: the LIVE remote surface passes the runtime code through
      // verbatim with the transport prefix (TEAM_REMOTE_FOREIGN_TEAM — the
      // K5 verbatim-code behavior), so the assertion matches the suffix.
      const s3 = await remoteCallReady(B, 'policyState.get', { teamSessionId: 'session-prf-foreign-x' }, 'g3-foreign', 1)
      const e3 = resultError(s3.body)
      check('G3', 'policyState.get(foreign root): typed FOREIGN_TEAM (assertBoundRoot — the query is bound-root-guarded)',
        typeof e3?.code === 'string' && /FOREIGN_TEAM$/.test(e3.code),
        `err=${e3?.code ?? 'null'} msg=${scrubTokens(String(e3?.message ?? '').slice(0, 200))}`)
      saveScenario('g3-negatives', { bogus: e2, foreign: e3 })
    }

    // ── G4c: the restore exit — next boundary NORMAL (scenario 5) ──────────
    // The B3 recovery (the g4b deny at the web-down boot) was DENIED
    // (zero effect — no incident opened, no worker minted). At B4 (web
    // remounted), the fresh delegate's admission
    // probe reads web UP -> the template:worker scope is NORMAL -> the
    // delegate EXECUTES (web pong + DONE). No incident to close: the
    // recovery-incident lifecycle is the ALLOWED-recovery path (E.12
    // S1/S8); scenario 5 is the MCP auto-mount restore, and the assertion
    // is that NO incident opens at the restored boundary (web is UP — the
    // gate allows normally).
    {
      const { tool: tc, pendingSeen: psc } = await leaderAttempt(B, 'g4c', { recovery: 'abandon', approval: 'never' })
      const g4cDone = await waitForTurnDone(MOCK, MKW('g4c'), DONE_W('g4c'), 90_000)
      const afterC = await ledgerEntries(B, T)
      const incidentCount = factEntries(afterC, 'recovery-incident-opened').length
      check('G4', 'restore (C remounted after restart): delegate g4c EXECUTED (web pong + DONE) — the next boundary is NORMAL (web auto-mounted at the fresh reconcile); NO recovery incident opens at the restored boundary (scenario 5 exit)',
        tc.body?.ok === true && tc.body?.value?.status === 'executed' && g4cDone !== null && psc.length === 0 && incidentCount === 0,
        `toolOk=${tc.body?.ok === true} doneWitness=${g4cDone !== null} pendingSeen=${psc.length} incidents=${incidentCount}`)
      saveScenario('g4c-restore', { toolOutcome: tc.body?.value ?? tc.body?.error ?? null, incidents: incidentCount })
    }

    // ── G6: spill ArtifactReadGrant (scenario 16 — the PR#35 real-spill
    //     pattern: the LEADER's allow-lane bash under the permissions
    //     policy; the run-3 worker-read variant produced NO durable fact —
    //     the spill writer path is the leader's shell under the dual gate)
    // ───────────────────────────────────────────────────────────────────────
    {
      // The spill team: leader-only, the A2C-1 shell contract (the leader
      // allow-lane whole-tool bash rule is valid only under the mutation-
      // envelope dual gate — teamEnvelope.allow carries the 'bash' exec
      // token) + the permissions policy (the live glue installs the
      // tools/result observer ONLY alongside a permissions policy; a
      // policy-free agent would mint only inert dead facts) + the 19-
      // unmanaged builtinToolDeny (the A2C-2 gate fixture answer).
      // team.create v1 + initialWork runs ONE creation-time work unit on
      // the ROOT session (the synchronous initial-work vertical): the mock
      // leader issues the bash command (300KB stdout > the 64KB inline cap)
      // -> the executor spills the output -> the Team-aware spill store
      // records the durable artifact-read-granted fact (instanceId
      // inst-leader, source shell-foreground/bash).
      const createSpill = await remoteCallReady(B, 'team.create', {
        rootSessionId: TSPILL, blueprintId: BP_SPILL_ID,
        initialWork: { prompt: SPILL_PROMPT },
      }, 'g6-create', 1, 10, 240_000)
      const csErr = resultError(createSpill.body)
      const csOk = csErr === null
      // Settle: the durable artifact-read-granted fact in the TSPILL ledger
      // IS the real-spill chain settlement (executor spill -> observer ->
      // authority -> durable fact). The synchronous vertical usually lands
      // it on the first poll (create returns AFTER the terminal delivered
      // fact); the budget catches an async regression.
      const settleStart = Date.now()
      let grantEntry = null
      let settleMs = null
      while (Date.now() - settleStart < 120_000) {
        const entries = await ledgerEntries(B, TSPILL)
        grantEntry = factEntries(entries, 'artifact-read-granted').pop() ?? null
        if (grantEntry !== null) { settleMs = Date.now() - settleStart; break }
        await sleep(1_500)
      }
      const locator = grantEntry?.payload?.locator
      const grantShape = grantEntry !== null
        && grantEntry.payload?.instanceId === 'inst-leader'
        && grantEntry.payload?.source?.kind === 'shell-foreground'
        && grantEntry.payload?.source?.toolName === 'bash'
        && (typeof locator === 'string' && locator.length > 0 || typeof locator === 'object' && locator !== null)
      check('G6', 'the real spill (PR#35 pattern): team.create v1 + initialWork on the leader-only spill team (bash allow-lane + teamEnvelope exec token + permissions policy + 19-unmanaged deny) runs one bash command (300KB stdout > 64KB inline cap) -> the durable artifact-read-granted fact lands (instanceId inst-leader, source shell-foreground/bash — the executor spill -> observer -> authority -> durable fact chain)',
        csOk && grantShape,
        `createOk=${csOk} createErr=${csErr === null ? 'null' : String(csErr.code)} grants=${grantEntry === null ? 0 : 1} settleMs=${settleMs} shape=${grantShape} payloadHead=${JSON.stringify(grantEntry?.payload ?? null).slice(0, 300)}`)
      saveScenario('g6-spill-grant', {
        create: csErr === null ? 'ok' : { code: csErr.code, message: scrubTokens(String(csErr.message)).slice(0, 300) },
        settleMs,
        grant: grantEntry?.payload ?? null,
      })
    }

    // ── G8: browser tab / ledger / pending review (scenario 18) ────────────
    {
      // (d1) the pending-review lifecycle FIRST (it opens the worker
      //      session): the worker's bash ASK opens a durable control
      //      request -> v4 team.resolveControl allow -> bash executes -> DONE.
      const { tool: t8, decisions: dc8, pendingSeen: ps8 } = await leaderAttempt(B, 'g8', { recovery: 'abandon', approval: 'allow' })
      const g8Done = await waitForTurnDone(MOCK, MKW('g8'), DONE_W('g8'), 120_000)
      const after8 = await ledgerEntries(B, T)
      const askRequests = factEntries(after8, 'control-request-recorded').filter((e) => JSON.stringify(e?.payload ?? null).includes('bash'))
      const g8Decision = dc8.find((d) => d.class === 'ask' && d.decision === 'allow')
      const pendingBash = ps8.filter((p) => JSON.stringify(p).includes('bash'))
      // (a) the served UI page (the tab's entry) — AUTHENTICATED with the
      // boot's exchanged auth cookie (the bare GET / is the 401 launch-
      // token gate; the browser tab holds the cookie after the 303
      // exchange — the run-3 page=401 finding).
      const page = await fetchJson(`http://127.0.0.1:${HOST_PORT}/`, { headers: { cookie: B.cookie } }, 30_000)
      // (b) the member read state (v6 team.getReadState — the session-
      //     addressed durable affiliation + the live-token merge): walk the
      //     live sessions (other than ROOT / T) until the first whose read
      //     state is the team-member relation, then assert the CLOSED
      //     6-field shape on the team relation (relation in the closed set,
      //     durableGeneration a safe int >= 1, liveToken the opaque
      //     lt-v1-* token).
      const st = await p6t6State(HOST_PORT)
      const sessionKeys = Object.keys(st.body?.governance?.sessions ?? {})
      let readStateOk = false
      let readStateData = null
      for (const s of sessionKeys) {
        if (s === ROOT || s === T) continue
        const rs = await remoteCallReady(B, 'team.getReadState', { sessionId: s }, 'g8-readstate', 6)
        const e = resultError(rs.body)
        const v = resultData(rs.body)
        if (e === null && v?.relation === 'team-member'
          && (v.durableGeneration === null || (Number.isSafeInteger(v.durableGeneration) && v.durableGeneration >= 1))
          && typeof v.liveToken === 'string' && v.liveToken.startsWith('lt-v1-')) {
          WORKER_SESSION = s
          readStateOk = true
          readStateData = v
          break
        }
      }
      // (c) the live projection (v6 = the SAME base frame + durableGeneration
      //     (=== generation) + liveToken ON THE FRAME — withLiveProjection
      //     Freshness spreads the cells onto the projection frame; the
      //     response is {data: {projection: frame}, projectionGeneration};
      //     G7 re-checks the full matrix).
      const proj = await remoteCallReady(B, 'team.getProjection', { teamSessionId: T }, 'g8-projection', 6)
      const projFrame = resultData(proj.body)?.projection ?? null
      const projOk = resultError(proj.body) === null
        && typeof projFrame?.durableGeneration === 'number' && projFrame.durableGeneration === projFrame.generation
        && typeof projFrame?.liveToken === 'string' && projFrame.liveToken.startsWith('lt-v1-')
      check('G8', 'the tab data surface: GET / 200; v6 getReadState (worker session) = the member read state; v6 getProjection = durableGeneration+liveToken; the bash ASK opens a durable control request (the pending-review surface) -> v4 resolveControl allow -> DONE',
        page.status === 200 && readStateOk && projOk && t8.body?.ok === true && g8Done !== null
        && askRequests.length >= 1 && g8Decision !== undefined && pendingBash.length >= 1,
        `page=${page.status} readState=${readStateOk} projOk=${projOk} toolOk=${t8.body?.ok === true} askFacts=${askRequests.length} allowDecision=${g8Decision !== undefined} pendingBash=${pendingBash.length}`)
      saveScenario('g8-tab-surface', {
        page: { status: page.status },
        readState: readStateData === null ? null : { session: WORKER_SESSION, ...readStateData, liveToken: scrubTokens(String(readStateData.liveToken ?? '')) },
        projection: { generation: projFrame?.generation ?? null, durableGeneration: projFrame?.durableGeneration ?? null, liveToken: scrubTokens(String(projFrame?.liveToken ?? '')) },
        toolOutcome: t8.body?.value ?? t8.body?.error ?? null,
        askRequests: askRequests.map((e) => e.payload), decisions: dc8,
      })
    }

    // ── G7: Remote v1–v7 compatibility (scenario 17, the wire matrix) ──────
    {
      // Every version 1..7 on the STABLE read set (the de-versioned surface:
      // the same semantic methods over the v1–v7 wire — the plan's "v1–v6"
      // wording predates the w1a contract v7; the v1–v7 correction).
      const READ_SET = [
        ['catalog.list', {}],
        ['team.getProjection', { teamSessionId: T }],
        ['team.getLedgerPage', { teamSessionId: T, afterSequence: 0, limit: 10 }],
        ['override.get', { teamSessionId: T, capability: 'mcp', scope: 'team' }],
        ['policyState.get', { teamSessionId: T }],
      ]
      const matrixFailures = []
      for (let v = 1; v <= 7; v += 1) {
        for (const [method, params] of READ_SET) {
          const r = await remoteCallReady(B, method, params, `g7-v${v}-${method.replace(/\./g, '-')}`, v)
          const e = resultError(r.body)
          if (e !== null) matrixFailures.push(`v${v}:${method}=${e.code}`)
        }
      }
      // The version-sensitive PROJECTION shape: v<6 = the base frame;
      // v>=6 = the SAME base frame + durableGeneration (=== generation) +
      // liveToken ON THE FRAME — the response is
      // {data: {projection: frame}, projectionGeneration} (withLive
      // ProjectionFreshness spreads the cells onto the frame; they are NOT
      // top-level data fields).
      const p5 = resultData((await remoteCallReady(B, 'team.getProjection', { teamSessionId: T }, 'g7-proj-5', 5)).body)?.projection ?? null
      const p6 = resultData((await remoteCallReady(B, 'team.getProjection', { teamSessionId: T }, 'g7-proj-6', 6)).body)?.projection ?? null
      const shapeV5 = p5 !== null && p5.durableGeneration === undefined && p5.liveToken === undefined
      const shapeV6 = p6 !== null
        && typeof p6.durableGeneration === 'number' && p6.durableGeneration === p6.generation
        && typeof p6.liveToken === 'string' && p6.liveToken.startsWith('lt-v1-')
      // The version-gated methods are SERVED at their own version (the
      // method closed sets grow per contract version — a well-formed typed
      // response proves dispatch, a parse failure would not).
      const lr3 = resultError((await remoteCallReady(B, 'team.listRoots', {}, 'g7-listroots-3', 3)).body)
      const rs6 = resultError(WORKER_SESSION !== null
        ? (await remoteCallReady(B, 'team.getReadState', { sessionId: WORKER_SESSION }, 'g7-readstate-6', 6)).body
        : { body: { ok: false, error: { code: 'no-worker-session' } } })
      const rc4 = resultError((await remoteCallReady(B, 'team.resolveControl', { teamSessionId: T, requestId: 'rcr-g7-nonexistent', decision: 'allow', note: 'g7 gating probe' }, 'g7-resolve-4', 4)).body)
      // The v7-only field is REJECTED on the v1–v6 wire (byte-exact legacy
      // behavior — the closed field set has no expectedGeneration).
      const v6Guard = await remoteCallReady(B, 'override.set', { teamSessionId: T, capability: 'mcp', scope: 'team', value: { kind: 'allow', items: [S_REPO] }, actor: { kind: 'human' }, expectedGeneration: 0 }, 'g7-v6-guard', 6)
      const eV6Guard = resultError(v6Guard.body)
      check('G7', 'v1..v7 x stable read set all accepted; projection v<6 base vs v>=6 durableGeneration+liveToken; gated methods served at their own version (listRoots v3, getReadState v6, resolveControl v4); the v7-only expectedGeneration is REJECTED on the v6 wire (typed)',
        matrixFailures.length === 0 && shapeV5 && shapeV6 && lr3 === null && rs6 === null && rc4 !== null
        && eV6Guard !== null,
        `matrix=${JSON.stringify(matrixFailures)} shapeV5=${shapeV5} shapeV6=${shapeV6} lr3=${lr3 === null ? 'ok' : String(lr3.code)} rs6=${rs6 === null ? 'ok' : String(rs6.code)} rc4=${rc4 === null ? 'null' : String(rc4.code)} v6GuardErr=${eV6Guard === null ? 'null' : String(eV6Guard.code)}`)
      saveScenario('g7-version-matrix', {
        matrixFailures,
        shapes: {
          v5: { durableGenerationPresent: p5?.durableGeneration !== undefined, liveTokenPresent: p5?.liveToken !== undefined },
          v6: { generation: p6?.generation ?? null, durableGeneration: p6?.durableGeneration ?? null, liveTokenPrefixLtv1: p6?.liveToken?.startsWith('lt-v1-') === true },
        },
        gated: { listRootsV3: lr3, getReadStateV6: rs6, resolveControlV4: rc4 },
        v6ExpectedGenerationRejected: eV6Guard,
      })
    }

    await stopHost(B)

    // ══ B5 (resume): the registry `ptc` preset mounted — G5 (scenario 14)
    //     ═════════════════════════════════════════════════════════════════
    // The registry-provided `ptc` preset (a shipped DSH 0.1.7-rc.1 preset,
    // ACTUALLY MOUNTED through the public row config — NO scripted seam;
    // the C.8 actual-mount donor: actual mount preset == observed substrate
    // source). G5 cells: (a) probe lane (the U5 caller-only wire fact)
    // PASSes; (b) GATE lane under the mounted ptc — POST-RESOLUTION (2026-10-01
    // test-infra): the ORIGINAL finding PR-F-G5 was recorded at PR-F time as
    // current-branch behavior (the v2 persona subject — required KIND
    // `standard`, the domain schema closed set — vs the requirement-facts
    // provider's preset-id lookup -> under ptc the kind subject found no
    // root/member entry -> typed unknown -> required Team-level requirement
    // down -> the create REFUSED typed, FATAL, zero durable effect; target
    // design §16.1 / ADR-24 not satisfied on that branch — PR-E lineage,
    // out of PR-F scope, escalated). It is since RESOLVED on master by the
    // persona-kind work (A-contract, PR #46: the kind subject resolves
    // through the KIND path, no legacy preset-id shadowing). The cell now
    // asserts the post-resolution contract: the create is ACCEPTED under
    // the mounted ptc with the persona genuinely satisfied — TRUE OPEN, T9
    // minted durable as team-root with a POSITIVE durableGeneration (v6
    // team-root contract — null only on the `none` relation; the remote
    // handler rejects a null team-root answer,
    // packages/remote/src/handlers/team.ts L563-566). The fail-closed
    // direction (never a false OPEN) is asserted CROSS-KIT: the E.12 S12b
    // leg (bare/absent preset -> FATAL PERSONA_INCOMPATIBLE,
    // admitInitialWork blocked) + the merged suite persona-kind tests
    // (complete-mounted-preset chain FATALs end-to-end); this kit carries
    // no bare-preset boot cell of its own. No seeded persona fact (U5: the
    // persona domain is caller-only in the probe; the live observer is the
    // only GATE input).
    B = await bootHost({
      label: 'B5-PTC', port: HOST_PORT, boot: 5, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      rootPresetId: 'ptc', memberPresetId: 'ptc',
      comment: 'B5 resume: the registry ptc preset mounted (rootPresetId/memberPresetId) — the persona ptc regression subject',
    })
    EVID.hostLogs.push({ bootNum: 5, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })

    // ── G5: persona ptc regression (scenario 14) ───────────────────────────
    {
      // U5 (FROZEN, the E.12 S12a K7 contract): the PERSONA domain is
      // CALLER-ONLY in the PROBE — the host's persona facts (including the
      // live observer's) are always discarded from the probe; the caller's
      // wire persona facts are the only probe persona input (the selected
      // preset is the explicit user intent). The GATE path (the create
      // below) is where the host's LIVE persona observation over the
      // actually-mounted ptc preset is the only persona input — the honest
      // regression subject of this leg.
      const probe = await remoteCallReady(B, 'intent.probe', {
        blueprintId: BP_PERSONA_ID,
        environmentFacts: [{ domain: 'persona', subject: 'standard', available: true, generation: 1 }],
      }, 'g5-probe', 1)
      const pErr = resultError(probe.body)
      const compat = resultData(probe.body)?.compatibility ?? null
      const personaReq = compat?.requirements?.find((rq) => rq.requirementId === 'team.persona.standard')
      check('G5', 'ptc mounted: the persona probe (wire intent fact) PASSES — team.persona.standard PASS, status OPEN (the U5 caller-only probe lane)',
        pErr === null && compat?.status === 'OPEN' && personaReq?.outcome === 'PASS',
        `status=${compat?.status} persona=${JSON.stringify(personaReq ?? null).slice(0, 250)}`)
      saveScenario('g5-probe', { compatibility: compat })

      // The GATE lane under the mounted ptc preset (the live production
      // observer over the agentPresets seam is the only persona input — no
      // seeded persona fact). HISTORY: finding PR-F-G5 was RECORDED at
      // PR-F time as current-branch behavior (the v2 persona kind subject
      // vs the provider's preset-id lookup -> typed FATAL at create) and
      // escalated. It has since been RESOLVED on master by the persona-kind
      // work (A-contract, PR #46 — persona-kind-provider-preflight: the
      // kind subject resolves through the KIND path with no legacy
      // shadowing; a v2 blueprint with the persona teamRequirement
      // `standard` + a mounted composable preset PASSES with no seed; the
      // complete-mounted-preset chain still FATALs end-to-end — no false
      // OPEN). Target design §16.1 / ADR-24 is now satisfied on this path.
      // This cell asserts the POST-RESOLUTION contract: the create is
      // ACCEPTED with the persona requirement GENUINELY satisfied under the
      // mounted ptc — a TRUE OPEN, proven durable (T9 minted as team-root;
      // the probe lane above already pins the persona PASS). The
      // fail-closed direction (an unresolvable persona must NEVER open) is
      // asserted CROSS-KIT: the E.12 S12b leg (bare preset, no persona row
      // -> FATAL PERSONA_INCOMPATIBLE, admitInitialWork blocked — no false
      // OPEN) + the merged suite (persona-kind-provider-preflight: the
      // complete-mounted-preset chain FATALs end-to-end). This kit
      // (prf) carries no bare-preset boot cell of its own.
      const cr = await remoteCallReady(B, 'team.create', { rootSessionId: T9, blueprintId: BP_PERSONA_ID }, 'g5-create', 1)
      const cErr = resultError(cr.body)
      const cData = resultData(cr.body)
      // True OPEN, never a false OPEN: the accepted create mints T9
      // DURABLY as a team root — the v6 read state is the closed
      // 'team-root' relation for T9 (the inverse of the pre-fix
      // zero-effect 'none' assertion). Contract precision (review,
      // 2026-10-01): `durableGeneration` is null ONLY on the `none`
      // relation; the team-root answer MUST carry it — the remote
      // handler REJECTS a team-root answer with null durableGeneration
      // (packages/remote/src/handlers/team.ts L563-566; the wire
      // validation accepts safe-integer >= 1 or null, L504-511) — so a
      // genuinely persisted T9 asserts a POSITIVE safe integer, no
      // null tolerance (T9 persistence is guaranteed by the accepted
      // create: the team-root row is the durable mint).
      const zrs = await remoteCallReady(B, 'team.getReadState', { sessionId: T9 }, 'g5-created-state', 6)
      const zrsErr = resultError(zrs.body)
      const zrsData = resultData(zrs.body)
      const createdDurable = zrsErr === null
        && zrsData?.relation === 'team-root'
        && zrsData?.teamSessionId === T9
        && Number.isSafeInteger(zrsData.durableGeneration) && zrsData.durableGeneration >= 1
      check('G5', 'ptc mounted GATE lane (PR-F-G5 RESOLVED by the persona-kind work — the v2 kind subject resolves through the KIND path): team.create ACCEPTED — the persona requirement is genuinely satisfied under the mounted ptc (true OPEN — T9 minted durable as team-root; the probe lane above pins the persona PASS; the fail-closed direction is asserted cross-kit by the E.12 S12b leg + the merged suite persona-kind tests: bare preset -> FATAL PERSONA_INCOMPATIBLE, no false OPEN)',
        cErr === null && createdDurable,
        `createErr=${cErr === null ? 'null' : String(cErr.code)} createData=${scrubTokens(JSON.stringify(cData)).slice(0, 200)} readState=${scrubTokens(JSON.stringify(zrsErr !== null ? { error: zrsErr.code } : zrsData))}`)
      saveScenario('g5-gate-creating', {
        finding: 'PR-F-G5',
        expectation: 'RESOLVED on master (persona-kind work, A-contract PR #46; encoded by persona-kind-provider-preflight + the shipped-dist smoke, both green in the merged full suite): the create under the mounted ptc with the v2 persona kind subject is ACCEPTED — true OPEN (durable team-root T9 with POSITIVE durableGeneration per the v6 team-root contract), never a false OPEN (fail-closed direction asserted CROSS-KIT: E.12 S12b leg + suite persona-kind complete-mounted-preset FATAL — this kit carries no bare-preset cell of its own). Pre-#46 behavior (typed FATAL, zero durable effect) is historical — see the closure battery record realhost-battery-post-merge (prf gate-lane stale-expectation diagnosis).',
        createError: cErr === null ? null : { code: cErr.code, message: scrubTokens(String(cErr.message)), details: scrubTokens(JSON.stringify(cErr.details ?? null)) },
        createData: cData === null ? null : scrubTokens(JSON.stringify(cData)),
        readStateT9: zrsErr !== null ? { error: zrsErr.code } : zrsData,
      })
    }

    await stopHost(B)
    // ── teardown + hygiene ─────────────────────────────────────────────────
    for (const m of Object.values(MINI)) {
      if (m !== null) await new Promise((r) => m.server.close(r))
    }
    try { await MOCK.close?.() } catch { /* mock close best effort */ }

    // H1 post — test-use pristine + stable zero-touch.
    const gitPostDir = join(RUN_DIR, 'git-post')
    mkdirSync(gitPostDir, { recursive: true })
    const gitPost = await captureGitState(HOST_TREE, gitPostDir)
    EVID.testUse.post = gitPost
    writeFileSync(join(RUN_DIR, 'testuse-post.json'), JSON.stringify({ ...gitPost, baselineSha: HOST_BASELINE_SHA, at: new Date().toISOString() }, null, 2))
    const h1Testuse = gitPost.statusEmpty === true && gitPost.diffEmpty === true && gitPost.head === HOST_BASELINE_SHA
      && EVID.testUse.pre.statusEmpty === true && EVID.testUse.pre.diffEmpty === true && EVID.testUse.pre.head === HOST_BASELINE_SHA
    check('H1', 'test-use pristine AFTER (porcelain empty + HEAD baseline; the worker bash was a no-op echo)',
      h1Testuse, `post statusEmpty=${gitPost.statusEmpty} diffEmpty=${gitPost.diffEmpty} head=${gitPost.head.slice(0, 12)}`)

    EVID.stableAfter = {}
    for (const u of STABLE_URLS) EVID.stableAfter[u] = await probeStableInstance(u)
    const h1Stable = STABLE_URLS.every((u) => EVID.stableAfter[u].status === EVID.stableBefore[u].status
      && EVID.stableAfter[u].length === EVID.stableBefore[u].length)
    check('H1', ':3080/:3180 ZERO-TOUCH (read-only probes pre == post)',
      h1Stable, `before=${STABLE_URLS.map((u) => EVID.stableBefore[u].status).join(',')} after=${STABLE_URLS.map((u) => EVID.stableAfter[u].status).join(',')}`)
    writeFileSync(join(RUN_DIR, 'stable-pre.json'), JSON.stringify(EVID.stableBefore, null, 2))
    writeFileSync(join(RUN_DIR, 'stable-post.json'), JSON.stringify(EVID.stableAfter, null, 2))

    // H2 — run ports released (host + mock + ALL THREE mini-MCP ports,
    // including the new repo port 3492 — the W2-A rework adds a server).
    const portsHeld = []
    for (const p of [HOST_PORT, MOCK_PORT, PORT_REPO, PORT_LEADERREQ, PORT_WEB]) {
      if (await portInUse(p)) portsHeld.push(p)
    }
    let worldCleaned = false
    const allScenariosPass = CRITERIA.every((c) => (VERDICT.get(c.id)?.pass ?? true) === true)
    if (allScenariosPass && portsHeld.length === 0) {
      rmSync(HOME, { recursive: true, force: true })
      rmSync(LOCK_FILE, { force: true })
      worldCleaned = true
    }
    check('H2', 'run ports released after teardown (worldCleaned=true on PASS only)',
      portsHeld.length === 0 && (worldCleaned || !allScenariosPass),
      `portsHeld=${JSON.stringify(portsHeld)} worldCleaned=${worldCleaned}`)

    const passCount = CRITERIA.filter((c) => (VERDICT.get(c.id)?.pass ?? true) === true).length
    finalizeEvidence(allScenariosPass && passCount === CRITERIA.length ? 'PASS' : 'FAIL',
      `${passCount}/${CRITERIA.length} criteria pass; worldCleaned=${worldCleaned}`)

    // api-transcript + mock log are already on disk; write the transcript.
    writeFileSync(join(RUN_DIR, 'api-transcript.json'), JSON.stringify(EVID.transcript, null, 2))

    // token-scrub the ENTIRE evidence dir (sk- tokens from instance logs /
    // dump configs / transcripts). `mock-requests.json` is intentionally
    // NOT part of the evidence.
    const scrubbed = scrubDir(RUN_DIR)
    log(`evidence scrubbed: ${scrubbed} file(s) rewritten (sk- token redactions)`)
    const leak = []
    const walkForLeak = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name)
        if (entry.isDirectory()) walkForLeak(p)
        else {
          try {
            if (/\bsk-[A-Za-z0-9]{24,}/.test(readFileSync(p, 'utf8'))) leak.push(p)
          } catch { /* binary — skip */ }
        }
      }
    }
    walkForLeak(RUN_DIR)
    if (leak.length > 0) log(`WARNING: token leak remains in: ${leak.join(', ')}`)

    const failed = CRITERIA.filter((c) => (VERDICT.get(c.id)?.pass ?? true) !== true)
    if (failed.length === 0) {
      log(`VERDICT: PASS — all ${CRITERIA.length} criteria green (G1-G9 + H1/H2); world ${worldCleaned ? 'cleaned' : 'RETAINED'}`)
      process.exit(worldCleaned ? 0 : 2)
    }
    log(`VERDICT: FAIL — ${failed.length} criterion(ia) failed: ${failed.map((f) => f.id).join(', ')}`)
    log(`world RETAINED at ${HOME} (non-zero exit protocol)`)
    process.exit(2)
  } catch (error) {
    log(`UNCAUGHT: ${error?.stack ?? error}`)
    try { await sweepLiveHosts() } catch { /* best effort */ }
    try { finalizeEvidence('ERROR', String(error?.message ?? error).slice(0, 500)) } catch { /* best effort */ }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
