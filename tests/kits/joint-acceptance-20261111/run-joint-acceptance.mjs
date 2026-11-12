#!/usr/bin/env node
/**
 * run-joint-acceptance.mjs — the SINGLE JOINT DRIVER the closeout was missing.
 *
 * DERIVATION (no re-implementation): this file is the C1 Alpha.6/PD-42
 * instrument (`tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs`,
 * merged and proven) with the joint composition forced on
 * (`PD42_CELLINGS`, `ALPHA6_OFFICER`, `PLANE_TAKEOVER`) and the eleven arms of
 * the 2026-11-11 joint-acceptance brief evaluated over the SAME real Host. The
 * merge instrument half (`dev/agent-workflow/evidence/a5sf-pty-devlive/`) is
 * represented by the native-bash governed composition: the preset row keeps
 * `tool-bash`, the realm selects `native-bash-tool.mjs`, and the plane
 * publishes the native admission edge — exactly the pair the brief asks to
 * join. The two pointer arms (`team-tool-plane.mjs`, `native-bash-tool.mjs`)
 * are consumed AS BRANCHES; no product file is edited here.
 *
 * COMPOSITION (one Team, one blueprint):
 *   - `schemaVersion: 5` YAML carrying BOTH `memberIoCeilings` (worker +
 *     officer templates) and `reviewRouting` (`officerTemplateId: officer`,
 *     `ordinaryToolApprovals.default: officer`, `whenOfficerUnavailable: hold`);
 *   - the shipped `a5sf-governed-member` preset (governed realm) mounted as a
 *     declaration row through the public profile-patch seam;
 *   - plane takeover ON: the plane owns the execute lane and publishes the
 *     native-bash admission edge to the runtime Agent;
 *   - `JOINT_PRESET=native` (default) keeps `tool-bash` in the member copy so
 *     the realm can shadow it with the pinned persistent definition.
 *     `JOINT_PRESET=fs-only` drops `tool-bash` (the plane-owned spelling) and
 *     is the DIAGNOSTIC control that isolates the fs/goal arcs from the
 *     native-bash mount. The two acceptance runs are BOTH `native`.
 *
 * TWO-RUN AGREEMENT: run the same kit twice on two fresh `DSH_HOME` worlds and
 * diff the results with `compare-two-runs.mjs <run1> <run2> [<out.json>]` — it
 * requires an exact verdict match for every arm and compares the measured
 * detail after normalizing only per-world identifiers (documented there).
 *
 * DIAGNOSTIC CONTROL: `JOINT_NO_GOAL_TEMPLATE=1` compiles the J07/J08 goal
 * worker template out of the blueprint (J07/J08/J10 then read NOT_REACHED with
 * that reason). It exists to prove an unrelated arm's state is not caused by
 * the goal template; it is never used for an acceptance record.
 *
 * THE ELEVEN ARMS (verdict vocabulary is the owner's closed set from
 * `tests/kits/_shared/boot-preflight.mjs`: PASS / FAIL / NOT_REACHED /
 * NOT_SELECTED / UNSUPPORTED / ENV_BLOCK):
 *   J01 Team + routing — v5 both families admitted; Officer routed; one
 *       team_resolve_control.
 *   J02 Governed I/O inside the ceiling — write succeeds + one
 *       `a5sf-guard-consult/1` ALLOW fact on the realm sink.
 *   J03 Governed I/O outside the ceiling — typed deny, ZERO bytes on disk,
 *       deny fact attributable to the Member/call.
 *   J04 Native bash governed — pinned definition identity, realm PTY with
 *       guard/spawn facts, two calls on one PTY (cd/export persist), a second
 *       Member on a different PTY.
 *   J05 Approval lifecycle — durable request → human allow → exactly one
 *       consumption → one execution → one `control-execution-result`; second
 *       ask denied → zero consumption/execution/side effect.
 *   J06 Officer identity (F-3) — which decider receives the
 *       `parameter-permission` leg vs the `team-tool-execute` leg, and whether
 *       `whenOfficerUnavailable` (hold/leader) is honoured. RECORDED, never
 *       fixed here.
 *   J07 Goal from direct human input — create_goal rev1 → get_goal agrees →
 *       update_goal → >=2 automatic rounds → human Stop → durable paused, no
 *       continuation.
 *   J08 Relay refusal — a machine `team_send_message`-started turn cannot
 *       create_goal (`GOAL_TOOL_AUTHORITY_REQUIRED`) while its governed tool
 *       call still runs.
 *   J09 Sticky Stop on the review-wake path — a live review latch (a real wake)
 *       + the human Stop writes `stopped-<hash>.json`; a SUBSEQUENT review ask
 *       from a different Member wakes nobody and leaves the marker
 *       byte-identical (the latch-scoped Stop is still in force).
 *   J10 Cold recovery — SIGKILL mid-body (the body provably started), cold boot
 *       on the SAME DSH_HOME: no duplicate execution, no replayed consumed
 *       allow, and the crash-window settlement is `unknown` — never
 *       `succeeded`, never silently absent.
 *   J11 No replay — a consumed allow cannot be re-dispatched; a late allow is
 *       refused (`CONTROL_REQUEST_DECIDED`).
 *
 * WHY ARMS CAN BE NOT_REACHED: the closed set forbids inventing a verdict.
 * If the governed Member never produces a model turn, a Goal/Stop/recovery arm
 * has no observable; it is NOT_REACHED and the driver names the prerequisite,
 * never PASS and never a fabricated FAIL.
 *
 * PREFLIGHT GATE: `tests/kits/_shared/boot-preflight.mjs` is run over THIS
 * run's measured facts (host pin, ports, selected arms, world containment)
 * and the Host is not spawned unless it grades PASS. The JSON is written as
 * `<evidence-dir>/boot-preflight.json` BEFORE the start.
 *
 * WORLD: pristine `tests/deepseek-harness-test-use` @ the pin in
 * `tests/paths.mjs` (`639ed01539`), `dsh web` on a sanctioned port
 * (`TEST_PORT_RANGES`, never :3080), fresh `DSH_HOME` under `tests/homes/`,
 * in-process mock model, loopback only, torn down after the run.
 *
 * EVIDENCE CLASS: **DEV-LIVE**. This record can never produce a V@B=yes or any
 * frozen-candidate claim (`osLevelNetworkIsolationClaimed: false`); it is not
 * CANDIDATE-C2 and must never be cited as one.
 *
 * USAGE:
 *   node tests/kits/joint-acceptance-20261111/run-joint-acceptance.mjs \
 *     --worktree <path> --testuse <path> --host-port N --mock-port N \
 *     --evidence-dir <path> [--keep]
 *   `JOINT_PRESET=fs-only` selects the diagnostic composition (no tool-bash).
 *
 * EXIT: 0 = J01 PASS and no arm FAIL; 2 = an arm FAILed; 1 = fatal
 * (preflight refusal / boot / row).
 */

import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, statSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { DSH_BASELINE_VERSION, isSanctionedTestPort } from '../../../tests/paths.mjs'
import { runBootPreflight, assertBootPreflight } from '../_shared/boot-preflight.mjs'

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
const FLAG_KEEP = args.includes('--keep')
// Boot-only Alpha.6 check: mount the SAME production row with a v5 routing
// source + the opt-in config, prove the Host boots it (durable wake-intent
// path present, live wake seam present), then stop after L0. The model
// scenario below is the legacy Leader-approval arc, not the Officer arc.
const ALPHA6_BOOT_ONLY = process.env['C1_ALPHA6_BOOT_ONLY'] === '1'
// Real-Host ARC-A probe: mount the governed tool plane with the bash TAKEOVER
// spelling (`bash@bash`). The legacy C1 blueprint asks `bash`, and the
// non-takeover native name is refused at the binding gate by design; the same
// blueprint is plane-shaped once the row mounts the shell takeover.
const JOINT = true
// JOINT drives the product-intended composition: governed realm + v5 both
// families + Alpha.6 review routing + the plane takeover that publishes the
// native-bash admission edge.
const JOINT_PRESET = process.env['JOINT_PRESET'] === 'fs-only' ? 'fs-only' : 'native'
const PLANE_TAKEOVER = true
// A6-OFFICER: the same real Host, but the ask is routed to a live Officer
// through the opt-in review-routing plane. Requires the plane takeover so an
// approved bash can actually execute.
const ALPHA6_OFFICER = true
// PD42 (owner ruling 2026-11-11): run the SAME A6 Officer world with the
// Alpha.5 governed Member realm ENABLED. The created Team's v5 blueprint then
// carries BOTH `memberIoCeilings` and `reviewRouting`, the row opts into the
// shipped governed preset, and the Member's tool calls are served by the
// compiled realm (guard facts + typed denies). Off by default: the pre-PD42
// arms stay byte-identical.
const PD42_CELLINGS = true
const GOVERNED_PRESET_ID = 'a5sf-governed-member'
/** The governed preset's faces the smoke discovery surface never shows. */
const PD42_GOVERNED_EXTRA_TOOLS = Object.freeze([
  'create_goal', 'exit_plan_mode', 'get_goal', 'glob', 'grep',
  'job_kill', 'job_list', 'job_output', 'present', 'skill', 'update_goal',
])

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
let TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
// The gitignored test-use checkout exists only in the MAIN checkout, not
// in task worktrees (<main>/.worktrees/<task>). Fallback: parent repo.
if (!existsSync(TESTUSE) && existsSync(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))) {
  TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
}
const MOCK_PORT = Number(argValue('mock-port', 3506))
const EVIDENCE_DIR_ARG = argValue('evidence-dir', null)

// ── frozen facts ────────────────────────────────────────────────────────────

import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH } from '../../../tests/paths.mjs'  // canonical test-infrastructure pin (docs/TEST_METHODS.md §1)
const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA // canonical pin = tests/paths.mjs (moves with the pinned host generation)
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'host.js')
const GLUE_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_PLUGIN_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_URL = pathToFileURL(GLUE_PATH).href
const SEAM_URL = pathToFileURL(SEAM_PATH).href
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href

import { presetDeclarationRow, smokePresetPlugins } from '../_shared/preset-seam.mjs'

const SMOKE_PRESET_ID = 'rc2-smoke' // the rc2 kit's preset id (reused shape)
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
// The C1 tool catalog: the eleven + team_list_pending_control.
const TEAM_TOOL_CATALOG = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_collect',
  'team_send_message',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
  'team_list_pending_control',
  // 0.2.0-rc.2 added these to the boot Leader's global surface; listing them
  // keeps them OUT of the discovery-computed builtinToolDeny (denying an
  // unknown name makes tools.restrict() fail the root start).
  'team_archive_member',
  'team_grant_permission',
  'team_revoke_permission',
]
// The Leader teamTools allow list (the closed subset this smoke drives):
// create + delegate + collect + list members/templates/config for
// addressing, and the C1 approval-loop pair.
const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_collect',
  'team_list_pending_control',
  'team_resolve_control',
  // LIVE-FOUND run 5: the created team's LEADER surface is the blueprint's
  // teamTools allow (the boot root's 17-tool surface does NOT carry over).
  // The S5 idempotency probe runs through the production
  // team_request_control tool ON THE CREATED LEADER (plan §S5) — without
  // this grant the probe tool-call fails 'unknown tool' (the service
  // never sees it, no row, no notification).
  'team_request_control',
]

// A stamp unique per PROCESS: two runs started in the same second would mint the
// same root session id and the second Host would refuse the write lease
// (SessionAlreadyOwnedError). Suffix = pid, which is unique per driver process.
const RUN_STAMP = `${new Date().toISOString().replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19)}-h${Number(process.env['JOINT_PORT'] ?? 0)}-r${createHash('sha256').update(String(Math.random()) + String(Date.now())).digest('hex').slice(0, 6)}`
const RUN_DIR = EVIDENCE_DIR_ARG
  ? resolve(EVIDENCE_DIR_ARG)
  : join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'c1-leader-approval', 'smoke', `c1-smoke-${RUN_STAMP}`)
const HOME = join(WORKTREE, 'tests', 'homes', `c1-smoke-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const BLUEPRINT_DIR = join(WORKTREE, `.c1-smoke-blueprints-${RUN_STAMP}`)
const A5SF_CONSULT_SINK = join(HOME, 'a5sf-consult.jsonl')

const ROOT = `session-c1-smoke-root-${RUN_STAMP}`
const CREATE_ROOT_X = `session-c1-smoke-x-${RUN_STAMP}`
const CREATE_ROOT_Y = `session-c1-smoke-y-${RUN_STAMP}`
const CREATE_ROOT_Z = `session-c1-smoke-z-${RUN_STAMP}`
const BP_ANCHOR_ID = 'team.c1-anchor'
const BP_X_ID = 'team.c1-x'
const BP_Y_ID = 'team.c1-y'
const BP_Z_ID = 'team.c1-z'
const BP_A6_ID = 'team.c1-a6-officer'
const CREATE_ROOT_A6 = `session-c1-smoke-a6-${RUN_STAMP}`

// Distinct markers (no substring collisions).
const MK_DISC = `C1MK_DISC_${RUN_STAMP}`
const MK_X = `C1MK_X_${RUN_STAMP}`
const MK_XMEM = `C1MK_XMEM_${RUN_STAMP}`
const MK_Y = `C1MK_Y_${RUN_STAMP}`
const MK_YMEM = `C1MK_YMEM_${RUN_STAMP}`
const MK_Z = `C1MK_Z_${RUN_STAMP}`
const MK_ZMEM = `C1MK_ZMEM_${RUN_STAMP}`
const MK_ZCHECK = `C1MK_ZCHECK_${RUN_STAMP}`
const MK_XCROSS = `C1MK_XCROSS_${RUN_STAMP}`
const MK_A6 = `C1MK_A6LEAD_${RUN_STAMP}`
const MK_A6MEM = `C1MK_A6MEM_${RUN_STAMP}`
const MK_A6SELF = `C1MK_A6SELF_${RUN_STAMP}`
const MK_A6_HANDOFF = `C1MK_A6HANDOFF_${RUN_STAMP}`
const MK_A6_NEWWORKER = `C1MK_A6NEWW_${RUN_STAMP}`
const MK_A6_OFFICER_READY = `C1MK_A6OFFREADY_${RUN_STAMP}`

// The C1 notification prefix token (the renderer's first line).
const NOTIF_PREFIX = '[team-control requestId='
// Summary markers carried into the C1 notification text (routing +
// verdict selection in the mock oracle):
//   c1-x-allow / c1-x-deny / c1-z-<stamp>.txt (refused, S4) / c1-z-s5
//   (the S5 idempotency probe, normal chain) / c1-y- (queued, S6).
const SUM_X_ALLOW = `c1-x-allow-${RUN_STAMP}`
const SUM_X_DENY = `c1-x-deny-${RUN_STAMP}`
const SUM_Z_FILE = `c1-z-${RUN_STAMP}.txt`
const SUM_Z_S5 = `c1-z-s5-${RUN_STAMP}`
const SUM_Y = `c1-y-${RUN_STAMP}`
const S5_TOKEN = `c1-z-s5tok-${RUN_STAMP}`

// Member side-effect files (ABSOLUTE paths — cwd-robust) + commands that
// both WRITE the marker file and PRINT a -executed marker (so the
// executed branch is distinguishable in the tool result).
const FILE_X_ALLOW = join(WORKSPACE, `c1-x-allow-${RUN_STAMP}.txt`)
const FILE_X_DENY = join(WORKSPACE, `c1-x-deny-${RUN_STAMP}.txt`)
const SUM_A6_ALLOW = `c1-a6-allow-${RUN_STAMP}`
const FILE_A6_ALLOW = join(WORKSPACE, `c1-a6-allow-${RUN_STAMP}.txt`)
const FILE_A6_BODY_START = join(WORKSPACE, `c1-a6-body-start-${RUN_STAMP}.txt`)

// ── J07–J10 (2026-11-12, this lane): the four arms the v1 driver declared but
// never drove. Every marker is unique so no branch can bleed into another arm.
//   J07  human member.send → goal worker → create/get/edit → >=2 rounds → Stop
//   J08  machine member.send → goal worker → create_goal REFUSED, bash runs
//   J09  Sticky Stop: a held review wake, the human Stop, then a second ask
//   J10  SIGKILL mid-body → cold boot on the same DSH_HOME → settlement facts
const MK_J07 = `C1MK_J07_${RUN_STAMP}`
const MK_J08 = `C1MK_J08_${RUN_STAMP}`
const MK_J09 = `C1MK_J09_${RUN_STAMP}`
const MK_J09B = `C1MK_J09B_${RUN_STAMP}`
const MK_J10 = `C1MK_J10_${RUN_STAMP}`
const SUM_J08 = `c1-j08-bash-${RUN_STAMP}`
const FILE_J08 = join(WORKSPACE, `c1-j08-${RUN_STAMP}.txt`)
const FILE_J10_START = join(WORKSPACE, `c1-j10-body-start-${RUN_STAMP}.txt`)
const FILE_J10_DONE = join(WORKSPACE, `c1-j10-body-done-${RUN_STAMP}.txt`)
// The J09 wake hold: the driver ARMS this immediately before the first J09 ask,
// so the very next review wake is held open while the human Stop lands (the
// latch a Sticky Stop is scoped to must still be LIVE). A text-marker match
// would depend on the renderer keeping the command in the wake summary; the
// arm flag is the driver's own event. `releasedBy` records why the hold ended,
// so a timeout is visible in the evidence instead of silent.
const J09_GATE = { armed: false, holding: false, release: null, releasedBy: null }
// J07: the goal-round loop is FAST under an instant mock model (a 2026-11-12
// run burned all six rounds in the few hundred ms between the second round
// request and the Stop landing, so the goal settled `blocked` and the Stop had
// nothing to pause). The second round's reply is therefore HELD until the
// driver has issued the human Stop: the Stop must land while a round is in
// flight — the realistic shape — and the round count at the Stop is then
// exactly the durable `roundsStarted` the arm claims.
const J07_GATE = { armed: false, holding: false, release: null, releasedBy: null }
/** Every round turn the mock model actually answered, in arrival order. */
const J07_ROUND_TRACE = []
// Optional recipient probe: the OFFICER itself asks for a governed bash tool.
// The current-leg OperationOwner is then the Officer template, so the router
// must route the self-ask to the Leader (never back to the Officer).
const A6_RECIPIENTS = process.env['C1_A6_RECIPIENTS'] === '1'
const A6_HANDOFF = process.env['C1_A6_HANDOFF'] === '1'
const A6_HUMAN = process.env['C1_A6_HUMAN'] === '1'
const A6_EXCEPTION = process.env['C1_A6_EXCEPTION'] === '1'
const A6_STOP = process.env['C1_A6_STOP'] === '1'
// ── WP3-FENCE-TIMING (2026-11-11; tracked test infrastructure) ──────────────
// TIMING CONTROL FOR THE A6-12 STOP ARM (instrument, not product).
//
// Historically the A6-12 arm resolved the human `allow` and then sent
// `session/cancel` as fast as it could: whether the Stop landed before the
// guard's consumption boundary (pre-fence arm), inside the new fence, or
// after the final consumption probe (the disclosed residual window) was pure
// luck — 1 fence trip in 11 boots on cand-v0.1.6-2 (`c2-adjudication-2` §4).
//
// `C1_A6_STOP_TIMING_MS='{"resolve":R,"stop":S}'` places both events at a
// chosen point measured from a DURABLE FACT THE SERVICE WROTE: the human
// leg's `control-request-recorded` row `createdAt`, read back from
// `<DSH_HOME>/storages/team_domain.json`. The allow is issued at
// `createdAt + R` ms, the Stop at `createdAt + S` ms — same machine, same
// `Date.now()` the service's `now()` uses.
//
// WHY THAT ROW IS THE PRODUCTION-EQUIVALENT SEAM (no product change): the
// guarded invocation parks in `ControlService.awaitControlDecision`, which
// polls the durable control state at `DEFAULT_WAIT_POLL_INTERVAL_MS = 250`
// ms (first poll synchronous at wait start, `control/service.ts`), and the
// wait starts immediately after the request row is durably written by the
// same code path. So the guard's post-decision run begins on the 250 ms grid
// anchored at that row. An external instrument can therefore put the Stop at
// a chosen point on that grid using a DOCUMENTED product constant, without a
// test hook, a sleep in product code, or any upstream patch.
//
// Unset or empty ⇒ the historical arm (250 ms discovery poll, resolve
// immediately, cancel immediately); behaviour is byte-identical.
const A6_STOP_TIMING = (() => {
  const raw = process.env['C1_A6_STOP_TIMING_MS']
  if (raw === undefined || raw === '') return null
  let parsed
  try { parsed = JSON.parse(raw) } catch { throw new Error(`C1_A6_STOP_TIMING_MS must be JSON, got ${raw}`) }
  const resolveAt = Number(parsed?.resolve)
  const stopAt = Number(parsed?.stop)
  if (!Number.isFinite(resolveAt) || !Number.isFinite(stopAt)) {
    throw new Error(`C1_A6_STOP_TIMING_MS needs numeric {"resolve","stop"}, got ${raw}`)
  }
  if (stopAt < resolveAt) throw new Error(`C1_A6_STOP_TIMING_MS stop (${stopAt}) must be >= resolve (${resolveAt})`)
  return { resolveAt, stopAt }
})()
const A6_CRASH = ['1', 'allow', 'consume', 'body', 'before'].includes(String(process.env['C1_A6_CRASH']))
const A6_TIMEOUT_MS = Number(process.env['C1_A6_TIMEOUT_MS'] ?? '0')
const A6_STICKY_STOP = process.env['C1_A6_STICKY_STOP'] === '1'
const A6_INBOX = process.env['C1_A6_INBOX'] === '1'
// A6-INBOX-UNCLAIMED: the window the audit never injected — the native Inbox
// ACCEPTED the review wake into the recipient's next-step list but the turn
// never claimed it (the Officer is kept busy on a long tool call). Kill the
// Host BEFORE any wake turn starts, then restart and count claims.
const A6_INBOX_UNCLAIMED = process.env['C1_A6_INBOX_UNCLAIMED'] === '1'
const A6_INBOX_ACTIVE = A6_INBOX || A6_INBOX_UNCLAIMED
// JOINT-LEADER-IDLE (2026-11-11, this lane). The JOINT world provisions its
// Officer and worker DIRECTLY through the production tool route (below), so the
// model-driven Leader turn must not provision a SECOND pair: two live Officers
// is a product REFUSAL by law ("zero or multiple live Officers is a refusal,
// never a choice"), and the assignment/facts ports answered null because of it.
// In this composition the Leader's turn is therefore idle by contract: it holds
// no work and creates nothing. The dedicated A6 scenarios keep the full script.
const JOINT_LEADER_IDLE = true
// A6-EXEC-NEG: after the normal allow/execute measurement, drive the two
// negative controls against the SAME plane: (1) a denied call must produce NO
// execution-result, (2) a call whose backend THROWS must produce a terminal
// `failed` fact, never `succeeded`.
const A6_EXEC_NEG = process.env['C1_A6_EXEC_NEG'] === '1'
const SUM_A6_DENY = 'c1-a6-deny-sentinel'
const SUM_A6_THROW = 'c1-a6-throw-sentinel'
const MK_A6DENY = 'C1MK_A6DENY'
const MK_A6THROW = 'C1MK_A6THROW'
const A6_EXTRA = A6_RECIPIENTS || A6_HANDOFF
const SUM_A6_SELF = `c1-a6-self-${RUN_STAMP}`
const FILE_A6_SELF = join(WORKSPACE, `c1-a6-self-${RUN_STAMP}.txt`)
const CMD_A6_SELF = `echo ${SUM_A6_SELF} > ${FILE_A6_SELF} && echo a6-self-executed`
const SUM_A6_HANDOFF = `c1-a6-handoff-${RUN_STAMP}`
const FILE_A6_HANDOFF = join(WORKSPACE, `c1-a6-handoff-${RUN_STAMP}.txt`)
const CMD_A6_HANDOFF = `echo ${SUM_A6_HANDOFF} > ${FILE_A6_HANDOFF} && echo a6-handoff-executed`
const FILE_Y = join(WORKSPACE, `c1-y-${RUN_STAMP}.txt`)
const FILE_Z = join(WORKSPACE, `c1-z-${RUN_STAMP}.txt`)
const CMD_X_ALLOW = `echo ${SUM_X_ALLOW} > ${FILE_X_ALLOW} && echo x-allow-executed`
const CMD_X_DENY = `echo ${SUM_X_DENY} > ${FILE_X_DENY} && echo x-deny-executed`
const CMD_A6_ALLOW = `echo ${SUM_A6_ALLOW} > ${FILE_A6_ALLOW} && echo a6-allow-executed`
// PD42 ceiling arm locators: INSIDE is under the ceiling's read/write lane
// (WORKSPACE); OUTSIDE is a sibling of WORKSPACE and is outside BOTH lanes.
const SUM_PD42_INSIDE = `pd42-inside-${RUN_STAMP}`
const SUM_PD42_OUTSIDE = `pd42-outside-${RUN_STAMP}`
const FILE_PD42_INSIDE = join(WORKSPACE, `pd42-inside-${RUN_STAMP}.txt`)
const FILE_PD42_OUTSIDE = join(HOME, `pd42-outside-${RUN_STAMP}.txt`)
// body-started-but-result-unknown probe: the start marker is durable BEFORE the
// result write; a crash between them must never replay the body.
const CMD_A6_BODY = `echo body-started > ${FILE_A6_BODY_START} && sleep 20 && echo ${SUM_A6_ALLOW} > ${FILE_A6_ALLOW}`
const CMD_Y = `echo ${SUM_Y} > ${FILE_Y} && echo y-executed`
const CMD_Z = `echo ${SUM_Z_FILE} > ${FILE_Z} && echo z-executed`

// ── logging / criteria / fatals ─────────────────────────────────────────────

let RUN_LOG = null
// J10 (cold recovery) SIGKILLs the booted Host and cold-boots a REPLACEMENT on
// the same DSH_HOME/port. Teardown must stop the live process, not the corpse:
// a leaked replacement would keep the port and keep writing after the run.
let LIVE_HOST_AFTER_RESTART = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try {
      writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' })
    } catch { /* evidence best-effort */ }
  }
}

const criteria = []
function check(critId, name, ok, detail) {
  criteria.push({ id: critId, name, ok: ok === true, detail: String(detail ?? '') })
  log(`${ok === true ? 'PASS' : 'FAIL'} ${critId}: ${name}${detail === '' || detail === undefined ? '' : ` — ${String(detail).slice(0, 500)}`}`)
  return ok === true
}

function writeEvidence(name, content) {
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, name), typeof content === 'string' ? content : JSON.stringify(content, null, 2))
  } catch { /* best-effort */ }
}

function dieFatal(msg, exitCode = 1) {
  log(`FATAL ${msg}`)
  writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: msg, criteria })
  process.exit(exitCode)
}

// ── small http helpers (a2x/rc2 kit shape) ──────────────────────────────────

async function fetchJson(url, init, timeoutMs = 60_000) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ status: 0, body: null, error: e.message }))
  const body = res.status === 0 ? null : await res.json().catch(() => null)
  return { status: res.status, body }
}

async function probeStableInstance(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(5_000) }).catch(() => null)
  return { url, status: res === null ? 'unreachable' : res.status }
}

async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

/** One browser-facing public Remote call: POST /team-remote/<method>. */
async function remoteCall(origin, cookie, method, params, tag = 'c1', version = 1) {
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

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text, tag = 'c1') {
  return fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
  }, 240_000)
}

async function apiCancel(origin, cookie, sessionId, tag = 'c1cancel') {
  return fetchJson(`${origin}/api/session/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/cancel',
      payload: { args: { request: { sessionId } } },
    }),
  }, 30_000)
}

/**
 * The DURABLE goal row of one child session, over the public Host RPC
 * (`goals/get`). J07/J08 read the product's own durable state for the goal
 * verdict — never the model's claim and never a mock-side guess.
 */
async function goalGet(origin, cookie, agentId, tag = 'c1goalget') {
  const res = await fetchJson(`${origin}/api/goals/get`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'goals/get',
      payload: { args: { agentId } },
    }),
  }, 30_000)
  const value = res.body?.result?.value ?? null
  const goal = value ?? null
  return { ok: res.body?.result?.ok === true && goal !== null, goal, raw: res.body ?? res }
}

async function p6t6State(port) {  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

function logTail(logPath, n = 25) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')
  } catch {
    return '<no log>'
  }
}

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

async function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let seen = 0
  for (;;) {
    let text = ''
    try {
      text = readFileSync(logPath, 'utf8')
    } catch { /* not written yet */ }
    const lines = text === '' ? [] : text.split('\n')
    for (let i = seen; i < lines.length; i += 1) {
      const m = regex.exec(lines[i])
      if (m !== null) return lines[i]
    }
    seen = lines.length
    if (Date.now() >= deadline) break
    if (alive !== undefined && !alive()) return null
    await new Promise((r) => setTimeout(r, 300))
  }
  try {
    const full = readFileSync(logPath, 'utf8')
    for (const l of full.split('\n')) {
      const m = regex.exec(l)
      if (m !== null) return l
    }
  } catch { /* best-effort */ }
  return null
}

// ── preflight ───────────────────────────────────────────────────────────────

function preflight() {
  const rev = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: TESTUSE, encoding: 'utf8' })
  if (rev.status !== 0 || rev.stdout.trim() !== HOST_BASELINE_SHA) {
    dieFatal(`test-use checkout is not at ${HOST_BASELINE_SHA} (got ${rev.stdout?.trim() ?? rev.stderr})`)
  }
  const dirty = spawnSync('git', ['status', '--porcelain'], { cwd: TESTUSE, encoding: 'utf8' })
  if (dirty.status !== 0 || dirty.stdout.trim() !== '') {
    dieFatal(`test-use checkout is not pristine: ${dirty.stdout?.trim().slice(0, 200)}`)
  }
  for (const p of [HOST_BIN, PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH, P6T6_PLUGIN_PATH]) {
    if (!existsSync(p)) dieFatal(`required file missing: ${p}`)
  }
}

async function portFree(port, timeoutMs = 1500) {
  const res = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(timeoutMs) }).catch((e) => ({ error: e }))
  if (res.error) return true
  return false
}

async function pickHostPort() {
  if (args.includes('--host-port')) return Number(argValue('host-port', 0))
  for (const p of [3501, 3502, 3503, 3504, 3505, 3507, 3508, 3509, 3510]) {
    if (await portFree(p)) return p
  }
  dieFatal('no free host port in 3501-3510')
}

// ── world materialization ───────────────────────────────────────────────────

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
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

function planeLauncherSha() {
  return createHash('sha256').update(readFileSync(join(WORKTREE, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py'))).digest('hex')
}

function teamRowConfig() {
  const launcher = join(WORKTREE, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
  const planeRealmId = `c1-plane-realm-${RUN_STAMP}`
  const plane = PLANE_TAKEOVER
    ? {
        realmId: planeRealmId,
        names: { bash: 'bash' },
        workingDir: join(HOME, 'workspace'),
        confinedProvider: {
          trustRoot: `sha256:${planeLauncherSha().slice(0, 16)}#${launcher}`,
          assembly: { launcherPath: launcher, launcherSha256: planeLauncherSha(), minAbiVersion: 3 },
        },
      }
    : undefined
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: (ALPHA6_BOOT_ONLY || ALPHA6_OFFICER) ? BP_A6_ANCHOR_YAML : BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    rootPresetId: PD42_CELLINGS ? GOVERNED_PRESET_ID : SMOKE_PRESET_ID,
    // PD42: the Member preset is the SHIPPED governed preset, so the realm's
    // confined `bash` (not the smoke preset's isolated persistent PTY) is the
    // model-visible face the compiled ceiling governs.
    memberPresetId: PD42_CELLINGS ? GOVERNED_PLANE_PRESET_ID : SMOKE_PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'c1-smoke-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
    ...(plane === undefined ? {} : { teamToolPlane: plane }),
    // PD42: the Alpha.5 governed realm, derived from the SAME bound blueprint
    // (`a5sfGovernedRealm` is the neutral key; no policy is typed here). The
    // evidence sink is where the product guard writes its consult facts.
    ...(PD42_CELLINGS
      ? { a5sfGovernedRealm: true, a5sfEvidencePath: A5SF_CONSULT_SINK }
      : {}),
    ...(ALPHA6_BOOT_ONLY || ALPHA6_OFFICER
      ? {
          alpha6ReviewRouting: true,
          alpha6WakeIntentPath: join(HOME, 'alpha6-wake-intents'),
          ...(A6_TIMEOUT_MS > 0 ? { alpha6WaitTimeoutMs: A6_TIMEOUT_MS } : {}),
        }
      : {}),
  }
}

/** The row anchor: a plain legacy leader (the 0.1.0-rc.1 boot shape). */
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 3',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: "You are the leader of the C1 smoke boot team. ${MK_DISC} is the discovery marker."`,
  'members:',
  '  - templateId: worker',
  '    persona: "You are a worker of the C1 smoke boot team."',
  'memberEnvelopes: []',
  'requirements: []',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

/** The v5 opt-in anchor: Officer admitted, routing declared, durable path configured. */
const BP_A6_ANCHOR_YAML = [
  '---',
  'schemaVersion: 5',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader: { templateId: leader, persona: C1 Alpha.6 boot anchor. }',
  'members:',
  '  - templateId: officer',
  '    persona: Review asks for this team.',
  '  - templateId: worker',
  '    persona: Worker of the C1 smoke boot team.',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'permissionMutationEnvelope: { rules: [] }',
  'teamHardEnvelope: { rules: [] }',
  'teamEnvelope:',
  '  allow:',
  '    - request-control',
  '  deny: []',
  'metadata: {}',
  'reviewRouting:',
  '  enabled: true',
  '  officerTemplateId: officer',
  '  ordinaryToolApprovals:',
  '    default: officer',
  '    leaderExceptions: []',
  '  whenOfficerUnavailable: hold',
  '---',
  '',
].join('\n')

/**
 * One saved-source strict blueprint (X/Y/Z — same shape, different
 * personas/markers). The Leader declares the full capability set (strict
 * Coverage Gate) + the C1 approval-loop tools in teamTools. The WORKER is
 * strict too — `default: ask` + `ask bash any` is what makes its bash
 * calls produce durable `leader-approval` requests (the pre-execute
 * adapter's ask-lane path). The member envelope admits `request-control`
 * (the ask's control-request creation is an admitted mutation op for the
 * calling agent — LIVE-FOUND rc2) but NOT `resolve-control` (a member is
 * never a resolver).
 */
function savedBlueprintYaml(bpId, leaderPersona, workerPersona, denyList) {
  const denyLines = (list, baseIndent) => {
    const pad = '  '.repeat(baseIndent)
    return list.length === 0
      ? [`${pad}builtinToolDeny: []`]
      : [`${pad}builtinToolDeny:`, ...list.map((n) => `${pad}  - ${n}`)]
  }
  const leaderBlock = [
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS_ALLOW.map((t) => `        - ${t}`),
    ...denyLines(denyList, 2),
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: team',
    '      ask:',
    '        - tool: bash',
    '          resource:',
    '            kind: any',
    ...(PLANE_TAKEOVER ? ['      deny: []'] : [
      '      deny:',
      '        - tool: read',
      '          resource:',
      '            kind: subtree',
      '            path: runtime',
    ]),
  ]
  const workerBlock = [
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify(workerPersona)}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    ...denyLines(denyList, 3),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: ask',
    '        allow:',
    '          - tool: read',
    '            resource:',
    '              kind: subtree',
    '              path: team',
    // PD42 ceiling arm: the PERMISSION layer allows read/write `any`, so the
    // compiled CEILING (memberIoCeilings read/write restricted to WORKSPACE) is
    // the only thing that can refuse the out-of-lane calls — that is what makes
    // the refusal evidence about the ceiling rather than about permissions.
    ...(PD42_CELLINGS
      ? [
          '          - tool: read',
          '            resource:',
          '              kind: any',
          '          - tool: write',
          '            resource:',
          '              kind: any',
        ]
      : []),
    '        ask:',
    '          - tool: bash',
    '            resource:',
    '              kind: any',
    ...(PLANE_TAKEOVER ? ['        deny: []'] : [
      '        deny:',
      '          - tool: read',
      '            resource:',
      '              kind: subtree',
      '              path: runtime',
    ]),
  ]
  const teamEnvelope = [
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '  deny: []',
  ]
  const memberEnvelope = [
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '        - request-control',
    '      deny: []',
  ]
  return [
    '---',
    'schemaVersion: 3',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    ...leaderBlock,
    ...teamEnvelope,
    ...workerBlock,
    ...memberEnvelope,
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/** The v5 Officer shape: the strict worker/leader plus a real reviewer. */
function savedBlueprintA6Yaml(denyList) {
  const officer = [
    '  - templateId: officer',
    '    persona: "You are the C1 smoke Officer. Resolve the review legs routed to you; do not execute work."',
    '    capabilities:',
    '      teamTools:',
    '        kind: allow',
    '        items:',
    '          - team_list_pending_control',
    '          - team_resolve_control',
    // PD42: the Officer runs on the governed preset too; its out-of-vocabulary
    // faces must be removed for the coverage gate (same list as the worker).
    ...(PD42_CELLINGS
      ? ['      builtinToolDeny:', ...denyList.map((name) => `        - ${name}`)]
      : ['      builtinToolDeny: []']),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: deny',
    '        allow: []',
    ...(A6_EXTRA
      ? ['        ask:', '          - tool: bash', '            resource:', '              kind: any']
      : ['        ask: []']),
    '        deny: []',
  ]
  // J07/J08 — the GOAL template. Upstream `create_goal`/`get_goal`/`update_goal`
  // come from the governed preset's `tool-goal` row. The worker/officer/leader
  // templates deny them because a STRICT template (one that declares
  // `capabilities.permissions`) must account for every tool on the final
  // surface (the A2C-2 ownership gate) and the joint smoke surface never
  // exercised the goal family. This template declares NO permissions policy —
  // the gate is absent by contract (`capabilities.permissions` is what arms it),
  // so the goal tools stay on the surface and the arm measures the REAL upstream
  // authority (`hasDirectHumanInput`) rather than a kit-side denial. The Member
  // still rides the governed preset and the `memberIoCeilings` entry below.
  // Diagnostic knob: `JOINT_NO_GOAL_TEMPLATE=1` drops the goal template from the
  // document (isolation control when the governed plane's mount is in question).
  const goalTemplateEnabled = process.env['JOINT_NO_GOAL_TEMPLATE'] !== '1'
  const goalWorker = !goalTemplateEnabled ? [] : [
    '  - templateId: goal-worker',
    '    persona: "You are the C1 smoke goal worker. Drive the goal tools you are given; do not delegate."',
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    // The four base sub-fields are REQUIRED whenever `capabilities` is
    // present; an EMPTY deny list is the honest declaration here: this
    // template denies no built-in tool, so `create_goal`/`get_goal`/
    // `update_goal` stay on the surface and the arm measures upstream
    // authority instead of a kit-side denial. (The coverage gate is armed by
    // `capabilities.permissions`, which this template deliberately omits.)
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
  ]
  let text = savedBlueprintYaml(
    BP_A6_ID,
    `You are the A6 leader of the C1 smoke team. ${MK_A6}`,
    `You are worker-a6 of the C1 smoke team. ${MK_A6MEM}`,
    denyList,
  )
  text = text.replace('schemaVersion: 3', 'schemaVersion: 5')
  text = text.replace('revision: "1"', 'revision: "1"\nrequirements: []')
  text = text.replace('memberEnvelopes:', [...officer, ...goalWorker].join('\n') + '\nmemberEnvelopes:')
  // The worker envelope follows `memberEnvelopes:`; append the Officer and the
  // J07/J08 goal-worker entries under the SAME key (a second mapping key would
  // be duplicate YAML). The goal worker keeps the ordinary member envelope: a
  // human/machine relay starts its turn, and the arm's question is the GOAL
  // authority, not the Team mutation envelope.
  const goalWorkerEnvelope = !goalTemplateEnabled ? '' : ['  - templateId: goal-worker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '        - request-control', '      deny: []'].join('\n')
  if (A6_EXTRA) {
    text = text.replace(
      '      deny: []\npermissionMutationEnvelope:',
      '      deny: []\n  - templateId: officer\n    envelope:\n      allow:\n        - request-control\n        - resolve-control\n      deny: []\n' + goalWorkerEnvelope + '\npermissionMutationEnvelope:',
    )
  } else {
    text = text.replace(
      '      deny: []\npermissionMutationEnvelope:',
      '      deny: []\n  - templateId: officer\n    envelope:\n      allow:\n        - resolve-control\n      deny: []\n' + goalWorkerEnvelope + '\npermissionMutationEnvelope:',
    )
  }
  text = text.replace(
    'metadata: {}',
    [
      // PD42: the Alpha.5 Member ceiling family on the SAME v5 document that
      // carries `reviewRouting` below. Read and write are the kit WORKSPACE;
      // `PD42_OUTSIDE` (one directory up) is outside both lanes and is the
      // refusal arm's locator.
      ...(PD42_CELLINGS
        ? [
            'memberIoCeilings:',
            '  - templateId: worker',
            '    io:',
            '      read:',
            '        mode: restricted',
            `        allow: ["${WORKSPACE}"]`,
            '        ask: []',
            '        deny: []',
            '      write:',
            '        mode: restricted',
            `        allow: ["${WORKSPACE}"]`,
            '        ask: []',
            '        deny: []',
            '      network:',
            '        mode: allow',
            '  - templateId: officer',
            '    io:',
            '      read:',
            '        mode: restricted',
            `        allow: ["${WORKSPACE}"]`,
            '        ask: []',
            '        deny: []',
            '      write:',
            '        mode: restricted',
            `        allow: ["${WORKSPACE}"]`,
            '        ask: []',
            '        deny: []',
            '      network:',
            '        mode: allow',
            // J07/J08: the goal worker is a governed Member too (same one
            // ceiling family on the same v5 document), so its bash is the
            // plane's governed face and a relay turn's refusal cannot be
            // confused with an ungoverned composition.
            ...(goalTemplateEnabled ? [
              '  - templateId: goal-worker',
              '    io:',
              '      read:',
              '        mode: restricted',
              `        allow: ["${WORKSPACE}"]`,
              '        ask: []',
              '        deny: []',
              '      write:',
              '        mode: restricted',
              `        allow: ["${WORKSPACE}"]`,
              '        ask: []',
              '        deny: []',
              '      network:',
              '        mode: allow',
            ] : []),
          ]
        : []),
      'reviewRouting:',
      '  enabled: true',
      '  officerTemplateId: officer',
      '  ordinaryToolApprovals:',
      '    default: officer',
      ...(A6_EXCEPTION
        ? ['    leaderExceptions:', '      - memberTemplateId: worker', '        tool:', '          owner: dsh-agent-team', '          name: bash']
        : ['    leaderExceptions: []']),
      '  whenOfficerUnavailable: hold',
      'metadata: {}',
    ].join('\n'),
  )
  return text
}

/**
 * The kit's agent preset as a 0.2 DECLARATION ROW (was: a
 * `$DSH_HOME/.agent-presets/<id>/agent.cordis.yml` directory, which no host
 * generation >= 0.1.7 reads). Content is unchanged from the 0.1.7 kit: persona
 * + dsh-tool-fs + the minimal-style persistent shell group (bash stack). NO
 * delegation group: the 0.1.5 spawn `subagent` row is a deferred per-agent
 * own-layer install - un-restrictable and KNOWN_SENSITIVE under the Coverage
 * Gate (followup-backlog 2/5/6).
 */
function smokePresetDeclaration() {
  return presetDeclarationRow({
    id: SMOKE_PRESET_ID,
    displayName: 'c1 smoke',
    description: `C1 real-host smoke preset (run ${RUN_STAMP}); mounted through the public profile-patch seam.`,
    plugins: smokePresetPlugins({
      personaText: 'You are a coding agent powered by the {{model}} model.',
      cwdSuffix: 'Your working directory is {{cwd}}.',
      bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
    }),
  })
}

/**
 * PD42 — the SHIPPED governed Member preset row, read from the repository's own
 * `cordis.patch.yml` (the ONE shipped composition), with its single `!!js`
 * platform predicate evaluated in this process. The row is mounted verbatim:
 * this kit never authors a second governed preset.
 */
function shippedGovernedPresetRow({ id = GOVERNED_PRESET_ID, planeOwnedBash = false } = {}) {
  const YAML = createRequire(join(WORKTREE, 'package.json'))('yaml')
  const raw = readFileSync(join(WORKTREE, 'cordis.patch.yml'), 'utf8')
  const substituted = raw.replace(/!!js[ \t]+([^\n]+)/gu, (_m, expr) => {
    // eslint-disable-next-line no-new-func
    const value = new Function(`"use strict";return (${expr.trim()})`)()
    return JSON.stringify(value)
  })
  const doc = YAML.parse(substituted)
  const rows = []
  const visit = (list) => {
    for (const row of list ?? []) {
      if (Array.isArray(row?.insert)) { visit(row.insert); continue }
      rows.push(row)
    }
  }
  visit(doc)
  const preset = rows.find((row) => row?.config?.id === GOVERNED_PRESET_ID)
  if (preset === undefined) {
    throw new Error(`the shipped layer carries no preset '${GOVERNED_PRESET_ID}' row (PD42)`)
  }
  // ENVIRONMENT ACCOMMODATION, disclosed: this kit's bare `dsh web` profile
  // provides no `web` service, so the shipped preset's `tool-web` row (whose
  // `inject` REQUIRES `web`) never starts and the Member activation fails. The
  // row is a name-holder for a network face; the PD42 proof is the Member I/O
  // realm + the A6 route, so the unavailable face is dropped HERE (kit-side),
  // never in the shipped preset. The dropped row is recorded in the evidence.
  //
  // PLANE-OWNED BASH, disclosed: the A6 execute leg re-dispatches the approved
  // call through the Alpha.5 Team tool PLANE, which owns the `bash` binding. A
  // second `bash` from the preset is a placement conflict, so the MEMBER copy of
  // the preset drops `tool-bash` and the plane's guarded binding is the only
  // bash on that scope. The ROOT copy keeps it (the boot Leader has no plane).
  const filtered = {
    ...preset,
    id: id === GOVERNED_PRESET_ID ? preset.id : preset.id.replace(GOVERNED_PRESET_ID, id),
    config: {
      ...preset.config,
      id,
      plugins: (preset.config.plugins ?? []).filter((plugin) => {
        if (plugin?.id === 'tool-web') return false
        if (planeOwnedBash && plugin?.id === 'tool-bash') return false
        return true
      }),
    },
  }
  return filtered
}

/** The plane-owned-bash member copy of the shipped preset (PLANE TAKEOVER only). */
const GOVERNED_PLANE_PRESET_ID = `${GOVERNED_PRESET_ID}-plane`

function writePatchFile(home) {
  mkdirSync(join(home, 'profiles', 'web'), { recursive: true })
  const lines = [
    `# C1 real-host smoke patch layer (run ${RUN_STAMP}): production dsh-agent-team row (worktree dist — the C1 branch build) + p6t6 observability row — mounted ONLY through the public profile-patch seam.`,
    '# (0.2.0-rc.2: a preset is a declaration row mounted on this seam; the retired user-preset directory is not read by the host.)',
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    ...(PD42_CELLINGS ? yamlEmitItem(shippedGovernedPresetRow(), 2) : []),
    ...(PD42_CELLINGS
      ? yamlEmitItem(shippedGovernedPresetRow({ id: GOVERNED_PLANE_PRESET_ID, planeOwnedBash: JOINT_PRESET === 'fs-only' }), 2)
      : []),
    ...yamlEmitItem(smokePresetDeclaration(), 2),
    '',
  ]
  writeFileSync(join(home, 'profiles', 'web', 'cordis.patch.yml'), lines.join('\n'))
}

// ── the real-host boot (test-use bin) ───────────────────────────────────────

function spawnHost({ port, home, logPath, mockPort }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  let child
  try {
    child = spawn(
      process.execPath,
      [HOST_BIN, 'web', '--port', String(port), '--no-open'],
      {
        cwd: WORKSPACE,
        stdio: ['ignore', outFd, errFd],
        env: {
          ...process.env,
          DSH_HOME: home,
          DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH,
          DEEPSEEK_BASE_URL: `http://127.0.0.1:${mockPort}`,
          DEEPSEEK_API_KEY: 'c1-smoke-mock-key',
        },
      },
    )
  } catch (error) {
    closeSync(outFd)
    closeSync(errFd)
    throw new Error(`host spawn failed: ${error.message}`)
  }
  const exitInfo = { exited: false, code: undefined, signal: undefined, message: undefined }
  child.on('error', (error) => {
    exitInfo.exited = true
    exitInfo.signal = 'spawn-error'
    exitInfo.message = error.message
  })
  child.on('close', (code, signal) => {
    exitInfo.exited = true
    exitInfo.code = code
    exitInfo.signal = signal
  })
  return { child, exitInfo, alive: () => !exitInfo.exited, logPath }
}

function stopHost(h) {
  try {
    h.child.kill()
  } catch { /* already gone */ }
  return h
}

async function bootHost({ port, home, mockPort, instanceLog }) {
  writePatchFile(home)
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'c1-anchor.yaml'), BP_ANCHOR_YAML)
  writeFileSync(join(home, 'p6t6-directive.json'), JSON.stringify({
    boot: 1,
    phase: 'create',
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: ROOT,
  }, null, 2))
  const h = spawnHost({ port, home, logPath: instanceLog, mockPort })
  const line = await waitForLogLine(instanceLog, BOOT_MARKER, 240_000, h.alive)
  if (line === null) {
    stopHost(h)
    const detail = h.exitInfo.exited
      ? `process exited (code=${h.exitInfo.code} signal=${h.exitInfo.signal ?? 'none'}${h.exitInfo.message ? ` msg=${h.exitInfo.message}` : ''})`
      : 'no boot marker within 240s'
    dieFatal(`host boot failed: ${detail}\n--- log tail ---\n${logTail(instanceLog)}`)
  }
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(line.replace(/.*dsh web:\s*/, ''))
  if (m === null) dieFatal(`unexpected boot url shape: ${line}`)
  const origin = `http://127.0.0.1:${m[1]}`
  const cookie = await authenticate(origin, m[2]).catch((e) => dieFatal(`auth failed: ${e.message}`))
  const deadline = Date.now() + 240_000
  let health = null
  for (;;) {
    const hb = await p6t6Health(Number(m[1]))
    health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      stopHost(h)
      dieFatal(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    if (Date.now() >= deadline) {
      stopHost(h)
      dieFatal(`row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 400)}\n--- log tail ---\n${logTail(instanceLog)}`)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  const sDeadline = Date.now() + 90_000
  let state = null
  for (;;) {
    const s = await p6t6State(Number(m[1]))
    state = s
    const b = s.body
    if (s.status === 200 && b !== null && typeof b === 'object'
      && b.rootSessionId === ROOT && b.phase === 'create'
      && b.teamSession !== null && typeof b.teamSession === 'object') break
    if (Date.now() >= sDeadline) {
      stopHost(h)
      dieFatal(`row state not well-formed in 90s; last: status=${s.status} body=${JSON.stringify(s.body).slice(0, 400)}`)
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  log(`host booted at ${origin}; row ready — toolCount=${health.body?.toolCount}`)
  return { host: h, port: Number(m[1]), origin, cookie, instanceLog, health, stateBody: state.body }
}

// ── mock decide policy (C1: leaders, members, notification turns) ──────────

/** The plane's shell row is CLOSED: it names `timeout`, not the native `timeoutMs`. */
function bashArgs(command) {
  return PLANE_TAKEOVER ? { command, timeout: 30_000 } : { command, timeoutMs: 30_000 }
}

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-c1-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}

function bodyOf(recordOrBody) {
  if (recordOrBody === null || typeof recordOrBody !== 'object') return null
  return 'body' in recordOrBody ? (recordOrBody.body ?? null) : recordOrBody
}

function messagesOf(req) {
  return bodyOf(req)?.messages ?? []
}

/** ALL user messages joined (forensic scans). */
function userTextOf(req) {
  return messagesOf(req)
    .filter((m) => m.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
}

/** The LAST user message containing a chain trigger (a MK_* marker or
 *  the C1 notification token). The DSH agent loop injects a "Current
 *  runtime context..." user message AFTER the real input on the first
 *  request of a session, so the raw last user message is not a reliable
 *  chain selector (LIVE-FOUND run 08-45-27: DISC routed to the NOOP
 *  fallback). Multi-chain sessions (the ZCHECK input re-uses the Z root;
 *  the notification re-uses the X/Z root) need the newest MARKER-bearing
 *  input; sessions with no marker in the history fall back to the raw
 *  last user message. */
const TRIGGER_RE = /C1MK_[A-Z0-9_]+_[0-9T:-]+|\[team-control requestId=/

/**
 * 0.2.0-rc.2 delivers tool results as `user` messages carrying a
 * `tool_result` content block (0.1.x used role `tool`). Such a message can
 * echo the prompt/persona text, so it must never be mistaken for a NEW chain
 * trigger and must count as chain progress.
 */
function isToolResultMessage(m) {
  if (m?.role === 'tool') return true
  return m?.role === 'user' && Array.isArray(m.content)
    && m.content.some((block) => block?.type === 'tool_result')
}

function lastTriggerIndex(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const m = messages[i]
    if (m.role !== 'user' || isToolResultMessage(m)) continue
    const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
    if (TRIGGER_RE.test(t)) return i
  }
  // Fallback: the raw last non-tool-result user message.
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    if (messages[i].role === 'user' && !isToolResultMessage(messages[i])) return i
  }
  return -1
}

/** The chain trigger text (see lastTriggerIndex). */
/**
 * Count wake TURN STARTS. A fresh wake delivery has exactly the wake text as
 * its only message (`messageCount === 1`); later model calls of that same turn
 * carry prior assistant/tool messages. A native resume of the crashed turn
 * therefore appears as `messageCount > 1`, while a newly delivered wake
 * appears as `messageCount === 1`. Two starts = two deliveries.
 */
function wakeStartCount(requests) {
  return requests.filter((request) =>
    /^\[team-review-wake wakeId=([^\]]+)\]/.test(lastUserTextOf(request))
    && (request.body?.messages?.length ?? 0) === 1).length
}

function lastUserTextOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  if (i === -1) return ''
  const last = messages[i]
  // 0.2.0 user messages carry content BLOCKS; the notification/trigger text is
  // the concatenated text blocks, never the JSON wrapper.
  return contentText(last.content)
}

/**
 * The tool messages AFTER the chain trigger (chain progress). The
 * cumulative count misroutes multi-chain sessions (an earlier chain's
 * tool results stay in the history).
 */
function toolMsgsOf(req) {
  const messages = messagesOf(req)
  const i = lastTriggerIndex(req)
  return messages.slice(i + 1).filter(isToolResultMessage)
}

/** Flatten 0.2.0 content blocks (text / tool_result) to plain text. */
function contentText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((block) => {
    if (block?.type === 'tool_result') return contentText(block.content)
    return typeof block?.text === 'string' ? block.text : ''
  }).join('\n')
  return JSON.stringify(content ?? '')
}

/**
 * The LAST goal ref (`{id, revision}`) carried by the tool RESULTS of one mock
 * request. J07's mock drives create_goal → get_goal → update_goal inside ONE
 * turn; `update_goal` requires the EXACT `(goal_id, revision)` get_goal
 * returned, so the value must come from the product's own result text, never
 * from a kit constant (that would make the arm measure the kit).
 */
function lastGoalRefIn(req) {
  const texts = toolMsgsOf(req).map((message) => contentText(message?.content))
  for (let i = texts.length - 1; i >= 0; i -= 1) {
    const m = /"goal"\s*:\s*\{[^}]*?"id"\s*:\s*"(goal-[^"]+)"[^}]*?"revision"\s*:\s*(\d+)/.exec(texts[i])
      ?? /"id"\s*:\s*"(goal-[^"]+)"[^}]*?"revision"\s*:\s*(\d+)/.exec(texts[i])
    if (m !== null) return { id: m[1], revision: Number(m[2]) }
  }
  return null
}

/** The instance id from a team_create_member / team_delegate tool result. */
function extractInstanceId(content) {  const text = contentText(content)
  const m =
    /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(text) ??
    /"instanceId"\s*:\s*"([^"]+)"/.exec(text) ??
    /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(text)
  return m === null ? null : m[1]
}

/** The requestId from a C1 notification text (`requestId: <id>` line). */
function extractNotifRequestId(text) {
  const m = /requestId:\s*([A-Za-z0-9][A-Za-z0-9_-]{3,128})/.exec(String(text))
  return m === null ? null : m[1]
}

/** The FIRST requestId in a team_list_pending_control tool result JSON. */
function extractListedRequestId(content) {
  const m = /"requestId"\s*:\s*"([^"]+)"/.exec(String(content))
  return m === null ? null : m[1]
}

/** The requestId in a team_request_control / resolve tool result. */
function extractResultRequestId(content) {
  const m = /"requestId"\s*:\s*"([^"]+)"/.exec(String(content))
  return m === null ? null : m[1]
}

/**
 * The C1 mock oracle. Chain routing is over (LAST user message, tool
 * messages AFTER it):
 *
 *   1. title side-calls → neutral (they nest the markers);
 *   2. `[team-control requestId=...` → a C1 notification turn:
 *        c1-z-<stamp>.txt summary → the deliberate 500 (S4 injection);
 *        otherwise list pending + resolve (the verdict + root come from
 *        the summary markers: c1-x-allow → allow@X, c1-x-deny →
 *        deny@X, c1-z-s5 → allow@Z, c1-y → the S6 post-turn chain);
 *   3. member chains (X: bash allow-ask → bash deny-ask → done;
 *      Z: bash → done — its blocked execution resumes after the
 *      recovered allow; Y: bash → done);
 *   4. leader chains (X/Z: create_member → async delegate → done;
 *      Y: create_member → SYNC delegate → done — the S6 blocked turn;
 *      Z-check: list → resolve R_Z1 → request_control →
 *      request_control (same token, S5) → done;
 *      XCROSS on the X leader: list pending for ROOTZ → resolve ZREQ for
 *      ROOTZ → done — both must reject TEAM_TOOL_CALLER_ROOT_MISMATCH
 *      (RH2/RH3, PR #20 closure)).
 */
function replyToolNames(record) {
  return (record?.reply?.toolCalls ?? []).map((t) => t?.name ?? '').filter((n) => n !== '')
}


// ─────────────────────────────────────────────────────────────────────────────
// JOINT ACCEPTANCE — one v5 Team carrying BOTH families, the product-intended
// native-bash governed realm, and the Alpha.6 review route.
// ─────────────────────────────────────────────────────────────────────────────

/** The eleven arms of the joint acceptance, in the brief's order. */
const JOINT_ARMS = Object.freeze([
  ['J01', 'Team + routing: v5 both families admitted; Officer routed, one team_resolve_control'],
  ['J02', 'Governed I/O inside the ceiling: write succeeds + a5sf-guard-consult/1 ALLOW fact'],
  ['J03', 'Governed I/O outside the ceiling: typed deny, zero bytes, deny attributable'],
  ['J04', 'Native bash governed: pinned definition, realm PTY, shared PTY state, second Member separate PTY'],
  ['J05', 'Approval lifecycle: durable request -> human allow -> one consumption -> one execution -> one execution-result; deny = zero/zero/zero'],
  ['J06', 'Officer identity (F-3): which decider receives parameter-permission vs team-tool-execute; whenOfficerUnavailable honoured'],
  ['J07', 'Goal from direct human input: create/get/update, >=2 automatic rounds, human Stop -> durable paused, no continuation'],
  ['J08', 'Relay refusal: a machine relay turn cannot create_goal (GOAL_TOOL_AUTHORITY_REQUIRED) and no Goal row exists'],
  ['J09', 'Sticky Stop on the review-wake path: live latch -> human Stop -> durable stopped-<hash>.json, and a subsequent review ask wakes nobody'],
  ['J10', 'Cold recovery: SIGKILL mid-body, cold boot on the same DSH_HOME, no duplicate execution, no replayed consumed allow, crash-window settlement unknown'],
  ['J11', 'No replay: a consumed allow cannot be re-dispatched; a late allow is refused (CONTROL_REQUEST_DECIDED)'],
])

/** POST /__p6t6/tool — one registered tool call on the agent bound to `as`. */
async function p6t6Tool(origin, name, toolArgs, as) {
  return fetchJson(`${origin}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args: toolArgs, as }),
  })
}

/** The refused-tool text of one p6t6 outcome (or null when it succeeded). */
function p6t6ErrorText(outcome) {
  if (outcome === null || outcome === undefined) return null
  const body = outcome.body ?? outcome
  if (body?.ok !== true) return JSON.stringify(body?.error ?? body).slice(0, 2000)
  // A production team tool can REFUSE as a SUCCESSFUL tool result: the p6t6
  // route then returns {ok:true, value:{status:'rejected'|'blocked', message}}.
  // That refusal is the fact the arm needs, not a transport error.
  const value = body?.value
  if (value !== null && typeof value === 'object' && (value.status === 'rejected' || value.status === 'blocked')) {
    return `${String(value.status)}: ${String(value.code ?? value.toolName ?? '')} ${String(value.message ?? value.reason ?? '')}`.trim()
  }
  return null
}

function readGuardFacts() {
  if (!existsSync(A5SF_CONSULT_SINK)) return []
  return readFileSync(A5SF_CONSULT_SINK, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => {
    try { return JSON.parse(line) } catch { return null }
  }).filter((fact) => fact !== null)
}

/**
 * The joint acceptance scenario. It is deliberately NOT the legacy C1 arc:
 * one Team, one v5 blueprint with `memberIoCeilings` + `reviewRouting`, the
 * shipped governed preset, the plane takeover that publishes the native-bash
 * admission edge, and the arm verdicts in the brief's order.
 *
 * CLOSED VERDICT SET (the shared preflight vocabulary): PASS / FAIL /
 * NOT_REACHED / NOT_SELECTED / UNSUPPORTED / ENV_BLOCK. An arm whose
 * prerequisite never existed is NOT_REACHED; a refused requirement is FAIL.
 */
async function runJointScenario({ booted, mock, denyList, host }) {
  log(`── JOINT-ACCEPTANCE: one v5 Team, both families, preset=${JOINT_PRESET} ──`)
  const verdicts = new Map()
  const note = (id, verdict, detail) => {
    const row = JOINT_ARMS.find(([arm]) => arm === id)
    verdicts.set(id, { arm: id, proposition: row?.[1] ?? id, verdict, detail })
    log(`${verdict} ${id}: ${String(detail).slice(0, 900)}`)
  }

  // The ONE blueprint: v5, `memberIoCeilings` (worker + officer) AND
  // `reviewRouting` (Officer + whenOfficerUnavailable: hold).
  const bpText = savedBlueprintA6Yaml(denyList)
  writeFileSync(join(BLUEPRINT_DIR, 'joint.yaml'), bpText)
  writeEvidence('joint-blueprint.yaml', bpText)

  const create = await remoteCall(booted.origin, booted.cookie, 'team.create', {
    rootSessionId: CREATE_ROOT_A6,
    blueprintId: BP_A6_ID,
    initialWork: { prompt: MK_A6 },
  }, 'joint-create')
  writeEvidence('joint-create.json', create.body ?? create)
  const createOk = create.status === 200
    && create.body?.result?.ok === true
    && create.body?.result?.value?.data?.path === 'fresh-root'
  const blueprintHash = create.body?.result?.value?.data?.durable?.teamSession?.blueprint?.contentHash ?? null
  const bothFamilies = bpText.includes('memberIoCeilings:') && bpText.includes('reviewRouting:')
  note('J01', createOk && bothFamilies ? 'PASS' : 'FAIL',
    `team.create=${String(create.status)} admitted=${String(createOk)} blueprintHash=${String(blueprintHash)} memberIoCeilings=${String(bpText.includes('memberIoCeilings:'))} reviewRouting=${String(bpText.includes('reviewRouting:'))} schemaVersion=5`)
  if (!createOk) {
    for (const [id] of JOINT_ARMS.slice(1)) note(id, 'NOT_REACHED', 'team.create did not admit the v5 two-family document')
    await finishJoint({ verdicts })
    return false
  }

  // Provision the Officer + a worker through the production tool route, then
  // delegate the worker the governed Member turn. This is the SAME surface the
  // Leader's model uses (the p6t6 row is observability, not a second team API).
  const officer = await p6t6Tool(booted.origin, 'team_create_member', {
    rootSessionId: CREATE_ROOT_A6,
    requestToken: `joint-officer-${RUN_STAMP}`,
    delegationTemplateId: 'officer',
    label: 'officer',
  }, CREATE_ROOT_A6)
  const worker = await p6t6Tool(booted.origin, 'team_create_member', {
    rootSessionId: CREATE_ROOT_A6,
    requestToken: `joint-worker-${RUN_STAMP}`,
    delegationTemplateId: 'worker',
    label: 'w-joint',
  }, CREATE_ROOT_A6)
  const officerId = extractInstanceId(JSON.stringify(officer?.body?.value ?? officer?.body ?? ''))
  const workerId = extractInstanceId(JSON.stringify(worker?.body?.value ?? worker?.body ?? ''))
  const delegate = workerId === null ? null : await p6t6Tool(booted.origin, 'team_delegate', {
    rootSessionId: CREATE_ROOT_A6,
    requestToken: `joint-delegate-${RUN_STAMP}`,
    delegationInstanceId: workerId,
    label: 'w-joint',
    prompt: MK_A6MEM,
  }, CREATE_ROOT_A6)
  const setup = {
    officer: officer?.body ?? officer,
    worker: worker?.body ?? worker,
    delegate: delegate?.body ?? delegate,
    workerId,
  }
  writeEvidence('joint-setup.json', setup)
  const refused = [p6t6ErrorText(officer), p6t6ErrorText(worker), p6t6ErrorText(delegate)].filter((t) => t !== null)
  const activationRefusal = refused.find((t) => t.includes('native tool module re-mount failed')) ?? refused[0] ?? null

  // Did a governed Member ever start a model turn? That is the prerequisite of
  // every arm below J01.
  const memberReq = await waitForMock(mock, (r) => r.body !== null && JSON.stringify(r.body).includes(MK_A6MEM), 120_000, 'joint member turn')
  const memberLive = activationRefusal === null && memberReq !== null

  // ── JOINT-LIVENESS (2026-11-11, this lane): the review leg is resolved by a
  // MODEL TURN, so it lands AFTER the member's first request — the driver used
  // to read the ledger immediately and could measure its own speed instead of
  // the product's answer (an undecided leg is not a FAIL: the decider had not
  // answered yet). Three bounded waits, each disclosed in the arm details:
  //
  //   1. ≤120 s — the parameter-permission leg reaches a DECISION. This is the
  //      J06 observable (WHICH decider answered), so without it the arm has no
  //      observable at all;
  //   2. ≤60 s — the member's own turn finishes its post-allow script
  //      (`C1_A6_MEMBER_DONE`), i.e. the governed calls that follow the allow
  //      have run (the J02/J03 observables);
  //   3. ≤20 s — ONE `control-execution-result` for that leg exists (the
  //      adapter's terminal write is asynchronous by contract). The arm still
  //      asserts the COUNT; the wait only stops the driver from racing it.
  const decisionStartedAt = Date.now()
  const decisionDeadline = decisionStartedAt + 120_000
  let ledger = readControlLedger(CREATE_ROOT_A6)
  let paAskRow = ledger.requests.find((r) => r.actionName === 'parameter-permission') ?? null
  while (Date.now() < decisionDeadline) {
    const decided = paAskRow !== null && ledger.decisions.some((d) => d.requestId === paAskRow.requestId)
    if (decided) break
    await new Promise((resolve) => setTimeout(resolve, 300))
    ledger = readControlLedger(CREATE_ROOT_A6)
    paAskRow = ledger.requests.find((r) => r.actionName === 'parameter-permission') ?? paAskRow
  }
  const legDecided = paAskRow !== null && ledger.decisions.some((d) => d.requestId === paAskRow.requestId)
  const decisionWaitMs = Date.now() - decisionStartedAt
  const memberDoneDeadline = Date.now() + 60_000
  while (Date.now() < memberDoneDeadline) {
    const done = mock.requests.some((r) => JSON.stringify(r.reply ?? '').includes('C1_A6_MEMBER_DONE'))
    if (done) break
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  const executionFactDeadline = Date.now() + 20_000
  let executionFactWaitMs = 0
  while (Date.now() < executionFactDeadline) {
    const row = ledger.requests.find((r) => r.actionName === 'parameter-permission')
    if (row !== undefined && ledger.executionResults.some((e) => e.requestId === row.requestId)) break
    await new Promise((resolve) => setTimeout(resolve, 300))
    ledger = readControlLedger(CREATE_ROOT_A6)
    executionFactWaitMs += 300
  }

  // Read the durable facts whatever happened.
  const facts = readGuardFacts()
  // Every tool RESULT the model was handed, in order: the decisive record for
  // an arm whose observable is a tool refusal (which reader/decider answered,
  // and with which typed code) rather than a durable row.
  writeEvidence('joint-tool-transcript.json', {
    entries: mock.requests.map((request, index) => ({
      request: index,
      results: toolMsgsOf(request).map((message) => contentText(message.content).slice(0, 2000)),
    })).filter((entry) => entry.results.length > 0),
  })
  const state = await p6t6State(Number(new URL(booted.origin).port))
  writeEvidence('joint-ledger.json', ledger)
  writeEvidence('joint-guard-facts.json', { sink: A5SF_CONSULT_SINK, facts })
  writeEvidence('joint-state.json', state.body ?? state)

  // ── J04 first: the native-bash mount is the arm whose failure blocks the
  // rest in the product-intended composition, and it is a FAIL (a refused
  // requirement), not NOT_REACHED (a missing prerequisite).
  // Every `bash` tool call any model request asked for and the tool result the
  // NEXT request already carries (the mock is in-process, so the result is in
  // `mock.requests` by the time the turn settles).
  const bashCalls = mock.requests.flatMap((r) => (r.reply?.toolCalls ?? []).filter((t) => t?.name === 'bash'))
  const bashToolResult = (() => {
    // 0.2.0-rc.2 delivers tool results as `user` + `tool_result` blocks, so the
    // old `"tool"`/`tool_call_id` probe never matched and J04 always fell to its
    // generic branch. Reuse the kit's own predicates; the text is the model's
    // own view of the refusal.
    for (const request of mock.requests) {
      for (const message of messagesOf(request)) {
        if (!isToolResultMessage(message)) continue
        const text = contentText(message.content)
        if (!/team tool guard|no Team Tool Binding/.test(text)) continue
        // Slice from the sentence start: a `[^"]*` match stops at the first
        // quoted tool name ("bash") and truncates the refusal to its prefix.
        const at = text.search(/team tool guard|no Team Tool Binding/)
        return text.slice(at, at + 400).trim()
      }
    }
    return null
  })()
  const nativeMountError = activationRefusal !== null
    ? activationRefusal
    : (refused.find((t) => t.includes('SERVICE_MOUNT_FAILED')) ?? null)
  if (nativeMountError !== null) {
    note('J04', 'FAIL', `the native bash module never mounted: ${nativeMountError}`)
  } else if (bashCalls.length === 0) {
    note('J04', 'NOT_REACHED', `no bash call was issued in this composition; memberLive=${String(memberLive)}`
      + ` (the preset row is ${JOINT_PRESET === 'fs-only' ? 'fs-only: tool-bash dropped' : 'native: tool-bash kept'})`)
  } else if (bashToolResult !== null) {
    note('J04', 'FAIL', `the governed bash was refused before any realm PTY fact: ${bashToolResult}`)
  } else {
    const bashServes = facts.filter((f) => f.method === 'spawn' || f.method === 'bash' || String(f.face ?? '') === 'terminal')
    note('J04', bashServes.length > 0 ? 'PASS' : 'FAIL',
      `bashCalls=${String(bashCalls.length)} realmTerminalFacts=${String(bashServes.length)}`)
  }

  // ── J02 / J03: the governed fs ceiling on the SAME Team.
  const writeAllows = facts.filter((f) => f.decision === 'allow' && String(f.method ?? '').toLowerCase().includes('write'))
  const writeDenies = facts.filter((f) => f.decision === 'deny' && f.decidedBy === 'IO_WRITE_DENIED')
  const insideText = existsSync(FILE_PD42_INSIDE) ? readFileSync(FILE_PD42_INSIDE, 'utf8') : ''
  const outsideExists = existsSync(FILE_PD42_OUTSIDE)
  if (!memberLive) {
    note('J02', 'NOT_REACHED', 'no governed Member turn existed; the ceiling was never consulted')
    note('J03', 'NOT_REACHED', 'no governed Member turn existed; the ceiling was never consulted')
  } else {
    note('J02', insideText.includes(SUM_PD42_INSIDE) && writeAllows.length > 0 ? 'PASS' : 'FAIL',
      `inside=${JSON.stringify(insideText.slice(0, 80))} allowFacts=${String(writeAllows.length)}`)
    note('J03', writeDenies.length > 0 && !outsideExists ? 'PASS' : 'FAIL',
      `writeDenies=${String(writeDenies.length)} outsideExists=${String(outsideExists)}`)
  }

  // ── J05 / J11: the durable approval ledger, if a guarded ask happened.
  const paAsk = ledger.requests.find((r) => r.actionName === 'parameter-permission') ?? null
  if (paAsk === null) {
    note('J05', 'NOT_REACHED', 'no guarded call reached the approval lane in this composition')
    note('J11', 'NOT_REACHED', 'no consumed allow existed to replay')
  } else {
    const cons = ledger.consumptions.filter((c) => c.requestId === paAsk.requestId)
    const exec = ledger.executionResults.filter((e) => e.requestId === paAsk.requestId)
    // The outcome is part of the proposition: "one execution" means one
    // OBSERVED execution of the approved body. A consumed allow whose body was
    // refused at the dispatch door is `failed` — counting the fact without its
    // outcome let a refused execution read as a pass in the 2026-11-12 probe.
    const executedOnce = exec.length === 1 && exec[0]?.outcome === 'succeeded'
    note('J05', cons.length === 1 && executedOnce ? 'PASS' : 'FAIL',
      `request=${paAsk.requestId} consumption=${String(cons.length)} executionResults=${String(exec.length)} outcomes=${exec.map((e) => e.outcome).join(',')} executionFactWaitMs=${String(executionFactWaitMs)}`)
    note('J11', cons.length === 1 ? 'PASS' : 'FAIL', `one-shot consumption facts for ${paAsk.requestId}: ${String(cons.length)}`)
  }

  // ── J06 (F-3): EVALUATE the routed decider on the parameter-permission leg.
  //
  // The proposition (owner brief, 2026-11-11): a bash ask's
  // `parameter-permission` leg reaches the OFFICER — the blueprint's
  // `ordinaryToolApprovals.default` — not the Leader by fallback, and the leg
  // carries the bound-Blueprint identity + verified tool coordinate the Alpha.6
  // route needs. Before the J05/J06 lane this arm could only be RECORDED: the
  // leg carried no identity facts at all, so the only decider it ever named was
  // the Leader (the 2026-11-11 fs-only record). The verdict is now computed.
  //
  // `whenOfficerUnavailable` (hold / leader) is NOT exercised by this
  // composition: it creates a live Officer before the ask. It is pinned by the
  // unit legs (`a6-root-wiring.test.ts` J06 cases: default → Officer, declared
  // Leader exception → Leader, retired Officer → hold); this arm measures the
  // DEFAULT routing on a real Host, which is what the defect was.
  const paDecider = paAsk === null ? null : (ledger.decisions.find((d) => d.requestId === paAsk.requestId)?.decider ?? null)
  const deciderInstanceId = typeof paDecider === 'object' && paDecider !== null
    ? (paDecider.instanceId ?? null)
    : null
  const identityCarried = paAsk !== null
    && typeof paAsk.blueprintContentHash === 'string' && paAsk.blueprintContentHash.length > 0
    && typeof paAsk.operationToolOwner === 'string' && paAsk.operationToolOwner.length > 0
    && typeof paAsk.operationToolName === 'string' && paAsk.operationToolName.length > 0
  // The decider is the OFFICER instance this composition created — never the
  // Leader, never a name the driver guesses.
  const routedToOfficer = officerId !== null && deciderInstanceId === officerId
  const routedToLeader = deciderInstanceId !== null && deciderInstanceId !== officerId
  note('J06', paAsk === null
    ? 'NOT_REACHED'
    : (identityCarried && routedToOfficer ? 'PASS' : 'FAIL'),
    `parameter-permission request=${paAsk.requestId} reviewAuthority=${String(paAsk.reviewAuthority ?? 'none')}`
      + ` blueprintContentHash=${String(paAsk.blueprintContentHash ?? 'none')}`
      + ` operationTool=${String(paAsk.operationToolOwner ?? 'none')}/${String(paAsk.operationToolName ?? 'none')}`
      + ` authorityGeneration=${String(paAsk.authorityGeneration ?? 'none')}`
      + ` decider=${JSON.stringify(paDecider)} officer=${String(officerId ?? 'none')}`
      + ` routedToOfficer=${String(routedToOfficer)} routedAwayFromOfficer=${String(routedToLeader)}`
      + ` identityCarried=${String(identityCarried)}`
      + ` legDecided=${String(legDecided)} decisionWaitMs=${String(decisionWaitMs)}`
      + ` whenOfficerUnavailable=hold(unit-pinned, not exercised here)`
      + ` team-tool-execute leg=${String(ledger.requests.some((r) => r.actionName === 'team-tool-execute'))}`)

  // ═════════════════════════════════════════════════════════════════════════
  // J07–J10 (2026-11-12, this lane): the four arms the v1 driver declared and
  // never drove. ONE Team, ONE v5 document, every verdict computed from durable
  // facts (the control ledger, the goal RPC, the wake-intent directory, the
  // session transcript) — never from a mock claim and never from a constant.
  //
  // ARM ORDER is product-driven, not cosmetic: J09 (Sticky Stop) permanently
  // Stops the Team's review-wake recipient, so it MUST be last; J10 (cold
  // recovery) needs a live Officer to approve the body it crashes inside, so it
  // runs before J09. J07/J08 only need the Team.
  // ═════════════════════════════════════════════════════════════════════════
  const sleepJ = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
  /** Create one goal-worker Member over the production tool route. */
  const createMemberOf = async (templateId, label) => {
    const call = await p6t6Tool(booted.origin, 'team_create_member', {
      rootSessionId: CREATE_ROOT_A6,
      requestToken: `joint-${label}-${RUN_STAMP}`,
      delegationTemplateId: templateId,
      label,
    }, CREATE_ROOT_A6)
    const instanceId = extractInstanceId(JSON.stringify(call?.body?.value ?? call?.body ?? ''))
    let childSessionId = null
    for (let attempt = 0; attempt < 100 && instanceId !== null; attempt += 1) {
      const row = readMemberRows(CREATE_ROOT_A6).find((r) => r.instanceId === instanceId)
      if (typeof row?.childSessionId === 'string') { childSessionId = row.childSessionId; break }
      await sleepJ(100)
    }
    return { label, instanceId, childSessionId, refusal: p6t6ErrorText(call), raw: call?.body ?? call }
  }
  const createGoalMember = async (label) => await createMemberOf('goal-worker', label)
  const relayTo = async (target, body, caller, tag, version = 4) => remoteCall(booted.origin, booted.cookie, 'member.send', {
    teamSessionId: CREATE_ROOT_A6,
    caller,
    recipientInstanceId: target.instanceId,
    body,
    requestToken: `${tag}-${RUN_STAMP}`,
  }, tag, version)

  if (!memberLive) {
    for (const id of ['J07', 'J08', 'J09', 'J10']) {
      note(id, 'NOT_REACHED', 'no governed Member turn existed: a Goal/Stop/cold-recovery arm needs one')
    }
  } else {
    // ── J07: a Goal created from a DIRECT HUMAN input, >=2 rounds, then Stop.
    const g7 = await createGoalMember('g-joint-7')
    const j07 = { member: g7, humanRelay: null, goalBefore: null, goalAfterEdit: null, roundRequests: 0, stop: null, goalAfterStop: null, phaseAfterStop: null, roundsAfterStop: 0 }
    if (g7.instanceId === null || g7.childSessionId === null) {
      note('J07', 'NOT_REACHED', `goal-worker could not be created: ${String(g7.refusal ?? 'no instance id')}`)
    } else {
      // `humanId` is the Team ROOT session id — the same identity the Team
      // surfaces as the direct human; `kind:'human'` is what makes the turn's
      // user/message carry `source.kind='user'` (upstream `hasDirectHumanInput`).
      J07_GATE.armed = true
      J07_GATE.holding = false
      J07_GATE.releasedBy = null
      j07.humanRelay = await relayTo(g7, MK_J07, { kind: 'human', humanId: CREATE_ROOT_A6 }, 'joint-j07-human')
      const humanTurn = await waitForMock(mock, (r) => JSON.stringify(r.body ?? '').includes(MK_J07) && lastUserTextOf(r).includes(MK_J07) && !lastUserTextOf(r).includes('<goal_round>'), 180_000, 'J07 human turn')
      // The goal row is the product's own durable read (not the model's claim).
      const goalDeadline = Date.now() + 120_000
      while (Date.now() < goalDeadline) {
        j07.goalAfterEdit = await goalGet(booted.origin, booted.cookie, g7.childSessionId, 'joint-j07-get')
        if (j07.goalAfterEdit.goal !== null) break
        await sleepJ(500)
      }
      j07.humanTurnSeen = humanTurn !== null
      // Tool RESULTS live on the request that FOLLOWS the call, so the turn's
      // transcript is the LAST request of that turn (the mock records each
      // request on arrival). The first matching request carries no result at
      // all — reading it made the disclosure field empty in the 2026-11-12
      // probe while the durable goal row proved the calls had run.
      const j07Turn = [...mock.requests].reverse().find((r) => lastUserTextOf(r).includes(MK_J07) && !lastUserTextOf(r).includes('<goal_round>')) ?? null

      // >= 2 automatic rounds: each round is ONE model request whose instruction
      // carries `Round: N/M` (the product's own continuation counter).
      const roundText = (r) => `${lastUserTextOf(r)}\n${JSON.stringify(r.body ?? '')}`
      const roundsDeadline = Date.now() + 180_000
      while (Date.now() < roundsDeadline) {
        j07.roundRequests = mock.requests.filter((r) => roundText(r).includes('<goal_round>') && roundText(r).includes(MK_J07)).length
        if (j07.roundRequests >= 2) break
        await sleepJ(500)
      }
      j07.roundsAtStop = j07.roundRequests
      // Wait until the second round's reply is actually HELD, so the Stop is
      // issued against an in-flight round (never against an already-exhausted
      // goal) and the durable counter at the Stop is the one this arm reports.
      const holdDeadline = Date.now() + 30_000
      while (Date.now() < holdDeadline && !J07_GATE.holding) await sleepJ(100)
      j07.gateHeld = J07_GATE.holding
      // The human Stop: the production `session/cancel` channel on the Member's
      // own session. A goal rounds driver pause is the documented settlement.
      j07.stop = await apiCancel(booted.origin, booted.cookie, g7.childSessionId, 'joint-j07-stop')
      J07_GATE.armed = false
      if (J07_GATE.holding) J07_GATE.release?.()
      j07.gate = { holding: j07.gateHeld, releasedBy: J07_GATE.releasedBy }
      const stopDeadline = Date.now() + 90_000
      while (Date.now() < stopDeadline) {
        const current = await goalGet(booted.origin, booted.cookie, g7.childSessionId, 'joint-j07-get2')
        j07.goalAfterStop = current.goal
        j07.phaseAfterStop = current.goal?.phase ?? null
        if (j07.phaseAfterStop === 'paused') break
        await sleepJ(500)
      }
      // A silent window: a continued round after the Stop would falsify it. The
      // COUNT is the product's durable `roundsStarted`, not the mock's request
      // list: a mock request can be recorded a few ms BEFORE the Stop lands and
      // be counted after it (the probe run measured exactly that), which would
      // have graded the driver's timing instead of the product's continuation.
      await sleepJ(12_000)
      const afterWindow = await goalGet(booted.origin, booted.cookie, g7.childSessionId, 'joint-j07-get3')
      j07.goalAfterWindow = afterWindow.goal
      j07.roundsAfterStop = mock.requests.filter((r) => roundText(r).includes('<goal_round>') && roundText(r).includes(MK_J07)).length
      j07.roundsStartedAtStop = Number(j07.goalAfterStop?.roundsStarted ?? 0)
      j07.roundsStartedAfterWindow = Number(afterWindow.goal?.roundsStarted ?? 0)
      j07.phaseAfterWindow = afterWindow.goal?.phase ?? null
      j07.roundTrace = J07_ROUND_TRACE.slice()
      writeEvidence('joint-j07-round-trace.json', { rounds: j07.roundTrace })
      const createRefused = j07Turn === null ? null : toolMsgsOf(j07Turn).map((m) => contentText(m?.content)).find((t) => t.includes('GOAL_TOOL_')) ?? null
      const goalToolResults = j07Turn === null ? [] : toolMsgsOf(j07Turn).map((m) => contentText(m?.content).slice(0, 400))
      const goalVisible = j07.goalAfterEdit.goal !== null
        && String(j07.goalAfterEdit.goal?.objective ?? '').includes('edited')
        && Number(j07.goalAfterEdit.goal?.revision ?? 0) >= 2
      const stopOk = j07.stop.status === 200 && j07.stop.body?.result?.ok === true
      const settled = j07.phaseAfterStop === 'paused' && j07.phaseAfterWindow === 'paused'
      const roundsEnough = j07.roundsStartedAtStop >= 2
      const noContinuation = j07.roundsStartedAfterWindow === j07.roundsStartedAtStop
      note('J07', createRefused === null && goalVisible && stopOk && settled && roundsEnough && noContinuation ? 'PASS' : 'FAIL',
        `member=${String(g7.instanceId)} relay=${String(j07.humanRelay.status)}${j07.humanRelay.body?.result?.ok === true ? '/ok' : ''}`
          + ` goal=${JSON.stringify(j07.goalAfterEdit.goal === null ? null : { id: j07.goalAfterEdit.goal.id, revision: j07.goalAfterEdit.goal.revision, phase: j07.goalAfterEdit.goal.phase, objective: String(j07.goalAfterEdit.goal.objective ?? '').slice(0, 60) })}`
          + ` roundsStarted=${String(j07.roundsStartedAtStop)}->${String(j07.roundsStartedAfterWindow)} (mockRoundRequests=${String(j07.roundsAtStop)}->${String(j07.roundsAfterStop)})`
          + ` stopLandedMidRound=${String(j07.gateHeld)} holdReleasedBy=${String(j07.gate?.releasedBy)}`
          + ` stop=${String(j07.stop.status)} phase=${String(j07.phaseAfterStop)}->${String(j07.phaseAfterWindow)}`
          + ` toolResults=${JSON.stringify(goalToolResults)}`)
      writeEvidence('joint-j07-goal.json', j07)
    }

    // ── J08: a relayed/non-user Goal call is REFUSED; the same turn's governed
    // bash still runs (the refusal is scoped to the goal operation).
    const g8 = await createGoalMember('g-joint-8')
    const j08 = { member: g8, machineRelay: null, refusalText: null, bashText: null, goal: null, ledgerBefore: readControlLedger(CREATE_ROOT_A6) }
    if (g8.instanceId === null || g8.childSessionId === null) {
      note('J08', 'NOT_REACHED', `goal-worker could not be created: ${String(g8.refusal ?? 'no instance id')}`)
    } else {
      // The MACHINE caller: the Leader instance, the production relay surface.
      const leaderRow = readMemberRows(CREATE_ROOT_A6).find((r) => r.templateId === 'leader')
      const leaderInstance = leaderRow?.instanceId ?? 'instance-c1-a6-leader'
      j08.machineRelay = await relayTo(g8, MK_J08, { kind: 'instance', instanceId: String(leaderInstance) }, 'joint-j08-machine')
      const firstResult = await waitForMock(mock, (r) => lastUserTextOf(r).includes(MK_J08) && toolMsgsOf(r).length >= 1, 180_000, 'J08 relay turn result')
      j08.turnSeen = firstResult !== null
      await sleepJ(6000)
      const turn = [...mock.requests].reverse().find((r) => lastUserTextOf(r).includes(MK_J08)) ?? null
      const texts = turn === null ? [] : toolMsgsOf(turn).map((m) => contentText(m?.content))
      j08.texts = texts.map((t) => t.slice(0, 300))
      // `reject()` throws HarnessError(message, 'GOAL_TOOL_AUTHORITY_REQUIRED'):
      // the CODE is a structured field of the tool result, the SENTENCE is what
      // the model reads. Accept either form — never `GOAL_TOOL_DRIVER_REQUIRED`,
      // which would mean the calling turn was not live at all — and record which
      // form was observed so the evidence does not overclaim.
      j08.refusalText = texts.find((t) => t.includes('GOAL_TOOL_AUTHORITY_REQUIRED')) ?? null
      const refusalSentence = texts.find((t) => t.includes('requires a direct human turn on a top-level agent')) ?? null
      j08.refusalForm = j08.refusalText !== null ? 'code' : refusalSentence !== null ? 'sentence' : 'absent'
      j08.refusalObserved = (j08.refusalText ?? refusalSentence ?? '').slice(0, 300)
      j08.bashText = texts.find((t) => t.includes('C1_J08_BASH_OK')) ?? null
      j08.bashFile = existsSync(FILE_J08) ? readFileSync(FILE_J08, 'utf8') : null
      const goalDeadline = Date.now() + 60_000
      while (Date.now() < goalDeadline) {
        const current = await goalGet(booted.origin, booted.cookie, g8.childSessionId, 'joint-j08-get')
        j08.goal = current.goal
        if (j08.goal !== null) break
        await sleepJ(500)
      }
      const ledgerAfter = readControlLedger(CREATE_ROOT_A6)
      j08.askLegs = ledgerAfter.requests.length - j08.ledgerBefore.requests.length
      const typedRefusal = j08.refusalForm !== 'absent'
      const noGoal = j08.goal === null
      // The ARM's proposition is the typed refusal + no Goal row. Whether the
      // same turn's governed bash still runs is a SEPARATE product property
      // (J04/J05 own the shell lane), so it is measured and disclosed here
      // rather than folded into this verdict: on 2026-11-12 the shell lane is
      // refused at the dispatch door for an unrelated #730 defect, and making
      // the relay-refusal arm depend on it would report two findings as one.
      const bashRan = j08.bashText !== null && j08.bashFile === SUM_J08
      note('J08', typedRefusal && noGoal ? 'PASS' : 'FAIL',
        `member=${String(g8.instanceId)} relay=${String(j08.machineRelay.status)} caller=instance/${String(leaderInstance)}`
          + ` refusal=${typedRefusal ? 'GOAL_TOOL_AUTHORITY_REQUIRED(' + j08.refusalForm + ')' : 'ABSENT'}`
          + ` refusalObserved=${JSON.stringify(String(j08.refusalObserved).slice(0, 200))}`
          + ` goal=${JSON.stringify(j08.goal === null ? null : { id: j08.goal.id, revision: j08.goal.revision })}`
          + ` governedBashStillRuns=${String(bashRan)} (disclosure; the shell lane is J04/J05's clause)`
          + ` file=${JSON.stringify(j08.bashFile)} askLegsMinted=${String(j08.askLegs)}`)
      writeEvidence('joint-j08-relay.json', j08)
    }

    // ── J10: SIGKILL mid-body, cold boot on the SAME DSH_HOME. This is the
    // crash-window settlement arm: no duplicate execution, no replayed
    // consumed allow, and the settlement is `unknown` (never `succeeded`).
    const g10 = await createGoalMember('g-joint-10')
    const j10 = { member: g10, relay: null, before: null, after: null, restartOk: false, booted: null, mockRequestsAtKill: 0, mockRequestsAfterRestart: 0 }
    if (g10.instanceId === null || g10.childSessionId === null) {
      note('J10', 'NOT_REACHED', `crash worker could not be created: ${String(g10.refusal ?? 'no instance id')}`)
    } else if ((verdicts.get('J04')?.verdict ?? '') === 'FAIL' && /team tool guard|no Team Tool Binding/.test(verdicts.get('J04')?.detail ?? '')) {
      // The crash window must open INSIDE a running body: a SIGKILL before the
      // body starts would measure the request lane, not the settlement lane.
      // When the dispatch door refuses the governed shell (J04's clause), no
      // body can ever start, so the arm is measured as undrivable — with the
      // measured refusal as the reason, never as a fabricated FAIL or PASS.
      note('J10', 'NOT_REACHED', `no governed bash body can start in this composition (J04 refuses every shell call at the dispatch door: ${String(verdicts.get('J04')?.detail ?? '').slice(0, 240)}) — the crash window must open inside a running body, and a crash before it would measure the request lane instead`)
    } else {
      j10.relay = await relayTo(g10, MK_J10, { kind: 'human', humanId: CREATE_ROOT_A6 }, 'joint-j10-human')
      const bodyDeadline = Date.now() + 240_000
      let ppLeg = null
      let paLeg = null
      while (Date.now() < bodyDeadline) {
        const current = readControlLedger(CREATE_ROOT_A6)
        const asks = current.requests.filter((r) => r.actionName === 'parameter-permission')
        ppLeg = asks.at(-1) ?? null
        const pa = current.requests.filter((r) => r.actionName === 'team-tool-execute').at(-1) ?? null
        const paConsumed = pa !== null && current.consumptions.some((c) => c.requestId === pa.requestId)
        if (ppLeg !== null && paConsumed && existsSync(FILE_J10_START)) { paLeg = pa; break }
        await sleepJ(250)
      }
      await sleepJ(1500)
      const atKill = readControlLedger(CREATE_ROOT_A6)
      j10.before = {
        pp: ppLeg?.requestId ?? null,
        pa: paLeg?.requestId ?? null,
        ppConsumed: ppLeg === null ? 0 : atKill.consumptions.filter((c) => c.requestId === ppLeg.requestId).length,
        paConsumed: paLeg === null ? 0 : atKill.consumptions.filter((c) => c.requestId === paLeg.requestId).length,
        ppFacts: ppLeg === null ? 0 : atKill.executionResults.filter((e) => e.requestId === ppLeg.requestId).length,
        paFacts: paLeg === null ? 0 : atKill.executionResults.filter((e) => e.requestId === paLeg.requestId).length,
        bodyStarted: existsSync(FILE_J10_START) ? readFileSync(FILE_J10_START, 'utf8') : null,
        requests: atKill.requests.length,
      }
      j10.mockRequestsAtKill = mock.requests.filter((r) => JSON.stringify(r.body ?? '').includes(MK_J10)).length
      if (paLeg === null || j10.before.bodyStarted === null) {
        note('J10', 'NOT_REACHED', `the crash window never opened: pa=${String(j10.before.pa)} bodyStarted=${JSON.stringify(j10.before.bodyStarted)} — `
          + `relay=${String(j10.relay.status)}; a crash inside an unstarted body would measure the request lane, not the settlement lane`)
      } else {
        // SIGKILL: the in-process observer cannot write its terminal fact.
        host.child.kill('SIGKILL')
        const deadDeadline = Date.now() + 30_000
        while (host.alive() && Date.now() < deadDeadline) await sleepJ(50)
        const exited = !host.alive()
        // Cold boot #2 on the SAME DSH_HOME (the documented recovery surface).
        try {
          const offset = statSync(booted.instanceLog).size
          const patchPath = join(HOME, 'profiles', 'web', 'cordis.patch.yml')
          const patchText = readFileSync(patchPath, 'utf8')
          if (!patchText.includes('bootPhase: "create-or-open"')) {
            writeFileSync(patchPath, patchText.replace('bootPhase: "create"', 'bootPhase: "create-or-open"'))
          }
          const h2 = spawnHost({ port: booted.port, home: HOME, logPath: booted.instanceLog, mockPort: mock.port })
          let parsed = null
          const bootDeadline = Date.now() + 180_000
          while (Date.now() < bootDeadline && h2.alive()) {
            const text = readFileSync(booted.instanceLog, 'utf8').slice(offset)
            const matches = [...text.matchAll(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/g)]
            if (matches.length > 0) { parsed = matches.at(-1); break }
            await sleepJ(200)
          }
          if (parsed === null) throw new Error('no restart boot URL')
          const origin2 = `http://127.0.0.1:${parsed[1]}`
          let cookie2 = null
          for (let attempt = 0; attempt < 120; attempt += 1) {
            try { cookie2 = await authenticate(origin2, parsed[2]); break } catch { await sleepJ(500) }
          }
          if (cookie2 === null) throw new Error('restart auth failed')
          j10.booted = { origin: origin2, cookie: cookie2, host: h2 }
          j10.restartOk = true
        } catch (error) {
          j10.restartError = String(error?.message ?? error)
        }
        // Give boot recovery its bounded settlement window before reading.
        await sleepJ(j10.restartOk ? 8000 : 0)
        const after = readControlLedger(CREATE_ROOT_A6)
        j10.after = {
          ppConsumed: after.consumptions.filter((c) => c.requestId === j10.before.pp).length,
          paConsumed: after.consumptions.filter((c) => c.requestId === j10.before.pa).length,
          ppFacts: after.executionResults.filter((e) => e.requestId === j10.before.pp),
          paFacts: after.executionResults.filter((e) => e.requestId === j10.before.pa),
          abandonments: after.abandonments.filter((a) => a.requestId === j10.before.pp || a.requestId === j10.before.pa),
          requests: after.requests.length,
        }
        j10.mockRequestsAfterRestart = mock.requests.filter((r) => JSON.stringify(r.body ?? '').includes(MK_J10)).length
        // Team + Member durable rows survive a cold boot (the recovery context).
        const rowsAfter = readMemberRows(CREATE_ROOT_A6)
        j10.membersAfterRestart = rowsAfter.length
        j10.memberSurvived = rowsAfter.some((r) => r.instanceId === g10.instanceId)
        j10.officerSurvived = rowsAfter.some((r) => r.templateId === 'officer')
        j10.bodyStartAfter = existsSync(FILE_J10_START) ? readFileSync(FILE_J10_START, 'utf8') : null
        // Clause set (each one a distinct product promise):
        const noDuplicate = j10.after.paConsumed === 1 && j10.after.ppConsumed === 1
          && j10.after.paFacts.length <= 1 && j10.after.ppFacts.length <= 1
        const noReplay = j10.mockRequestsAfterRestart === j10.mockRequestsAtKill
        const execSettledUnknown = j10.after.paFacts.length === 1 && j10.after.paFacts[0].outcome === 'unknown'
        // "not silently absent": EVERY allow consumed in the crash window owes a
        // settlement fact. The permission lane (the party that consumed the ask)
        // is included on purpose — see the product-defect report if it is not.
        const noSilentAbsence = j10.after.paFacts.length === 1 && j10.after.ppFacts.length === 1
        const durableSurvived = j10.restartOk && j10.memberSurvived === true && j10.officerSurvived === true
        note('J10', exited && durableSurvived && noDuplicate && noReplay && execSettledUnknown && noSilentAbsence ? 'PASS' : 'FAIL',
          `exited=${String(exited)} restart=${j10.restartOk ? 'ok' : String(j10.restartError ?? 'no')}`
            + ` legs=pp:${String(j10.before.pp)}/pa:${String(j10.before.pa)}`
            + ` consumed=${String(j10.before.ppConsumed)}/${String(j10.before.paConsumed)}->${String(j10.after.ppConsumed)}/${String(j10.after.paConsumed)}`
            + ` facts=pa:${String(j10.after.paFacts.length)}x${j10.after.paFacts.map((f) => f.outcome).join(',')}`
            + ` pp:${String(j10.after.ppFacts.length)}x${j10.after.ppFacts.map((f) => f.outcome).join(',')}`
            + ` abandonments=${j10.after.abandonments.map((a) => a.reason).join(',')}`
            + ` mockRequests=${String(j10.mockRequestsAtKill)}->${String(j10.mockRequestsAfterRestart)}`
            + ` members=${String(j10.membersAfterRestart)} memberSurvived=${String(j10.memberSurvived)} officerSurvived=${String(j10.officerSurvived)}`
            + ` bodyStart=${JSON.stringify(j10.bodyStartAfter)}`)
        writeEvidence('joint-j10-crash.json', j10)
        // Later arms use the RESTARTED Host (same DSH_HOME, same port).
        if (j10.booted !== null) {
          booted.origin = j10.booted.origin
          booted.cookie = j10.booted.cookie
          host = j10.booted.host
          LIVE_HOST_AFTER_RESTART = j10.booted.host
        }
      }
    }

    // ── J09: the Sticky Stop survives an Alpha.6 review wake. Runs LAST: the
    // Stop is permanent for the reviewer it is scoped to, and every later ask
    // routed to that reviewer must stay suppressed.
    // The ask that mints the review wake must be a GOVERNED ask, so this arm
    // uses the strict `worker` template (J05 measures its parameter-permission
    // leg). A template with no `permissions` policy (the goal worker) is
    // allow-by-default and mints no ask at all — measured on 2026-11-12 as
    // `askLegsMinted=0` in the J08 relay turn, which is why the first J09
    // attempt waited for a wake that could never exist.
    const workerRows = readMemberRows(CREATE_ROOT_A6).filter((r) => r.templateId === 'worker' && typeof r.childSessionId === 'string')
    const g9 = workerRows[0] ?? { instanceId: null, childSessionId: null }
    // The SECOND ask must come from a DIFFERENT member: the first ask leaves
    // its member's turn open on the now-Stopped approval, so a second message
    // to that member queues behind the open turn and never reaches the model
    // (measured 2026-11-12: relay delivered, zero new mock requests). A fresh
    // worker is idle and raises the same governed ask.
    const g9b = g9.instanceId === null ? { instanceId: null, childSessionId: null } : await createMemberOf('worker', 'g-joint-9b')
    const j09 = { first: { instanceId: g9.instanceId, templateId: 'worker' }, second: { instanceId: g9b.instanceId, templateId: 'worker' }, firstRelay: null, secondRelay: null, wakeSeen: 0, cancel: null, markers: [], markersAfterSecondAsk: [], wakesBefore: 0, wakesAfter: 0, markerBytesStable: false, secondAskLegs: 0, gate: null }
    const officerRow = readMemberRows(CREATE_ROOT_A6).find((r) => r.templateId === 'officer' && typeof r.childSessionId === 'string')
    if (g9.instanceId === null || g9b.instanceId === null || officerRow?.childSessionId === undefined) {
      note('J09', 'NOT_REACHED', `prerequisites missing: g9=${String(g9.instanceId)} g9b=${String(g9b.instanceId)} officerSession=${String(officerRow?.childSessionId ?? 'none')}`)
    } else {
      const markerDir = join(HOME, 'alpha6-wake-intents')
      const stoppedMarkers = () => (existsSync(markerDir) ? readdirSync(markerDir) : []).filter((n) => n.startsWith('stopped-') && n.endsWith('.json'))
      const wakeCount = () => mock.requests.filter((r) => lastUserTextOf(r).startsWith('[team-review-wake')).length
      // The FIRST ask mints a review leg; the mock holds its wake turn open so
      // the Stop lands while the wake coordinator (the latch) is LIVE.
      j09.wakesBefore = wakeCount()
      // Arm the hold, then send the FIRST ask: the next wake is J09's, and the
      // mock holds its turn open until the Stop below has landed.
      const wakeFloor = mock.requests.length
      J09_GATE.armed = true
      j09.firstRelay = await relayTo(g9, MK_J09, { kind: 'human', humanId: CREATE_ROOT_A6 }, 'joint-j09-first')
      const wakeReq = await waitForMock(mock, (r) => lastUserTextOf(r).startsWith('[team-review-wake') && mock.requests.indexOf(r) >= wakeFloor, 180_000, 'J09 wake')
      j09.wakeSeen = wakeReq === null ? 0 : wakeCount()
      const ledgerBeforeSecond = readControlLedger(CREATE_ROOT_A6)
      // The human Stop on the review-wake RECIPIENT (the Team's approval lane).
      // This is the production Stop button, never a direct function call.
      j09.cancel = await apiCancel(booted.origin, booted.cookie, officerRow.childSessionId, 'joint-j09-stop')
      const markerDeadline = Date.now() + 60_000
      while (Date.now() < markerDeadline) {
        j09.markers = stoppedMarkers()
        if (j09.markers.length > 0) break
        await sleepJ(500)
      }
      const markerBytes = j09.markers.length === 0 ? null : readFileSync(join(markerDir, j09.markers[0]), 'utf8')
      // Disarm only now: any decide of the held wake that was still in flight
      // must see the hold, and the Stop already landed.
      J09_GATE.armed = false
      if (J09_GATE.holding) J09_GATE.release?.()
      j09.gate = { holding: J09_GATE.holding, releasedBy: J09_GATE.releasedBy }
      await sleepJ(3000)
      // The SECOND ask: a real governed ask for the SAME (now Stopped) reviewer.
      j09.secondRelay = await relayTo(g9b, MK_J09B, { kind: 'human', humanId: CREATE_ROOT_A6 }, 'joint-j09-second')
      const suppressDeadline = Date.now() + 60_000
      while (Date.now() < suppressDeadline) {
        j09.wakesAfter = wakeCount()
        j09.markersAfterSecondAsk = stoppedMarkers()
        const ledgerAfter = readControlLedger(CREATE_ROOT_A6)
        j09.secondAskLegs = ledgerAfter.requests.length - ledgerBeforeSecond.requests.length
        if (j09.secondAskLegs > 0 && Date.now() > suppressDeadline - 45_000) break
        await sleepJ(500)
      }
      const markerAfterBytes = j09.markersAfterSecondAsk.length === 0
        ? null
        : readFileSync(join(markerDir, j09.markersAfterSecondAsk[0]), 'utf8')
      j09.markerBytesStable = markerBytes !== null && markerBytes === markerAfterBytes
      const cancelOk = j09.cancel.status === 200 && j09.cancel.body?.result?.ok === true
      const markerOk = j09.markers.length === 1 && markerBytes !== null && /"stopped"\s*:\s*true/.test(markerBytes)
      const suppressed = j09.wakesAfter === j09.wakeSeen && j09.markersAfterSecondAsk.length === 1 && j09.markerBytesStable
      // The second ask must be REAL: the member's turn must have issued the
      // governed bash call. Without this the "no new wake" clause would also
      // pass for an ask that was never raised (a vacuous measurement).
      const askIsReal = mock.requests.some((r) => lastUserTextOf(r).includes(MK_J09B)
        && (r.reply?.toolCalls ?? []).some((t) => t?.name === 'bash'))
      note('J09', cancelOk && markerOk && suppressed && askIsReal ? 'PASS' : 'FAIL',
        `wakeSeen=${String(j09.wakeSeen)} firstRelay=${String(j09.firstRelay.status)} cancel=${String(j09.cancel.status)}`
          + ` markers=${JSON.stringify(j09.markers)} bytes=${JSON.stringify(String(markerBytes ?? '').slice(0, 200))}`
          + ` wakes=${String(j09.wakeSeen)}->${String(j09.wakesAfter)} markerStable=${String(j09.markerBytesStable)}`
          + ` secondAskLegs=${String(j09.secondAskLegs)} askIsReal=${String(askIsReal)} secondRelay=${String(j09.secondRelay.status)}`
          + ` holdReleasedBy=${String(j09.gate.releasedBy)}`)
      writeEvidence('joint-j09-sticky-stop.json', j09)
    }
  }

  await finishJoint({ verdicts })
  return ['PASS'].includes(verdicts.get('J01')?.verdict) && ![...verdicts.values()].some((v) => v.verdict === 'FAIL')
}

/** Persist the per-arm table and the two-run agreement fact. */
async function finishJoint({ verdicts }) {
  const arms = JOINT_ARMS.map(([id, proposition]) => verdicts.get(id) ?? { arm: id, proposition, verdict: 'NOT_REACHED', detail: 'not evaluated' })
  const counts = {}
  for (const row of arms) counts[row.verdict] = (counts[row.verdict] ?? 0) + 1
  const document = {
    schema: 'joint-acceptance/1',
    recordClass: 'DEV-LIVE',
    composition: {
      preset: JOINT_PRESET,
      blueprint: 'schemaVersion: 5, memberIoCeilings + reviewRouting',
      planeTakeover: true,
      alpha6ReviewRouting: true,
      governedRealm: true,
    },
    counts,
    arms,
    osLevelNetworkIsolationClaimed: false,
    note: 'DEV-LIVE: this record can never produce a V@B=yes or any frozen-candidate claim.',
  }
  writeEvidence('joint-verdicts.json', document)
  writeEvidence('joint-arms.md', [
    '| arm | verdict | proposition | measured detail |',
    '|---|---|---|---|',
    ...arms.map((r) => `| ${r.arm} | **${r.verdict}** | ${String(r.proposition).replaceAll('|', '/')} | ${String(r.detail).replaceAll('|', '/').slice(0, 400)} |`),
  ].join('\n'))
}

/**
 * Real-Host A6 acceptance: a Member bash ask is routed to the live Officer,
 * the Officer resolves it through the production tools, and the approved call
 * executes through the plane takeover. The ledger is captured verbatim so a
 * second (plane PA) approval leg is visible rather than inferred.
 */
async function runAlpha6OfficerScenario({ booted, mock, denyList, host }) {
  log('── A6-OFFICER: Member ask -> Officer wake -> allow -> plane execute ──')
  writeFileSync(join(BLUEPRINT_DIR, 'c1-a6.yaml'), savedBlueprintA6Yaml(denyList))
  const create = await remoteCall(booted.origin, booted.cookie, 'team.create', {
    rootSessionId: CREATE_ROOT_A6,
    blueprintId: BP_A6_ID,
    initialWork: { prompt: MK_A6 },
  }, 'c1a6')
  const createOk = create.status === 200 && create.body?.result?.ok === true
  check('A6-1', 'v5 team.create admits the Officer + routing on the real Host', createOk,
    `status=${create.status} body=${JSON.stringify(create.body ?? create).slice(0, 700)}`)
  if (!createOk) {
    writeEvidence('a6-create-fail.json', create.body ?? create)
    return false
  }
  {
    // INSTRUMENT FIX (2026-11-11, review finding on PR #710). This used to
    // read `git -C process.cwd() rev-parse HEAD`, i.e. the kit PROCESS's
    // cwd — the repo root or main checkout — while `--worktree` selects the
    // tree that is actually booted. The A6 boot manifests therefore recorded
    // the BASE tree's sha (1964cb71c/master) instead of the PR head. Read the
    // WORKTREE that `--worktree` named; that is the build which was loaded.
    const sha = spawnSync('git', ['-C', WORKTREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' })
    const blueprintHash = create.body?.result?.value?.data?.durable?.teamSession?.blueprint?.contentHash ?? null
    writeEvidence('run-manifest.json', {
      runId: RUN_STAMP,
      productSha: sha.status === 0 ? sha.stdout.trim() : null,
      productTree: WORKTREE,
      hostVersion: DSH_BASELINE_VERSION,
      hostBaselineSha: HOST_BASELINE_SHA,
      blueprintHash,
      rootSessionId: CREATE_ROOT_A6,
      optIn: {
        alpha6Officer: ALPHA6_OFFICER,
        planeTakeover: PLANE_TAKEOVER,
        stickyStop: A6_STICKY_STOP,
        inboxReconcile: A6_INBOX,
        timeoutMs: A6_TIMEOUT_MS,
      },
    })
  }

  if (A6_INBOX) {
    // Native-Inbox reconciliation: the wake turn is held open (30 s mock think
    // time) AFTER the native Inbox CLAIMED the wake; SIGKILL the Host and
    // restart. Boot recovery must discard the consumed intent without a
    // duplicate, while the durable pending Control row survives.
    const markerDir = join(HOME, 'alpha6-wake-intents')
    const intentDeadline = Date.now() + 120_000
    let wakeRows = []
    let wakesBefore = 0
    while (Date.now() < intentDeadline) {
      wakeRows = existsSync(markerDir)
        ? readdirSync(markerDir).filter((name) => name.startsWith('wake-') && name.endsWith('.json'))
        : []
      wakesBefore = wakeStartCount(mock.requests)
      if (wakeRows.length > 0 && wakesBefore > 0) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    const busySeen = mock.requests.some((r) => lastUserTextOf(r).includes('C1_A6_BUSY'))
    const intentBefore = wakeRows.length === 0
      ? null
      : JSON.parse(readFileSync(join(markerDir, wakeRows[0]), 'utf8'))
    const pendingBefore = readControlLedger(CREATE_ROOT_A6).requests.filter(
      (r) => !readControlLedger(CREATE_ROOT_A6).decisions.some((d) => d.requestId === r.requestId),
    ).map((r) => r.requestId)
    const requestsAtRestart = mock.requests.length
    const wakeTraceBefore = mock.requests.map((r, index) => {
      const wakeId = /^\[team-review-wake wakeId=([^\]]+)\]/.exec(lastUserTextOf(r))?.[1] ?? null
      return wakeId === null ? null : { index, wakeId, messageCount: r.body?.messages?.length ?? null }
    }).filter((row) => row !== null)
    let restartError = null
    let wakesAfterRestart = wakesBefore
    let rowsAfterRestart = wakeRows
    let wakesAfterDrain = wakesBefore
    let rowsAfterDrain = wakeRows
    try {
      const offset = statSync(booted.instanceLog).size
      const patchPath = join(HOME, 'profiles', 'web', 'cordis.patch.yml')
      const patchText = readFileSync(patchPath, 'utf8')
      if (!patchText.includes('bootPhase: "create-or-open"')) {
        writeFileSync(patchPath, patchText.replace('bootPhase: "create"', 'bootPhase: "create-or-open"'))
      }
      host.child.kill('SIGKILL')
      const exitDeadline = Date.now() + 20_000
      while (host.alive() && Date.now() < exitDeadline) await new Promise((resolve) => setTimeout(resolve, 50))
      const h2 = spawnHost({ port: booted.port, home: HOME, logPath: booted.instanceLog, mockPort: mock.port })
      const bootDeadline = Date.now() + 120_000
      while (Date.now() < bootDeadline && h2.alive()) {
        const text = readFileSync(booted.instanceLog, 'utf8').slice(offset)
        if (/http:\/\/127\.0\.0\.1:\d+\/\?token=/.test(text)) break
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      await new Promise((resolve) => setTimeout(resolve, 8000))
      rowsAfterRestart = existsSync(markerDir)
        ? readdirSync(markerDir).filter((name) => name.startsWith('wake-') && name.endsWith('.json'))
        : []
      wakesAfterRestart = wakeStartCount(mock.requests)
      const bootText = readFileSync(booted.instanceLog, 'utf8').slice(offset)
      const bootUrl = [...bootText.matchAll(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/g)].at(-1)
      if (bootUrl === undefined) throw new Error('no boot URL after inbox crash')
      const origin2 = `http://127.0.0.1:${bootUrl[1]}`
      let cookie2 = null
      for (let attempt = 0; attempt < 60; attempt += 1) {
        try { cookie2 = await authenticate(origin2, bootUrl[2]); break } catch { await new Promise((resolve) => setTimeout(resolve, 500)) }
      }
      if (cookie2 === null) throw new Error('restart auth failed for inbox crash')
      // Boot recovery must reconcile the crashed claim from the durable
      // ledger: one replacement wake, never a duplicate of the consumed one.
      const replacementDeadline = Date.now() + 90_000
      while (Date.now() < replacementDeadline) {
        wakesAfterDrain = wakeStartCount(mock.requests)
        if (wakesAfterDrain > wakesAfterRestart) break
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      rowsAfterDrain = existsSync(markerDir)
        ? readdirSync(markerDir).filter((name) => name.startsWith('wake-') && name.endsWith('.json'))
        : []
      if (h2.alive()) h2.child.kill('SIGKILL')
    } catch (error) {
      restartError = String(error?.message ?? error)
    }
    const ledgerAfter = readControlLedger(CREATE_ROOT_A6)
    const pendingAfter = ledgerAfter.requests.filter(
      (r) => !ledgerAfter.decisions.some((d) => d.requestId === r.requestId),
    )
    // LIVENESS: the crashed claim must be replaced by exactly ONE NEW wake
    // (distinct wakeId) at recovery, never the old one redelivered; the
    // durable request must be either still pending or durably decided (the
    // replacement wake may legitimately resolve it). `wakes*` = distinct ids.
    const decidedAfter = new Set(ledgerAfter.decisions.map((d) => d.requestId))
    const inboxOk = restartError === null && intentBefore !== null
      && rowsAfterRestart.length <= 1
      && wakesAfterRestart === wakesBefore + 1
      && wakesAfterDrain <= wakesAfterRestart
      && pendingBefore.length > 0
      && pendingBefore.every((id) => decidedAfter.has(id) || pendingAfter.some((r) => r.requestId === id))
    check('A6-25', 'a wake claimed by a crashed turn is replaced by exactly one new wake; its durable request is preserved or decided', inboxOk,
      `intent=${intentBefore === null ? 'none' : intentBefore.wakeId} pendingBefore=${pendingBefore.length} rows=${wakeRows.length}->${rowsAfterRestart.length}->${rowsAfterDrain.length} wakes=${wakesBefore}->${wakesAfterRestart}->${wakesAfterDrain} pending=${pendingAfter.length} restart=${restartError ?? 'ok'}`)
    const wakeTraceAfter = mock.requests.map((r, index) => {
      const wakeId = /^\[team-review-wake wakeId=([^\]]+)\]/.exec(lastUserTextOf(r))?.[1] ?? null
      return wakeId === null ? null : { index, wakeId, messageCount: r.body?.messages?.length ?? null, lastRole: r.body?.messages?.at(-1)?.role ?? null }
    }).filter((row) => row !== null)
    writeEvidence('a6-inbox-reconcile.json', {
      busySeen,
      requestsAtRestart,
      wakeTraceBefore,
      wakeTraceAfter,
      wakesBefore,
      wakesAfterRestart,
      wakesAfterDrain,
      intentBefore,
      rowsAfterRestart,
      rowsAfterDrain,
      pendingBefore,
      restartError,
      mockRequests: mock.requests.length,
    })
    return inboxOk
  }

  if (A6_STICKY_STOP) {
    const deadline = Date.now() + Number(process.env['C1_A6_WAIT_MS'] ?? 300_000)
    let wakeSeen = 0
    while (Date.now() < deadline) {
      wakeSeen = mock.requests.filter((r) => lastUserTextOf(r).startsWith('[team-review-wake')).length
      if (wakeSeen > 0) break
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
    const officer = readMemberRows(CREATE_ROOT_A6).find((row) => row.templateId === 'officer')
    const cancel = officer === undefined
      ? { status: 0, body: { error: 'no officer child session' } }
      : await apiCancel(booted.origin, booted.cookie, officer.childSessionId, 'c1a6sticky')
    await new Promise((resolve) => setTimeout(resolve, 3000))
    const markerDir = join(HOME, 'alpha6-wake-intents')
    const rows = existsSync(markerDir) ? readdirSync(markerDir) : []
    const stoppedRows = rows.filter((name) => name.startsWith('stopped-') && name.endsWith('.json'))
    const wakeRows = rows.filter((name) => name.startsWith('wake-') && name.endsWith('.json'))
    const wakesAfter = mock.requests.filter((r) => lastUserTextOf(r).startsWith('[team-review-wake')).length
    const cancelOk = cancel.status === 200 && cancel.body?.result?.ok === true
    const ok = cancelOk && stoppedRows.length === 1 && wakeRows.length === 0 && wakesAfter === wakeSeen
    check('A6-22', 'a real Host user Stop leaves a durable Sticky Stop marker, withdraws the queued wake row, and does not re-deliver', ok,
      `cancel=${String(cancelOk)} markers=${stoppedRows.join(',')} wakeRows=${wakeRows.join(',')} wakes=${wakeSeen}->${wakesAfter}`)
      // ── A56-SEMANTICS: MACHINE input must never clear a human Sticky Stop ──
      // Delivered HERE, while the stopped Officer Session is still LIVE, so the
      // native Inbox actually CLAIMS each message (the mock sees it and a turn
      // starts): that is the arbour's real question. A delivery that merely
      // queues behind a suspended latch would prove nothing about the arbour.
      // The Alpha.6 resume arbour used to key on `source.kind === 'user'` alone.
      // That is necessary but NOT sufficient after the joint close-out: WORK
      // delivery (delegation / follow-up) must keep the human attribution,
      // because upstream `tool-goal` authority (`hasDirectHumanInput`) reads
      // exactly it — without it a governed Member loses `create_goal`. So the
      // producer classifies its own input and the arbour asks the producer.
      const stoppedMarkersNow = () => {
        const now = existsSync(markerDir) ? readdirSync(markerDir) : []
        return now.filter((name) => name.startsWith('stopped-') && name.endsWith('.json'))
      }
      const wakesNow = () => mock.requests.filter((r) => lastUserTextOf(r).startsWith('[team-review-wake')).length
      const sawText = (needle) => mock.requests.some((r) => lastUserTextOf(r).includes(needle))
      const wakesBeforeMachine = wakesNow()
      const machineRelay = await remoteCall(booted.origin, booted.cookie, 'member.send', {
        teamSessionId: CREATE_ROOT_A6,
        caller: { kind: 'instance', instanceId: 'instance-c1-a6-leader' },
        recipientInstanceId: officer.instanceId,
        body: 'C1_A6_MACHINE_RELAY',
        requestToken: `c1-a6-machine-relay-${String(Date.now())}`,
      }, 'c1a6mrelay', 4)
      await new Promise((resolve) => setTimeout(resolve, 6000))
      const markersAfterMachineRelay = stoppedMarkersNow()
      const wakesAfterMachineRelay = wakesNow()
      const relayClaimed = sawText('C1_A6_MACHINE_RELAY')
      writeEvidence('a56-machine-relay.json', { relay: machineRelay.body ?? machineRelay, markersAfterMachineRelay, wakesBeforeMachine, wakesAfterMachineRelay, relayClaimed })
      // MEASURED (run 2026-11-09): a stopped latch accepts the machine relay
      // into the native Inbox (status 200) and does NOT claim it — `relayClaimed`
      // is recorded, not required: the Stop holds at the claim boundary before
      // the arbour is even reached. The arbour below is the fail-closed guard for
      // the paths where a claim DOES happen.
      check('A6-26', 'A56: a machine relay to a stopped reviewer does not clear the human Sticky Stop and does not re-deliver the wake',
        markersAfterMachineRelay.length === 1 && wakesAfterMachineRelay === wakesBeforeMachine,
        `relayStatus=${String(machineRelay.status)} relayClaimed=${String(relayClaimed)} markers=${markersAfterMachineRelay.join(',')} wakes=${String(wakesBeforeMachine)}->${String(wakesAfterMachineRelay)}`)
      const machineFollowup = await remoteCall(booted.origin, booted.cookie, 'member.followup', {
        teamSessionId: CREATE_ROOT_A6,
        caller: { kind: 'instance', instanceId: 'instance-c1-a6-leader' },
        targetInstanceId: officer.instanceId,
        requestToken: `c1-a6-machine-work-${String(Date.now())}`,
        payload: { prompt: 'C1_A6_MACHINE_WORK' },
      }, 'c1a6mwork', 4)
      await new Promise((resolve) => setTimeout(resolve, 8000))
      const markersAfterMachineWork = stoppedMarkersNow()
      const wakesAfterMachineWork = wakesNow()
      const workClaimed = sawText('C1_A6_MACHINE_WORK')
      writeEvidence('a56-machine-work.json', { followup: machineFollowup.body ?? machineFollowup, markersAfterMachineWork, wakesAfterMachineWork, workClaimed, wakesBeforeMachine })
      // The WORK delivery is the one Team input that still carries the human
      // `kind: 'user'` attribution (A5 goal authority). If the arbour keyed on
      // the kind alone this leg would fail: the marker would be gone.
      check('A6-27', 'A56: a machine WORK delivery (human-attributed for A5 goal authority) does not clear the Stop either',
        markersAfterMachineWork.length === 1 && wakesAfterMachineWork === wakesBeforeMachine,
        `followupStatus=${String(machineFollowup.status)} workClaimed=${String(workClaimed)} markers=${markersAfterMachineWork.join(',')} wakes=${String(wakesBeforeMachine)}->${String(wakesAfterMachineWork)}`)
    // Cross-restart: the marker is a FILE, not process memory. Kill the Host,
    // boot it again, and prove the Stop survives and no wake is re-delivered.
    let restartError = null
    let markersAfterRestart = []
    let markersAfterResume = []
    let wakesAfterRestart = wakesAfter
    let wakesAfterResume = wakesAfter
    let executedAfterResume = false
    try {
      const offset = statSync(booted.instanceLog).size
      const patchPath = join(HOME, 'profiles', 'web', 'cordis.patch.yml')
      const patchText = readFileSync(patchPath, 'utf8')
      if (!patchText.includes('bootPhase: "create-or-open"')) {
        writeFileSync(patchPath, patchText.replace('bootPhase: "create"', 'bootPhase: "create-or-open"'))
      }
      host.child.kill('SIGKILL')
      const exitDeadline = Date.now() + 20_000
      while (host.alive() && Date.now() < exitDeadline) await new Promise((resolve) => setTimeout(resolve, 50))
      const h2 = spawnHost({ port: booted.port, home: HOME, logPath: booted.instanceLog, mockPort: mock.port })
      const bootDeadline = Date.now() + 120_000
      while (Date.now() < bootDeadline && h2.alive()) {
        const text = readFileSync(booted.instanceLog, 'utf8').slice(offset)
        if (/http:\/\/127\.0\.0\.1:\d+\/\?token=/.test(text)) break
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      await new Promise((resolve) => setTimeout(resolve, 8000))
      const rows2 = existsSync(markerDir) ? readdirSync(markerDir) : []
      markersAfterRestart = rows2.filter((name) => name.startsWith('stopped-') && name.endsWith('.json'))
      wakesAfterRestart = mock.requests.filter((r) => lastUserTextOf(r).startsWith('[team-review-wake')).length
      // Explicit resume: a real user prompt on the stopped Officer Session.
      // The host maps `inbox/claimed` user source to resume, clears the marker
      // and re-plans the still-pending work through the normal dispatch path.
      const bootText = readFileSync(booted.instanceLog, 'utf8').slice(offset)
      const bootUrl = [...bootText.matchAll(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/g)].at(-1)
      if (bootUrl === undefined) throw new Error('no restart boot URL for resume')
      const origin2 = `http://127.0.0.1:${bootUrl[1]}`
      let cookie2 = null
      for (let attempt = 0; attempt < 60; attempt += 1) {
        try { cookie2 = await authenticate(origin2, bootUrl[2]); break } catch { await new Promise((resolve) => setTimeout(resolve, 500)) }
      }
      if (cookie2 === null) throw new Error('restart auth failed for resume')

      const resumed = await remoteCall(origin2, cookie2, 'member.send', {
        teamSessionId: CREATE_ROOT_A6,
        caller: { kind: 'human', humanId: CREATE_ROOT_A6 },
        recipientInstanceId: officer.instanceId,
        body: 'C1_A6_RESUME',
        requestToken: `c1-a6-resume-${String(Date.now())}`,
      }, 'c1a6resume', 4)
      writeEvidence('a6-sticky-resume-prompt.json', resumed.body ?? resumed)
      const execDeadline = Date.now() + 60_000
      while (Date.now() < execDeadline) {
        if (existsSync(FILE_A6_ALLOW)) break
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      const rows3 = existsSync(markerDir) ? readdirSync(markerDir) : []
      markersAfterResume = rows3.filter((name) => name.startsWith('stopped-') && name.endsWith('.json'))
      wakesAfterResume = mock.requests.filter((r) => lastUserTextOf(r).startsWith('[team-review-wake')).length
      executedAfterResume = existsSync(FILE_A6_ALLOW)
        && readFileSync(FILE_A6_ALLOW, 'utf8').includes(SUM_A6_ALLOW)
      if (h2.alive()) h2.child.kill('SIGKILL')
    } catch (error) {
      restartError = String(error?.message ?? error)
    }
    const restartOk = restartError === null && markersAfterRestart.length === 1 && wakesAfterRestart === wakesAfter
    check('A6-23', 'the Sticky Stop survives a real Host restart and does not re-deliver the withdrawn wake', restartOk,
      `restart=${restartError ?? 'ok'} markers=${markersAfterRestart.join(',')} wakes=${wakeSeen}->${wakesAfterRestart}`)
    // Scheme A: the original approval call lost its context across the
    // restart, so the resumed wake may still be delivered and decided, but
    // the historical call must NOT be revived/executed. Resume proves
    // marker clearing + re-plan, not replay.
    const resumeOk = restartError === null && markersAfterResume.length === 0
      && wakesAfterResume > wakesAfterRestart && !executedAfterResume
    check('A6-24', 'an explicit user interaction clears the durable Stop and re-plans the wake without reviving the historical call', resumeOk,
      `markers=${markersAfterResume.join(',')} wakes=${wakesAfterRestart}->${wakesAfterResume} historicalExecuted=${String(executedAfterResume)}`)
    writeEvidence('a6-sticky-stop.json', { cancel: cancel.body ?? cancel, rows, stoppedRows, wakeRows, wakeSeen, wakesAfter, markersAfterRestart, wakesAfterRestart, markersAfterResume, wakesAfterResume, executedAfterResume, restartError })
    return ok && restartOk && resumeOk
  }
  if (A6_TIMEOUT_MS > 0) {
    await new Promise((resolve) => setTimeout(resolve, A6_TIMEOUT_MS + 8000))
    const ledger = readControlLedger(CREATE_ROOT_A6)
    const pa = ledger.requests.find((r) => r.actionName === 'team-tool-execute') ?? null
    const paDecision = pa === null ? null : ledger.decisions.find((d) => d.requestId === pa.requestId) ?? null
    const paConsumption = pa === null ? null : ledger.consumptions.find((c) => c.requestId === pa.requestId) ?? null
    const executed = existsSync(FILE_A6_ALLOW)
    check('A6-19', 'a bounded A6 approval wait expires without deciding, consuming or executing; the durable request remains as a non-actionable abandoned invocation',
      pa !== null && paDecision === null && paConsumption === null && !executed,
      `timeoutMs=${String(A6_TIMEOUT_MS)} pa=${String(pa?.requestId)} decision=${String(paDecision?.decision)} consumed=${String(paConsumption !== null)} executed=${String(executed)}`)
    let late = null
    if (pa !== null) {
      late = await remoteCall(booted.origin, booted.cookie, 'team.resolveControl', {
        teamSessionId: CREATE_ROOT_A6,
        requestId: pa.requestId,
        decision: 'allow',
        note: 'c1 smoke A6: late allow after the bounded wait expired',
      }, 'c1a6timeout', 4)
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    const after = readControlLedger(CREATE_ROOT_A6)
    const lateDecision = pa === null ? null : after.decisions.find((d) => d.requestId === pa.requestId) ?? null
    const lateConsumption = pa === null ? null : after.consumptions.find((c) => c.requestId === pa.requestId) ?? null
    const lateFile = existsSync(FILE_A6_ALLOW)
    const lateAbandonment = pa === null ? null : after.abandonments.find((a) => a.requestId === pa.requestId) ?? null
    check('A6-20', 'a late allow after the wait timed out is refused because the invocation was abandoned: the approval decision is never rewritten, with zero consumption and zero execution',
      lateDecision === null && lateAbandonment !== null && lateConsumption === null && !lateFile,
      `decision=${String(lateDecision?.decision)} abandonment=${String(lateAbandonment?.reason)} consumed=${String(lateConsumption !== null)} executed=${String(lateFile)}`)
    writeEvidence('a6-timeout.json', { timeoutMs: A6_TIMEOUT_MS, pa, paDecision, paConsumption, executed, late: late?.body ?? late, lateDecision, lateAbandonment, lateConsumption, lateFile })
    return pa !== null && paDecision === null && paConsumption === null && !executed && lateDecision === null && lateAbandonment !== null && lateConsumption === null && !lateFile
  }
  if (A6_CRASH) {
    const crashMode = process.env['C1_A6_CRASH'] === 'allow' ? 'allow'
      : process.env['C1_A6_CRASH'] === 'consume' ? 'consume'
        : process.env['C1_A6_CRASH'] === 'body' ? 'body'
          : process.env['C1_A6_CRASH'] === 'before' ? 'before' : 'request'
    if (crashMode === 'before') {
      const watchDeadline = Date.now() + 60_000
      let sawAdmission = false
      while (Date.now() < watchDeadline && host.alive()) {
        const text = readFileSync(booted.instanceLog, 'utf8')
        if (text.includes('a5-admission: event=admission-requires-approval')) { sawAdmission = true; break }
        await new Promise((resolve) => setTimeout(resolve, 20))
      }
      host.child.kill('SIGKILL')
      const exitDeadline = Date.now() + 20_000
      while (host.alive() && Date.now() < exitDeadline) await new Promise((resolve) => setTimeout(resolve, 50))
      const durable = readControlLedger(CREATE_ROOT_A6)
      const afterRestart = { booted: null, error: null }
      try {
        const offset = statSync(booted.instanceLog).size
        const patchPath = join(HOME, 'profiles', 'web', 'cordis.patch.yml')
        const patchText = readFileSync(patchPath, 'utf8')
        if (!patchText.includes('bootPhase: "create-or-open"')) {
          writeFileSync(patchPath, patchText.replace('bootPhase: "create"', 'bootPhase: "create-or-open"'))
        }
        const h2 = spawnHost({ port: booted.port, home: HOME, logPath: booted.instanceLog, mockPort: mock.port })
        let parsed = null
        const bootDeadline = Date.now() + 120_000
        while (Date.now() < bootDeadline && h2.alive()) {
          const text = readFileSync(booted.instanceLog, 'utf8').slice(offset)
          const matches = [...text.matchAll(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/g)]
          if (matches.length > 0) { parsed = matches.at(-1); break }
          await new Promise((resolve) => setTimeout(resolve, 200))
        }
        if (parsed === null) throw new Error('no restart boot URL')
        const origin2 = `http://127.0.0.1:${parsed[1]}`
        let cookie2 = null
        for (let attempt = 0; attempt < 60; attempt += 1) {
          try { cookie2 = await authenticate(origin2, parsed[2]); break } catch { await new Promise((resolve) => setTimeout(resolve, 500)) }
        }
        if (cookie2 === null) throw new Error('restart auth failed')
        afterRestart.booted = { origin: origin2, cookie: cookie2, host: h2 }
      } catch (error) { afterRestart.error = String(error?.message ?? error) }
      const final = readControlLedger(CREATE_ROOT_A6)
      const revived = existsSync(FILE_A6_ALLOW)
      const pa = final.requests.find((r) => r.actionName === 'team-tool-execute') ?? null
      const phantom = pa !== null && final.decisions.every((d) => d.requestId !== pa.requestId) && final.consumptions.every((c) => c.requestId !== pa.requestId)
      check('A6-17', 'a Host crash at the first admission leaves no execution and no phantom PA request/consumption after restart',
        sawAdmission && !revived && !phantom,
        `admission=${String(sawAdmission)} restart=${afterRestart.error ?? 'ok'} pa=${String(pa?.requestId)} revoked=${String(revived)} phantom=${String(phantom)} requests=${String(final.requests.length)} decisions=${String(final.decisions.length)} consumptions=${String(final.consumptions.length)}`)
      writeEvidence('a6-crash.json', { mode: crashMode, durable, restart: { error: afterRestart.error }, pa, final, revived, phantom })
      if (afterRestart.booted !== null) stopHost(afterRestart.booted.host)
      return sawAdmission && !revived && !phantom && afterRestart.error === null
    }
    let pa = null
    let decided = null
    let consumed = null
    const waitDeadline = Date.now() + (crashMode === 'body' ? 180_000 : 60_000)
    while (Date.now() < waitDeadline) {
      const current = readControlLedger(CREATE_ROOT_A6)
      pa = current.requests.find((r) => r.actionName === 'team-tool-execute') ?? null
      decided = pa === null ? null : current.decisions.find((d) => d.requestId === pa.requestId) ?? null
      consumed = pa === null ? null : current.consumptions.find((c) => c.requestId === pa.requestId) ?? null
      if (crashMode === 'body') {
        // A delaying command is classified into the A5 parameter-permission
        // lane in this fixture; approve any open row through the same remote
        // human entry so the Plane PA leg can be created and the body can
        // start. This is a crash-window probe, not an approval-path claim.
        for (const request of current.requests) {
          if (current.decisions.some((d) => d.requestId === request.requestId)) continue
          if (current.abandonments.some((a) => a.requestId === request.requestId)) continue
          await remoteCall(booted.origin, booted.cookie, 'team.resolveControl', {
            teamSessionId: CREATE_ROOT_A6,
            requestId: request.requestId,
            decision: 'allow',
            note: 'c1 smoke A6 body-start probe: approve the parameter lane',
          }, 'c1a6body', 4)
        }
      }
      const ready = crashMode === 'request'
        || (crashMode === 'allow' && decided !== null && decided.decision === 'allow')
        || (crashMode === 'consume' && consumed !== null)
        || (crashMode === 'body' && consumed !== null && existsSync(FILE_A6_BODY_START))
      if (pa !== null && ready) break
      await new Promise((resolve) => setTimeout(resolve, 25))
    }
    const beforeKill = pa === null ? null : readControlLedger(CREATE_ROOT_A6)
    const beforeFileCount = existsSync(FILE_A6_ALLOW)
      ? (readFileSync(FILE_A6_ALLOW, 'utf8').match(new RegExp(SUM_A6_ALLOW, 'g')) ?? []).length
      : 0
    host.child.kill('SIGKILL')
    const exitDeadline = Date.now() + 20_000
    while (host.alive() && Date.now() < exitDeadline) await new Promise((resolve) => setTimeout(resolve, 50))
    const exited = !host.alive()
    const durable = readControlLedger(CREATE_ROOT_A6)
    const afterRestart = { booted: null, error: null }
    try {
      const offset = statSync(booted.instanceLog).size
      const patchPath = join(HOME, 'profiles', 'web', 'cordis.patch.yml')
      const patchText = readFileSync(patchPath, 'utf8')
      if (!patchText.includes('bootPhase: "create-or-open"')) {
        writeFileSync(patchPath, patchText.replace('bootPhase: "create"', 'bootPhase: "create-or-open"'))
      }
      const h2 = spawnHost({ port: booted.port, home: HOME, logPath: booted.instanceLog, mockPort: mock.port })
      let parsed = null
      const bootDeadline = Date.now() + 120_000
      while (Date.now() < bootDeadline && h2.alive()) {
        const text = readFileSync(booted.instanceLog, 'utf8').slice(offset)
        const matches = [...text.matchAll(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/g)]
        if (matches.length > 0) { parsed = matches.at(-1); break }
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      if (parsed === null) throw new Error('no restart boot URL')
      const origin2 = `http://127.0.0.1:${parsed[1]}`
      let cookie2 = null
      let authError = null
      for (let attempt = 0; attempt < 60; attempt += 1) {
        try { cookie2 = await authenticate(origin2, parsed[2]); break } catch (error) { authError = error; await new Promise((resolve) => setTimeout(resolve, 500)) }
      }
      if (cookie2 === null) throw new Error(`restart auth failed: ${authError?.message ?? 'unknown'}`)
      afterRestart.booted = { origin: origin2, cookie: cookie2, host: h2 }
      afterRestart.error = null
      // Recovery runs after readiness; give it a beat to finish the
      // settlement write before the probe reads the final ledger.
      await new Promise((resolve) => setTimeout(resolve, 3000))
    } catch (error) {
      afterRestart.error = String(error?.message ?? error)
    }
    let revived = false
    let late = null
    let decisionAfter = null
    if (crashMode === 'allow' || crashMode === 'consume' || crashMode === 'body') {
      const final = readControlLedger(CREATE_ROOT_A6)
      const consBefore = beforeKill?.consumptions.filter((c) => c.requestId === pa?.requestId).length ?? 0
      const consAfter = final.consumptions.filter((c) => c.requestId === pa?.requestId).length
      const fileCount = existsSync(FILE_A6_ALLOW)
        ? (readFileSync(FILE_A6_ALLOW, 'utf8').match(new RegExp(SUM_A6_ALLOW, 'g')) ?? []).length
        : 0
      const bodyStart = existsSync(FILE_A6_BODY_START)
      const abandonment = pa === null ? null : final.abandonments.find((a) => a.requestId === pa.requestId) ?? null
      revived = fileCount > 0
      const expectReason = crashMode === 'allow' ? 'invocation-abandoned' : 'execution-outcome-unknown'
      const noReplay = afterRestart.error === null && decided?.decision === 'allow'
        && consAfter === consBefore && fileCount === beforeFileCount && fileCount <= 1
        && abandonment?.reason === expectReason
        && (crashMode === 'allow'
          ? !bodyStart
          : crashMode === 'consume' ? !bodyStart : bodyStart && fileCount === 0)
      check(crashMode === 'consume' ? 'A6-16' : crashMode === 'body' ? 'A6-16b' : 'A6-15',
        crashMode === 'allow'
          ? 'a Host crash after the PA allow but before consumption leaves the allow intact, abandons the dead invocation and executes nothing'
          : crashMode === 'consume'
            ? 'a Host crash after consumption but BEFORE the body starts proves zero execution and records execution-outcome-unknown'
            : 'a Host crash with the body STARTED but the result not durable records execution-outcome-unknown and never replays the body',
        noReplay,
        `mode=${crashMode} restart=${afterRestart.error ?? 'ok'} decision=${String(decided?.decision)} consBefore=${String(consBefore)} consAfter=${String(consAfter)} fileBefore=${String(beforeFileCount)} fileAfter=${String(fileCount)} bodyStart=${String(bodyStart)} abandon=${String(abandonment?.reason)} revived=${String(revived)}`)
      writeEvidence('a6-crash.json', { mode: crashMode, pa, beforeKill, durable, restart: { error: afterRestart.error }, decisionAfter: decided, abandonment, revived, consBefore, consAfter, beforeFileCount, fileCount, bodyStart })
      if (afterRestart.booted !== null) stopHost(afterRestart.booted.host)
      return noReplay
    }
    if (afterRestart.booted !== null && pa !== null) {
      late = await remoteCall(afterRestart.booted.origin, afterRestart.booted.cookie, 'team.resolveControl', {
        teamSessionId: CREATE_ROOT_A6,
        requestId: pa.requestId,
        decision: 'allow',
        note: 'c1 smoke A6: resolve after a Host crash and restart',
      }, 'c1a6crash', 4)
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const final = readControlLedger(CREATE_ROOT_A6)
      decisionAfter = final.decisions.filter((d) => d.requestId === pa.requestId).at(-1) ?? null
      revived = existsSync(FILE_A6_ALLOW) && readFileSync(FILE_A6_ALLOW, 'utf8').includes(SUM_A6_ALLOW)
      const consumed = final.consumptions.find((c) => c.requestId === pa.requestId) ?? null
      check('A6-13', 'a Host crash after the PA request write leaves the durable request recoverable, with no execution before/after restart', exited && pa !== null && final.requests.some((r) => r.requestId === pa.requestId) && !revived,
        `exited=${String(exited)} pa=${String(pa?.requestId)} restart=${afterRestart.error ?? 'ok'} decision=${JSON.stringify(decisionAfter)} consumed=${String(consumed !== null)} file=${String(revived)}`)
      const crashAbandonment = final.abandonments.find((a) => a.requestId === pa.requestId) ?? null
      // Scheme A: a late human allow may be recorded as an ALLOW (the human's
      // decision is immutable) but it is never rewritten to deny and never
      // revives the dead call. A boot settlement may instead close the
      // invocation; both shapes are acceptable, a deny is not.
      const settled = (decisionAfter === null && crashAbandonment !== null)
        || (decisionAfter?.decision === 'allow' && consumed === null)
      check('A6-14', 'after a Host crash the dead invocation is settled without a deny rewrite and a late human allow cannot execute it', settled && !revived,
        `decision=${String(decisionAfter?.decision)} abandon=${String(crashAbandonment?.reason)} consumed=${String(consumed !== null)} file=${String(revived)}`)
      writeEvidence('a6-crash.json', { pa, beforeKill, durable, restart: { error: afterRestart.error }, late: late.body ?? late, decisionAfter, revived })
      if (afterRestart.booted !== null) stopHost(afterRestart.booted.host)
    } else {
      check('A6-13', 'a Host crash after the PA request write leaves the durable request recoverable', false,
        `exited=${String(exited)} pa=${String(pa?.requestId)} restart=${afterRestart.error ?? 'ok'}`)
      writeEvidence('a6-crash.json', { pa, beforeKill, durable, restart: { error: afterRestart.error }, revived })
    }
    return exited && pa !== null && afterRestart.error === null && !revived
  }
  let humanEscalation = null
  let humanDiscovery = null
  let humanLeg = null
  let humanDecision = null
  let humanConsumption = null
  if (A6_HUMAN || A6_STOP) {
    const deadline = Date.now() + Number(process.env['C1_A6_WAIT_MS'] ?? 300_000)
    // WP3-FENCE-TIMING: in timing mode the discovery poll must be fast enough
    // to observe the request row BEFORE its anchored resolve target; the
    // target itself is computed from the row's own durable `createdAt`, so
    // discovery latency never shifts the schedule.
    const discoverPollMs = A6_STOP_TIMING === null ? 250 : 2
    while (Date.now() < deadline) {
      const current = readControlLedger(CREATE_ROOT_A6)
      humanLeg = current.requests.find((r) => r.reviewAuthority === 'human-user'
        && !current.decisions.some((d) => d.requestId === r.requestId)) ?? null
      humanEscalation = humanLeg === null ? null : current.escalations.find((e) => e.approvalCaseId === humanLeg.approvalCaseId) ?? null
      if (humanLeg !== null) break
      await new Promise((resolve) => setTimeout(resolve, discoverPollMs))
    }
    if (humanLeg !== null) {
      // RULING 5: the human leg must be DISCOVERABLE through the remote
      // surface alone, before any model turn names it. The durable ledger
      // page is the read; the projection's pending counter is the summary.
      const page = await remoteCall(booted.origin, booted.cookie, 'team.getLedgerPage', {
        teamSessionId: CREATE_ROOT_A6,
        afterSequence: 0,
        limit: 500,
      }, 'c1a6disc', 4)
      const projection = await remoteCall(booted.origin, booted.cookie, 'team.getProjection', {
        teamSessionId: CREATE_ROOT_A6,
      }, 'c1a6disc', 4)
      const entries = page.body?.result?.value?.data?.entries ?? []
      const serialized = JSON.stringify(entries)
      // Remote-only discovery: the human leg's request id is learned from the
      // ledger page itself (NOT from the local control-ledger file).
      const remoteHumanFact = entries.find((entry) => entry?.factType === 'control-request-recorded'
        && entry?.payload?.reviewAuthority === 'human-user'
        && entry?.payload?.requestId !== undefined) ?? null
      const remoteHumanId = remoteHumanFact?.payload?.requestId ?? null
      const projectionData = projection.body?.result?.value?.data?.projection ?? {}
      humanDiscovery = {
        localRequestId: humanLeg.requestId,
        remoteOnlyRequestId: remoteHumanId,
        remoteDiscoveryAgrees: remoteHumanId === humanLeg.requestId,
        requestFactVisible: remoteHumanFact !== null,
        requestIdOccurrences: remoteHumanId === null ? 0 : serialized.split(remoteHumanId).length - 1,
        pendingControlCount: projectionData.ledger?.pendingControlCount ?? null,
        page: page.body ?? page,
        projection: projection.body ?? projection,
      }
      writeEvidence('a6-human-discovery.json', humanDiscovery)
    }
    // WP3-FENCE-TIMING: the ONE durable anchor both scheduled events are
    // measured from (the service's own request-row createdAt).
    const timingAnchorMs = A6_STOP_TIMING === null || humanLeg === null
      ? null
      : Date.parse(humanLeg.createdAt)
    const stopTiming = {
      mode: A6_STOP_TIMING === null ? 'immediate' : 'anchored',
      config: A6_STOP_TIMING,
      anchorRow: humanLeg === null ? null : { requestId: humanLeg.requestId, sequence: humanLeg.sequence, createdAt: humanLeg.createdAt },
      discoveredAt: humanLeg === null ? null : new Date().toISOString(),
      resolveTargetAt: timingAnchorMs === null ? null : new Date(timingAnchorMs + A6_STOP_TIMING.resolveAt).toISOString(),
      resolveSentAt: null,
      resolveReturnedAt: null,
      decisionCreatedAt: null,
      stopTargetAt: timingAnchorMs === null ? null : new Date(timingAnchorMs + A6_STOP_TIMING.stopAt).toISOString(),
      stopSentAt: null,
      stopReturnedAt: null,
    }
    if (humanLeg !== null) {
      if (timingAnchorMs !== null) await sleepUntilWallClock(timingAnchorMs + A6_STOP_TIMING.resolveAt)
      stopTiming.resolveSentAt = new Date().toISOString()
      const response = await remoteCall(booted.origin, booted.cookie, 'team.resolveControl', {
        teamSessionId: CREATE_ROOT_A6,
        requestId: humanDiscovery?.remoteOnlyRequestId ?? humanLeg.requestId,
        decision: 'allow',
        note: 'c1 smoke A6 human final approval',
      }, 'c1a6h', 4)
      stopTiming.resolveReturnedAt = new Date().toISOString()
      // The decision row's own durable timestamp, not the kit's intent.
      const afterResolve = readControlLedger(CREATE_ROOT_A6)
      stopTiming.decisionCreatedAt = afterResolve.decisions
        .filter((d) => d.requestId === humanLeg.requestId).at(-1)?.createdAt ?? null
      writeEvidence('a6-human-response.json', response.body ?? response)
    }
    if (A6_STOP) {
      // WP3-FENCE-TIMING: place the Stop at `anchor + stop` ms — on the
      // waiter's 250 ms poll grid — instead of "as fast as possible".
      if (timingAnchorMs !== null) await sleepUntilWallClock(timingAnchorMs + A6_STOP_TIMING.stopAt)
      const worker = readMemberRows(CREATE_ROOT_A6).find((row) => row.templateId === 'worker' && row.label === 'w-a6')
      stopTiming.stopSentAt = new Date().toISOString()
      // PD41-ABORT-CLASS: the Stop's ABORT CAUSE is a property of the action,
      // not of the timing. The host's `session/cancel` RPC is hard-wired to
      // `{kind:'user'}`; `C1_A6_STOP_VIA=archive` reaches the SAME parked call
      // through the Team lifecycle instead, whose interrupt is
      // `{kind:'hook', reason:'team-member-interrupt'}` — a non-user/non-parent
      // cause, i.e. the abort class the WP3 arm's user Stop could never drive.
      // Instrument only: same offset, same durable reads, no product change.
      const stopVia = String(process.env['C1_A6_STOP_VIA'] ?? 'cancel')
      stopTiming.stopVia = stopVia
      const cancel = worker === undefined
        ? { status: 0, body: { error: 'no member child session' } }
        : stopVia === 'archive'
          ? await remoteCall(booted.origin, booted.cookie, 'member.archive', {
              teamSessionId: CREATE_ROOT_A6,
              instanceId: worker.instanceId,
            }, 'c1a6stop', 4)
          : await apiCancel(booted.origin, booted.cookie, worker.childSessionId, 'c1a6stop')
      stopTiming.stopReturnedAt = new Date().toISOString()
      writeEvidence('a6-stop-cancel.json', { stopVia, response: cancel.body ?? cancel })
      await new Promise((resolve) => setTimeout(resolve, 2500))
      const afterCancel = readControlLedger(CREATE_ROOT_A6)
      const late = humanLeg === null ? null : await remoteCall(booted.origin, booted.cookie, 'team.resolveControl', {
        teamSessionId: CREATE_ROOT_A6,
        requestId: humanLeg.requestId,
        decision: 'allow',
        note: 'c1 smoke A6: a late allow after Stop must not revive the call',
      }, 'c1a6stop', 4)
      writeEvidence('a6-stop-late-allow.json', late.body ?? late)
      await new Promise((resolve) => setTimeout(resolve, 2500))
      const final = readControlLedger(CREATE_ROOT_A6)
      const lateDecision = humanLeg === null ? null : final.decisions.filter((d) => d.requestId === humanLeg.requestId).at(-1) ?? null
      const lateConsumption = humanLeg === null ? null : final.consumptions.find((c) => c.requestId === humanLeg.requestId) ?? null
      // INSTRUMENT FIX (2026-11-11, review finding on PR #710): the fence
      // trips into a terminal `control-request-abandoned` row, and the kit
      // already READS that row (`readControlLedger().abandonments`) but used
      // to drop it from the kept artifact. Persist it so the trip is CAPTURED
      // instead of inferred from the code path.
      const humanAbandonment = humanLeg === null
        ? null
        : final.abandonments.find((a) => a.requestId === humanLeg.requestId) ?? null
      const fileAfter = existsSync(FILE_A6_ALLOW) ? readFileSync(FILE_A6_ALLOW, 'utf8') : ''
      const revived = fileAfter.includes(SUM_A6_ALLOW) || lateConsumption !== null
      const cancelOk = (cancel.status === 200 && (cancel.body?.result?.ok === true || cancel.body?.result?.accepted === true))
      check('A6-11', 'session/cancel is admitted after the human allow, before the allow is consumed/executed', cancelOk,
        `status=${cancel.status} body=${JSON.stringify(cancel.body ?? cancel).slice(0, 500)} afterCancelPending=${afterCancel.requests.filter((r) => !afterCancel.decisions.some((d) => d.requestId === r.requestId)).length}`)
      check('A6-12', 'Stop before consumption prevents execution; a second allow is refused (decided or abandoned — the arm decides which)', !revived,
        `lateStatus=${late?.status} lateDecision=${JSON.stringify(lateDecision)} consumed=${lateConsumption !== null} file=${JSON.stringify(fileAfter.slice(0, 200))}`)
      writeEvidence('a6-stop.json', {
        cancel: cancel.body ?? cancel,
        lateAllow: late?.body ?? late,
        humanLeg,
        lateDecision,
        lateConsumption,
        abandonments: final.abandonments,
        humanAbandonment,
        fileAfter,
        revived,
        // WP3-FENCE-TIMING: the run's own timing record (durable anchor +
        // when each scheduled event was actually sent) and the full durable
        // ledger for the seq table the driver asserts on.
        timing: stopTiming,
        ledgerCounter: readLedgerCounter(),
        ledger: final,
      })
      return cancelOk && !revived
    }
  }
  if (A6_INBOX_UNCLAIMED) {
    // The audit's missing window: ACCEPTED but never CLAIMED. The Officer is
    // held in a long tool turn, so the wake lands in the durable next-step
    // inbox and `markAccepted` records the acceptance — no `agent/inbox/
    // claimed` has fired (zero wake turns). SIGKILL exactly there, restart the
    // same DSH_HOME, and count how many claims the native Inbox produces.
    // Drive the busy turn DIRECTLY on the Officer (the Leader's send can be
    // queued behind the wake, which is the race this window must avoid).
    const officerRow = readMemberRows(CREATE_ROOT_A6).find((row) => row.templateId === 'officer' && typeof row.childSessionId === 'string')
    if (officerRow !== undefined) {
      await apiPrompt(booted.origin, booted.cookie, officerRow.childSessionId, 'C1_A6_BUSY', 'c1a6busy')
      await waitForMock(mock, (r) => lastUserTextOf(r).includes('C1_A6_BUSY') && replyToolNames(r).includes('bash'), 30_000, 'Officer busy turn started')
    }
    const markerDir = join(HOME, 'alpha6-wake-intents')
    const intentDeadline = Date.now() + 120_000
    let acceptedRow = null
    let wakeRows = []
    let wakesBefore = 0
    let busySeen = false
    while (Date.now() < intentDeadline) {
      wakeRows = existsSync(markerDir)
        ? readdirSync(markerDir).filter((name) => name.startsWith('wake-') && name.endsWith('.json'))
        : []
      wakesBefore = wakeStartCount(mock.requests)
      busySeen = mock.requests.some((r) => lastUserTextOf(r).includes('C1_A6_BUSY'))
      if (wakeRows.length > 0) {
        try {
          const row = JSON.parse(readFileSync(join(markerDir, wakeRows[0]), 'utf8'))
          if (row?.status === 'accepted' && wakesBefore === 0 && busySeen) { acceptedRow = row; break }
        } catch { /* rewritten mid-read: retry */ }
      }
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
    const ledgerBefore = readControlLedger(CREATE_ROOT_A6)
    const pendingBefore = ledgerBefore.requests.filter(
      (r) => !ledgerBefore.decisions.some((d) => d.requestId === r.requestId),
    ).map((r) => r.requestId)
    const requestsAtRestart = mock.requests.length
    const wakeTraceBefore = mock.requests.map((r, index) => {
      const wakeId = /^\[team-review-wake wakeId=([^\]]+)\]/.exec(lastUserTextOf(r))?.[1] ?? null
      return wakeId === null ? null : { index, wakeId, messageCount: r.body?.messages?.length ?? null, lastRole: r.body?.messages?.at(-1)?.role ?? null }
    }).filter((row) => row !== null)
    writeEvidence('a6-inbox-unclaimed-before.json', {
      acceptedRow, wakeRows, wakesBefore, busySeen, pendingBefore, requestsAtRestart, wakeTraceBefore,
    })
    let restartError = null
    let wakesAfterRestart = wakesBefore
    let wakesAfterDrain = wakesBefore
    let rowsAfterRestart = wakeRows
    let rowsAfterDrain = wakeRows
    let pendingAfter = pendingBefore
    let discoveryAfter = null
    let postRestartError = null
    try {
      const offset = statSync(booted.instanceLog).size
      const patchPath = join(HOME, 'profiles', 'web', 'cordis.patch.yml')
      const patchText = readFileSync(patchPath, 'utf8')
      if (!patchText.includes('bootPhase: "create-or-open"')) {
        writeFileSync(patchPath, patchText.replace('bootPhase: "create"', 'bootPhase: "create-or-open"'))
      }
      a6BusyDone = true
      host.child.kill('SIGKILL')
      const exitDeadline = Date.now() + 20_000
      while (host.alive() && Date.now() < exitDeadline) await new Promise((resolve) => setTimeout(resolve, 50))
      const h2 = spawnHost({ port: booted.port, home: HOME, logPath: booted.instanceLog, mockPort: mock.port })
      const bootDeadline = Date.now() + 120_000
      while (Date.now() < bootDeadline && h2.alive()) {
        const text = readFileSync(booted.instanceLog, 'utf8').slice(offset)
        if (/http:\/\/127\.0\.0\.1:\d+\/\?token=/.test(text)) break
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      await new Promise((resolve) => setTimeout(resolve, 8000))
      rowsAfterRestart = existsSync(markerDir)
        ? readdirSync(markerDir).filter((name) => name.startsWith('wake-') && name.endsWith('.json'))
        : []
      wakesAfterRestart = wakeStartCount(mock.requests)
      const bootText = readFileSync(booted.instanceLog, 'utf8').slice(offset)
      const bootUrl = [...bootText.matchAll(/http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/g)].at(-1)
      if (bootUrl === undefined) throw new Error('no boot URL after unclaimed-inbox restart')
      const origin2 = `http://127.0.0.1:${bootUrl[1]}`
      let cookie2 = null
      for (let attempt = 0; attempt < 60; attempt += 1) {
        try { cookie2 = await authenticate(origin2, bootUrl[2]); break } catch { await new Promise((resolve) => setTimeout(resolve, 500)) }
      }
      if (cookie2 === null) throw new Error('restart auth failed for unclaimed-inbox crash')
      // The claim may arrive with the replayed (repaired) turn or as a fresh
      // wake turn. Count wake TURN STARTS for 60 s and wait for the durable
      // request to settle.
      const drainDeadline = Date.now() + 90_000
      while (Date.now() < drainDeadline) {
        wakesAfterDrain = wakeStartCount(mock.requests)
        const ledger = readControlLedger(CREATE_ROOT_A6)
        const stillPending = pendingBefore.filter((id) => !ledger.decisions.some((d) => d.requestId === id))
        pendingAfter = stillPending
        if (wakesAfterDrain > wakesBefore && stillPending.length === 0) break
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      rowsAfterDrain = existsSync(markerDir)
        ? readdirSync(markerDir).filter((name) => name.startsWith('wake-') && name.endsWith('.json'))
        : []
      // Acceptance criterion (ii): a stranded wake is acceptable ONLY if the
      // durable request is discoverable through the public remote surface and
      // an operator can resolve it by id. Read the page + projection BEFORE
      // tearing the restarted Host down.
      const strandedPendingId = pendingAfter[0] ?? null
      const pageAfter = await remoteCall(origin2, cookie2, 'team.getLedgerPage', {
        teamSessionId: CREATE_ROOT_A6,
        afterSequence: 0,
      }, 'c1a6g2', 4)
      const projectionAfter = await remoteCall(origin2, cookie2, 'team.getProjection', {
        teamSessionId: CREATE_ROOT_A6,
      }, 'c1a6g2p', 4)
      const serializedAfter = JSON.stringify(pageAfter.body ?? pageAfter)
      const projectionDataAfter = projectionAfter.body?.result?.value?.data?.projection ?? {}
      discoveryAfter = {
        pendingRequestId: strandedPendingId,
        requestFactVisible: strandedPendingId !== null && serializedAfter.includes(strandedPendingId),
        requestIdOccurrences: strandedPendingId === null ? 0 : serializedAfter.split(strandedPendingId).length - 1,
        pendingControlCount: projectionDataAfter.ledger?.pendingControlCount ?? null,
        page: pageAfter.body ?? pageAfter,
        projection: projectionAfter.body ?? projectionAfter,
      }
      // Operator recovery EXERCISED, not just asserted: the public resolve
      // channel must accept the stranded request by id after the restart.
      let recovery = null
      if (strandedPendingId !== null) {
        const recoveryResponse = await remoteCall(origin2, cookie2, 'team.resolveControl', {
          teamSessionId: CREATE_ROOT_A6,
          requestId: strandedPendingId,
          decision: 'allow',
          note: 'C1 A6 gap-2 operator recovery after a stranded accepted wake',
        }, 'c1a6g2r', 4)
        const recoveredLedger = readControlLedger(CREATE_ROOT_A6)
        recovery = {
          status: recoveryResponse.status,
          body: recoveryResponse.body ?? recoveryResponse,
          decision: recoveredLedger.decisions.filter((d) => d.requestId === strandedPendingId).at(-1) ?? null,
        }
        discoveryAfter.recovery = recovery
      }
      if (h2.alive()) h2.child.kill('SIGKILL')
    } catch (error) {
      restartError = String(error?.message ?? error)
    }
    const delivered = wakesAfterDrain - wakesBefore
    const ledgerAfter = readControlLedger(CREATE_ROOT_A6)
    const acceptedRequestId = acceptedRow?.requestId ?? pendingBefore[0] ?? null
    const abandonedAfter = acceptedRequestId === null ? [] : ledgerAfter.abandonments.filter((a) => a.requestId === acceptedRequestId)
    pendingAfter = ledgerAfter.requests.filter(
      (r) => !ledgerAfter.decisions.some((d) => d.requestId === r.requestId)
        && !ledgerAfter.abandonments.some((a) => a.requestId === r.requestId),
    )
    const exactlyOnce = acceptedRow !== null && restartError === null && busySeen
      && wakesBefore === 0 && delivered === 1 && pendingAfter.length === 0
    // Acceptable (ii): no claim after restart, but the durable request is still
    // pending AND discoverable through the public remote surface (page +
    // projection), so an operator can resolve it by id.
    const strandedAcceptable = acceptedRow !== null && restartError === null && busySeen
      && wakesBefore === 0 && delivered === 0 && pendingAfter.length > 0
      && discoveryAfter !== null && discoveryAfter.requestFactVisible === true
      && discoveryAfter.recovery?.decision?.decision === 'allow'
    // The measured outcome on this base: the accepted wake is never claimed,
    // and boot recovery terminally ABANDONS the durable PA request
    // (`control-request-abandoned`, reason invocation-abandoned). That is
    // at-most-once (no duplicate); resolution is refused forever, and the
    // operator recovery is re-issuing the ask. Typed + discoverable by id.
    const abandonedTerminal = acceptedRow !== null && restartError === null && busySeen
      && wakesBefore === 0 && delivered === 0 && abandonedAfter.length > 0
      && discoveryAfter !== null && discoveryAfter.requestFactVisible === true
      && ((discoveryAfter.recovery?.body?.result?.error?.code ?? discoveryAfter.recovery?.body?.error?.code) === 'CONTROL_REQUEST_ABANDONED')
    const ok = exactlyOnce || strandedAcceptable
    const verdict = exactlyOnce ? 'exactly-once'
      : delivered > 1 ? 'duplicate-P1'
        : abandonedTerminal ? 'abandoned-terminal'
          : strandedAcceptable ? 'stranded-discoverable'
            : 'stranded-undiscoverable'
    if (!ok) postRestartError = restartError
      ?? (acceptedRow === null ? 'no ACCEPTED row observed before the kill'
        : busySeen !== true ? 'the Officer was never BUSY, so the window was not constructed'
          : wakesBefore !== 0 ? `the wake was already claimed before the kill (wake turns=${wakesBefore})`
            : delivered === 0 && abandonedAfter.length > 0 ? 'ABANDONED: no claim after restart; the accepted wake/request is terminally abandoned (no duplicate, but the review work is dropped and cannot be resolved)'
            : delivered === 0 ? 'STRANDED: no claim after restart and the pending request is not discoverable'
              : delivered > 1 ? `DUPLICATE: the accepted message was claimed ${delivered} times after restart`
                : 'the durable request did not settle after the replayed claim')
    check('A6-26', 'an ACCEPTED-but-never-CLAIMED wake after restart is claimed EXACTLY once, or stranded with a discoverable durable request (never duplicated)', ok,
      `accepted=${acceptedRow === null ? 'none' : acceptedRow.wakeId} busy=${busySeen} wakes=${wakesBefore}->${wakesAfterRestart}->${wakesAfterDrain} rows=${wakeRows.length}->${rowsAfterRestart.length}->${rowsAfterDrain.length} pendingBefore=${pendingBefore.length} pendingAfter=${pendingAfter.length} discoverable=${String(discoveryAfter?.requestFactVisible)} pendingCount=${String(discoveryAfter?.pendingControlCount)} abandoned=${abandonedAfter.length} recoveryCode=${String(discoveryAfter?.recovery?.body?.result?.error?.code ?? discoveryAfter?.recovery?.body?.error?.code)} restart=${restartError ?? 'ok'} verdict=${verdict}`)
    writeEvidence('a6-inbox-unclaimed.json', {
      schema: 'a6-inbox-unclaimed/1',
      window: 'ACCEPTED-not-CLAIMED',
      acceptedRow,
      busySeen,
      wakesBefore,
      wakesAfterRestart,
      wakesAfterDrain,
      deliveredAfterRestart: delivered,
      rowsBefore: wakeRows,
      rowsAfterRestart,
      rowsAfterDrain,
      pendingBefore,
      pendingAfter,
      abandonedAfter,
      discoveryAfter,
      restartError,
      verdict,
      acceptable: ok,
      reason: exactlyOnce ? 'exactly-once-claim'
        : abandonedTerminal ? 'terminal-abandonment: no duplicate execution; the accepted wake/request is durably abandoned and must be re-issued'
          : strandedAcceptable ? 'stranded-but-discoverable-and-operator-recovery-exercised' : postRestartError,
      wakeTraceAfter: mock.requests.map((r, index) => {
        const wakeId = /^\[team-review-wake wakeId=([^\]]+)\]/.exec(lastUserTextOf(r))?.[1] ?? null
        return wakeId === null ? null : { index, wakeId, messageCount: r.body?.messages?.length ?? null, lastRole: r.body?.messages?.at(-1)?.role ?? null }
      }).filter((row) => row !== null),
      mockRequests: mock.requests.length,
    })
    return ok
  }

  const memberDone = await waitForMock(
    mock,
    (r) => r.body !== null && lastUserTextOf(r).includes(MK_A6MEM)
      && replyToolNames(r).length === 0
      && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_A6_MEMBER_DONE',
    Number(process.env['C1_A6_WAIT_MS'] ?? 300_000),
    'A6 member done after Officer allow + plane execute',
  )
  const wakes = mock.requests.filter((r) => lastUserTextOf(r).startsWith('[team-review-wake'))
  const leaderWakes = wakes.filter((r) => {
    const bodyText = JSON.stringify(r.body ?? '')
    return bodyText.includes('You are the A6 leader')
  })
  const notifications = mock.requests.filter((r) => lastUserTextOf(r).startsWith('[team-control')
    && lastUserTextOf(r).includes(CREATE_ROOT_A6))
  const resolveCalls = [...wakes, ...notifications].flatMap((r) => replyToolNames(r)).filter((n) => n === 'team_resolve_control')
  const memberReq = mock.requests.find((r) =>
    lastUserTextOf(r).includes(MK_A6MEM)
      && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_A6_MEMBER_DONE')
  const memberToolResults = memberReq === undefined
    ? []
    : toolMsgsOf(memberReq).map((m) => contentText(m?.content).slice(0, 1200))
  const execText = existsSync(FILE_A6_ALLOW) ? readFileSync(FILE_A6_ALLOW, 'utf8') : ''
  const executed = execText.includes(SUM_A6_ALLOW)
  const ledger = readControlLedger(CREATE_ROOT_A6)
  if (A6_HUMAN && humanLeg !== null) {
    humanDecision = ledger.decisions.filter((d) => d.requestId === humanLeg.requestId).at(-1) ?? null
    humanConsumption = ledger.consumptions.find((c) => c.requestId === humanLeg.requestId) ?? null
  }
  const pending = ledger.requests.filter((r) => !ledger.decisions.some((d) => d.requestId === r.requestId))
  const toolRequests = ledger.requests.filter((r) => r.toolName !== undefined)
  log(`A6: wakes=${wakes.length} leaderWakes=${leaderWakes.length} resolves=${resolveCalls.length} executed=${String(executed)} requests=${ledger.requests.length} decisions=${ledger.decisions.length} consumptions=${ledger.consumptions.length} pending=${pending.length}`)

  check('A6-2', A6_EXCEPTION
    ? 'the declared Leader exception produced a model-visible Leader notification, not an Officer wake'
    : 'the Member ask produced a model-visible Officer review wake',
  A6_EXCEPTION ? notifications.length > 0 && wakes.length === 0 : wakes.length > 0,
  `wakes=${wakes.length} notifications=${notifications.length} requests=${mock.requests.length}`)
  check('A6-3', A6_EXCEPTION
    ? 'the Leader resolved the exception leg through team_resolve_control'
    : 'the Officer resolved through team_resolve_control', resolveCalls.length > 0,
    `resolveCalls=${resolveCalls.length} wakeTools=${wakes.map((r) => replyToolNames(r).join(',')).join(' | ').slice(0, 500)}`)
  check('A6-4', A6_EXCEPTION
    ? 'the original Member command executed after the Leader exception allow'
    : 'the original Member command executed after the Officer allow', executed,
    `file=${FILE_A6_ALLOW} text=${JSON.stringify(execText.slice(0, 300))}`)
  check('A6-5', A6_EXCEPTION
    ? 'the Leader exception reached the Leader and no Officer review wake was created'
    : 'the Leader was not woken for a leg routed to the Officer',
  A6_EXCEPTION ? notifications.length > 0 && wakes.length === 0 : wakes.length > 0 && leaderWakes.length === 0,
  `wakes=${wakes.length} leaderWakes=${leaderWakes.length} notifications=${notifications.length}`)
  let exceptionOk = true
  if (A6_EXCEPTION) {
    const paRequest = ledger.requests.find((r) => r.actionName === 'team-tool-execute')
    const paDecision = paRequest === undefined ? undefined : ledger.decisions.filter((d) => d.requestId === paRequest.requestId).at(-1)
    exceptionOk = paRequest !== undefined && paDecision?.decision === 'allow' && paDecision?.decider?.role === 'leader'
    check('A6-10', 'the PA leg of a declared Leader exception was decided by the Leader, never the Officer', exceptionOk,
      `pa=${JSON.stringify(paRequest)} decision=${JSON.stringify(paDecision)} executed=${String(executed)}`)
    writeEvidence('a6-leader-exception.json', { paRequest, paDecision, notifications: notifications.length, wakes: wakes.length, executed, execText })
  }
  if (A6_HUMAN) {
    const humanOk = humanEscalation !== null && humanLeg !== null && executed
      && humanDecision?.decision === 'allow'
      && (humanDecision?.decider?.kind === 'human' || humanDecision?.decider?.role === 'human')
      && humanConsumption !== undefined
    const discoveryOk = humanDiscovery !== null && humanDiscovery.requestFactVisible === true
      && Number(humanDiscovery.pendingControlCount ?? 0) >= 1
    check('A6-21', 'the pending human leg is discoverable over the remote-only ledger/projection surface before any resolve', discoveryOk,
      `requestFact=${String(humanDiscovery?.requestFactVisible)} count=${String(humanDiscovery?.pendingControlCount)} occurrences=${String(humanDiscovery?.requestIdOccurrences)}`)
    check('A6-9', 'Officer escalated to the human leg; human allow executed the call once', humanOk,
      `escalation=${JSON.stringify(humanEscalation)} humanLeg=${JSON.stringify(humanLeg)} decision=${JSON.stringify(humanDecision)} consumed=${humanConsumption !== undefined} executed=${String(executed)}`)
    writeEvidence('a6-human.json', { escalation: humanEscalation, humanLeg, decision: humanDecision, consumption: humanConsumption, executed, execText })
  }
  check('A6-6', 'every durable request at the end is settled (no lost pending leg)', pending.length === 0,
    `requests=${ledger.requests.length} decisions=${ledger.decisions.length} consumptions=${ledger.consumptions.length} pending=${pending.map((r) => r.requestId).join(',')}`)

  // GAP-1 measurement: the NORMAL path's durable execution-result fact, read
  // from the same store row (`control-execution-result`) rather than from the
  // tool transcript. The original audit's reader omitted the factType, so a
  // written fact was invisible to it; this check reads it back explicitly.
  const paRequest = ledger.requests.filter((r) => r.actionName === 'team-tool-execute').at(-1)
  const paExecution = paRequest === undefined
    ? undefined
    : ledger.executionResults.find((e) => e.requestId === paRequest.requestId)
  const execResultOk = executed && paExecution?.outcome === 'succeeded'
  check('A6-27', 'the normal Member->Officer allow -> execute path writes a DURABLE `succeeded` execution-result fact for the PA request', execResultOk,
    `executed=${String(executed)} pa=${paRequest?.requestId ?? 'none'} callId=${paExecution?.callId ?? 'none'} outcome=${paExecution?.outcome ?? 'none'} facts=${ledger.executionResults.length}`)
  writeEvidence('a6-execution-result.json', {
    schema: 'a6-execution-result/1',
    pathRead: 'team_domain.json#tables.ledger[factType=control-execution-result]',
    paRequest: paRequest ?? null,
    paExecution: paExecution ?? null,
    allExecutionResults: ledger.executionResults,
    executed,
    execResultOk,
  })

  // ── PD42 same-Team ceiling arm (v5 `memberIoCeilings` on the SAME document
  // that carries `reviewRouting`) ──────────────────────────────────────────
  if (PD42_CELLINGS) {
    const facts = existsSync(A5SF_CONSULT_SINK)
      ? readFileSync(A5SF_CONSULT_SINK, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => {
          try { return JSON.parse(line) } catch { return null }
        }).filter((fact) => fact !== null)
      : []
    const writeDenies = facts.filter((fact) => fact.decision === 'deny' && fact.decidedBy === 'IO_WRITE_DENIED')
    const readDenies = facts.filter((fact) => fact.decision === 'deny' && fact.decidedBy === 'IO_READ_DENIED')
    const allows = facts.filter((fact) => fact.decision === 'allow')
    const insideText = existsSync(FILE_PD42_INSIDE) ? readFileSync(FILE_PD42_INSIDE, 'utf8') : ''
    const outsideExists = existsSync(FILE_PD42_OUTSIDE)
    check('PD42-1', 'a REAL fs write INSIDE the v5-compiled ceiling succeeded through the governed realm',
      insideText.includes(SUM_PD42_INSIDE) && allows.length > 0,
      `file=${FILE_PD42_INSIDE} text=${JSON.stringify(insideText.slice(0, 120))} allows=${allows.length} facts=${facts.length}`)
    check('PD42-2', 'a REAL fs write OUTSIDE the ceiling was refused `IO_WRITE_DENIED` with zero bytes on disk',
      writeDenies.length > 0 && !outsideExists,
      `denies=${writeDenies.length} outsideExists=${String(outsideExists)} path=${FILE_PD42_OUTSIDE} decidedBy=${writeDenies.map((f) => f.decidedBy).join(',')}`)
    check('PD42-3', 'a REAL fs read OUTSIDE the ceiling was refused `IO_READ_DENIED` with a guard fact',
      readDenies.length > 0,
      `denies=${readDenies.length} decidedBy=${readDenies.map((f) => f.decidedBy).join(',')} methods=${facts.map((f) => f.method).join(',')}`)
    check('PD42-4', 'the Member turn that produced the Officer-approved plane execution is the SAME turn that hit the ceiling',
      executed && insideText.includes(SUM_PD42_INSIDE) && writeDenies.length > 0,
      `executed=${String(executed)} wakes=${wakes.length} consumptions=${ledger.consumptions.length}`)
    writeEvidence('pd42-ceiling.json', {
      schema: 'pd42-ceiling/1',
      sink: A5SF_CONSULT_SINK,
      facts,
      insidePath: FILE_PD42_INSIDE,
      outsidePath: FILE_PD42_OUTSIDE,
      insideText,
      outsideExists,
      writeDenies: writeDenies.length,
      readDenies: readDenies.length,
      allows: allows.length,
    })
  }

  let execNegOk = true
  if (A6_EXEC_NEG) {
    // The Officer is the LIVE member instance (the worker's session may be
    // disposed after its delegated turn); its bash ask is still a Member ask
    // that routes through the plane PA and produces the same durable facts.
    const negMember = readMemberRows(CREATE_ROOT_A6).find((row) => row.templateId === 'officer' && typeof row.childSessionId === 'string')
    if (negMember === undefined) {
      execNegOk = false
      check('A6-28', 'a DENIED call writes NO execution-result and executes nothing', false, 'no Officer child session')
    } else {
      const beforeNeg = readControlLedger(CREATE_ROOT_A6)
      const known = new Set(beforeNeg.requests.map((r) => r.requestId))
      // ── DENY control ──
      a6DenyOnce = true
      const denyPrompt = await apiPrompt(booted.origin, booted.cookie, negMember.childSessionId, `${MK_A6DENY} ${RUN_STAMP}`, 'c1a6deny')
      log(`A6-DENY prompt status=${denyPrompt.status} body=${JSON.stringify(denyPrompt.body ?? denyPrompt).slice(0, 400)}`)
      const denyDeadline = Date.now() + 45_000
      let denyRequest = null
      const denyResponses = []
      const settledByNegative = new Set()
      while (Date.now() < denyDeadline) {
        const live = readControlLedger(CREATE_ROOT_A6)
        const fresh = live.requests.filter((r) => !known.has(r.requestId)
          && !settledByNegative.has(r.requestId)
          && !live.decisions.some((d) => d.requestId === r.requestId))
        for (const freshRow of fresh) {
          // The guard principal leg precedes the plane leg; let it through so
          // the PA request under test actually exists, then DENY that one.
          const decision = freshRow.actionName === 'team-tool-execute' ? 'deny' : 'allow'
          const res = await remoteCall(booted.origin, booted.cookie, 'team.resolveControl', {
            teamSessionId: CREATE_ROOT_A6,
            requestId: freshRow.requestId,
            decision,
            note: decision === 'deny'
              ? 'C1 A6 exec-result DENY negative control'
              : 'C1 A6 exec-result negative control: admit the guard leg so the PA leg exists',
          }, 'c1a6deny', 4)
          settledByNegative.add(freshRow.requestId)
          denyResponses.push({ requestId: freshRow.requestId, actionName: freshRow.actionName, decision, status: res.status, body: res.body ?? res })
          if (decision === 'deny') denyRequest = freshRow
        }
        if (denyRequest !== null) break
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      a6DenyOnce = false
      const denyDone = await waitForMock(
        mock,
        (r) => lastUserTextOf(r).includes(MK_A6DENY)
          && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_A6_DENY_DONE',
        120_000,
        'A6 deny control turn completed',
      )
      const afterDeny = readControlLedger(CREATE_ROOT_A6)
      const denyDecision = denyRequest === null ? null
        : afterDeny.decisions.filter((d) => d.requestId === denyRequest.requestId).at(-1) ?? null
      const denyConsumption = denyRequest === null ? null
        : afterDeny.consumptions.find((c) => c.requestId === denyRequest.requestId) ?? null
      const denyExecFacts = denyRequest === null ? []
        : afterDeny.executionResults.filter((e) => e.requestId === denyRequest.requestId)
      const denyFile = join(HOME, 'workspace', `c1-a6-deny-${RUN_STAMP}.txt`)
      const denyOk = denyRequest !== null && denyDone !== null
        && denyDecision?.decision === 'deny'
        && denyConsumption === null
        && denyExecFacts.length === 0
        && !existsSync(denyFile)
      execNegOk = execNegOk && denyOk
      check('A6-28', 'a DENIED call is refused after its durable decision: zero consumption, zero side effect, and NO execution-result fact', denyOk,
        `request=${denyRequest?.requestId ?? 'none'} decision=${denyDecision?.decision ?? 'none'} consumed=${denyConsumption !== null} execFacts=${denyExecFacts.length} file=${String(existsSync(denyFile))} done=${denyDone !== null}`)
      // ── THROW control ──
      const beforeThrow = readControlLedger(CREATE_ROOT_A6)
      const throwKnown = new Set(beforeThrow.requests.map((r) => r.requestId))
      const throwPrompt = await apiPrompt(booted.origin, booted.cookie, negMember.childSessionId, `${MK_A6THROW} ${RUN_STAMP}`, 'c1a6throw')
      log(`A6-THROW prompt status=${throwPrompt.status} body=${JSON.stringify(throwPrompt.body ?? throwPrompt).slice(0, 400)}`)
      // Resolve this leg deterministically over the remote channel (guard
      // allow, plane allow) so the throw is measured without a wake race.
      const throwResolveDeadline = Date.now() + 60_000
      let throwPlaneResolved = false
      const throwResponses = []
      while (Date.now() < throwResolveDeadline) {
        const live = readControlLedger(CREATE_ROOT_A6)
        const fresh = live.requests.filter((r) => !throwKnown.has(r.requestId)
          && !live.decisions.some((d) => d.requestId === r.requestId))
        for (const freshRow of fresh) {
          const res = await remoteCall(booted.origin, booted.cookie, 'team.resolveControl', {
            teamSessionId: CREATE_ROOT_A6,
            requestId: freshRow.requestId,
            decision: 'allow',
            note: 'C1 A6 exec-result THROW control: admit then let the backend throw',
          }, 'c1a6throw', 4)
          throwResponses.push({ requestId: freshRow.requestId, actionName: freshRow.actionName, status: res.status, body: res.body ?? res })
          if (freshRow.actionName === 'team-tool-execute') throwPlaneResolved = true
        }
        if (throwPlaneResolved) break
        await new Promise((resolve) => setTimeout(resolve, 200))
      }
      const throwDone = await waitForMock(
        mock,
        (r) => lastUserTextOf(r).includes(MK_A6THROW)
          && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_A6_THROW_DONE',
        90_000,
        'A6 throw control turn completed',
      )
      const afterThrow = readControlLedger(CREATE_ROOT_A6)
      const throwRequest = afterThrow.requests
        .filter((r) => r.actionName === 'team-tool-execute' && !throwKnown.has(r.requestId))
        .at(-1) ?? null
      const throwConsumption = throwRequest === null ? null
        : afterThrow.consumptions.find((c) => c.requestId === throwRequest.requestId) ?? null
      const throwFacts = throwRequest === null ? []
        : afterThrow.executionResults.filter((e) => e.requestId === throwRequest.requestId)
      const throwFact = throwFacts.at(-1) ?? null
      const throwOk = throwRequest !== null && throwDone !== null
        && throwConsumption !== null
        && throwFact?.outcome === 'failed'
        && !throwFacts.some((e) => e.outcome === 'succeeded')
        && readFileSync(FILE_A6_ALLOW, 'utf8').includes(SUM_A6_ALLOW)
      execNegOk = execNegOk && throwOk
      check('A6-29', 'a call whose backend THROWS/aborts after consumption records ONE terminal `failed` execution-result (never `succeeded`)', throwOk,
        `request=${throwRequest?.requestId ?? 'none'} consumed=${throwConsumption !== null} execFacts=${throwFacts.map((e) => e.outcome).join(',') || 'none'} callId=${throwFact?.callId ?? 'none'} done=${throwDone !== null}`)
      writeEvidence('a6-exec-negatives.json', {
        schema: 'a6-exec-negatives/1',
        deny: { request: denyRequest, decision: denyDecision, consumption: denyConsumption, executionResults: denyExecFacts, responses: denyResponses, fileExisted: existsSync(denyFile), done: denyDone !== null, ok: denyOk },
        throw: { request: throwRequest, consumption: throwConsumption, executionResults: throwFacts, responses: throwResponses, consumedBeforeDone: throwConsumption !== null, memberToolResults: throwDone === null ? [] : toolMsgsOf(throwDone).map((m) => contentText(m?.content).slice(0, 800)), ok: throwOk },
      })
    }
  }

  let selfReview = null
  let handoff = null
  if (A6_RECIPIENTS) {
    log('── A6-SELF: Officer self-ask -> Leader wake -> allow -> execute ──')
    selfReview = await runAlpha6SelfReview({ booted, mock })
    check('A6-7', 'Officer self-ask is routed to the Leader, not back to the Officer', selfReview.ok,
      `prompt=${String(selfReview.promptStatus)} notif=${String(selfReview.leaderNotifications)} selfReq=${String(selfReview.selfRequestId)} leaderDecided=${String(selfReview.leaderDecided)} executed=${String(selfReview.executed)}`)
    writeEvidence('a6-self-review.json', { ...selfReview, ledger: undefined })
  }
  if (A6_HANDOFF) {
    log('── A6-HANDOFF: Officer hands the PA leg to the Leader -> allow -> execute ──')
    handoff = await runAlpha6Handoff({ booted, mock })
    check('A6-8', 'Officer handoff made the Leader the successor recipient and the call executed once', handoff.ok,
      `requestId=${String(handoff.requestId)} transfer=${JSON.stringify(handoff.transfer)} decision=${JSON.stringify(handoff.decision)} executed=${String(handoff.executed)}`)
    writeEvidence('a6-handoff.json', { ...handoff, ledger: undefined })
  }

  writeEvidence('a6-officer.json', {
    schemaVersion: 5,
    runtime: 'real Host 0.2.0-rc.2',
    create: { rootSessionId: CREATE_ROOT_A6, status: create.status, result: create.body?.result ?? create.body },
    wakes: wakes.map((r) => ({
      seq: r.seq,
      userHead: lastUserTextOf(r).slice(0, 300),
      replyTools: replyToolNames(r),
      replyCalls: (r.reply?.toolCalls ?? []).map((t) => ({ name: t?.name, arguments: t?.arguments })),
      toolResults: toolMsgsOf(r).map((m) => contentText(m?.content).slice(0, 1200)),
    })),
    leaderWakeCount: leaderWakes.length,
    memberToolResults,
    memberDoneSeen: memberDone !== null,
    executed,
    execText,
    filePath: FILE_A6_ALLOW,
    ledger,
    selfReview: selfReview === null ? null : { ...selfReview, ledger: undefined },
    handoff: handoff === null ? null : { ...handoff, ledger: undefined },
  })
  return exceptionOk && (A6_EXCEPTION || wakes.length > 0) && resolveCalls.length > 0 && executed && pending.length === 0
    && execResultOk && execNegOk
    && (selfReview === null || selfReview.ok)
    && (handoff === null || handoff.ok)
}

let mockWakeSeq = 0
let a6HandoffPhase = false
let a6HumanPhase = A6_HUMAN || A6_STOP
let a6ResumePhase = false
let a6BusyDone = false
// The deny control defers the Officer's wake resolution: the kit resolves the
// durable request with `deny` over the remote channel instead, so the refusal
// is a real decision (not a mock shortcut).
let a6DenyOnce = false
function makeDecide() {
  return async function decide({ req }) {
    const firstMsg = messagesOf(req)[0]
    if (typeof firstMsg?.content === 'string'
      && (firstMsg.content.startsWith('Create a concise title') || firstMsg.content.startsWith('Generate the session title'))) {
      return { kind: 'text', content: 'C1 smoke session' }
    }
    const lastUser = lastUserTextOf(req)
    if (lastUser.startsWith('Generate the session title') || lastUser.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'C1 smoke session' }
    }
    if (lastUser.includes(MK_A6_HANDOFF) && !lastUser.startsWith('[team-review-wake')) {
      a6HandoffPhase = true
    }
    if (lastUser.includes('C1_A6_RESUME')) {
      a6ResumePhase = true
      return { kind: 'text', content: 'C1_A6_RESUMED' }
    }
    const tools = toolMsgsOf(req).length
    if (typeof process !== 'undefined' && process.env['JOINT_DEBUG_MOCK'] === '1') {
      try {
        appendFileSync(join(RUN_DIR, 'debug-mock.jsonl'), JSON.stringify({ at: new Date().toISOString(), lastUser: lastUser.slice(0, 160), tools, results: toolMsgsOf(req).map((m) => contentText(m?.content).slice(0, 600)) }) + '\n')
      } catch { /* best-effort */ }
    }
    // GAP-1 negative controls (worker turns; never wake turns).
    if (lastUser.includes(MK_A6DENY) && !lastUser.startsWith('[team-review-wake')) {
      return tools === 0
        ? toolCall('bash', bashArgs(`printf '%s' '${SUM_A6_DENY}' > c1-a6-deny-${RUN_STAMP}.txt`))
        : { kind: 'text', content: 'C1_A6_DENY_DONE' }
    }
    if (lastUser.includes(MK_A6THROW) && !lastUser.startsWith('[team-review-wake')) {
      // A cwd that does not exist: the anchored shape admits it, then the
      // confined spawn refuses at the cwd after admission + consumption (a
      // terminal backend outcome, never `succeeded`). The command is inert.
      return tools === 0
        ? toolCall('bash', { ...bashArgs('true'), cwd: `c1-a6-no-such-dir-${RUN_STAMP}` })
        : { kind: 'text', content: 'C1_A6_THROW_DONE' }
    }
    if (a6DenyOnce && lastUser.startsWith('[team-review-wake')) {
      // List (proves the leg is model-visible) but never resolve: the kit
      // denies the durable row over the remote channel.
      return tools === 0
        ? toolCall('team_list_pending_control', { root: CREATE_ROOT_A6 })
        : { kind: 'text', content: 'C1_A6_WAKE_DEFERRED' }
    }
    if (lastUser.includes(MK_A6_OFFICER_READY)) {
      return { kind: 'text', content: 'C1_A6_OFFICER_READY' }
    }
    // ── J07 (2026-11-12): round turns of the human-created goal. The round
    // instruction carries `Round: N/M`; the objective (and its marker) rides
    // in the same text. The mock ends the round without tools, so each round
    // is exactly one model request and the round COUNT is the product's own
    // continuation count.
    if (lastUser.includes('<goal_round>') && lastUser.includes(MK_J07)) {
      // The round number is IN the prompt (`Round: N/M`), so the trace does not
      // depend on how many earlier requests happen to be recorded yet.
      const roundNo = Number(/Round: (\d+)\//.exec(lastUser)?.[1] ?? 0)
      J07_ROUND_TRACE.push({ round: roundNo, at: new Date().toISOString() })
      if (J07_GATE.armed && roundNo >= 2) {
        J07_GATE.holding = true
        await new Promise((resolve) => {
          J07_GATE.release = () => {
            if (J07_GATE.releasedBy === null) J07_GATE.releasedBy = 'driver'
            resolve()
          }
          setTimeout(() => {
            if (J07_GATE.releasedBy === null) J07_GATE.releasedBy = 'timeout'
            resolve()
          }, 60_000)
        })
        J07_GATE.holding = false
      }
      return { kind: 'text', content: 'C1_J07_ROUND_OK' }
    }
    // ── J07: the DIRECT HUMAN relay turn on the goal worker. create_goal is
    // the product's own authority decision (hasDirectHumanInput); get/update
    // prove the goal is real and editable through the same tools.
    if (lastUser.includes(MK_J07)) {
      switch (tools) {
        case 0: return toolCall('create_goal', { objective: `C1_J07 human goal ${MK_J07}`, max_goal_rounds: 6 })
        case 1: return toolCall('get_goal', {})
        case 2: {
          const ref = lastGoalRefIn(req)
          return ref === null
            ? { kind: 'text', content: 'C1_J07_NO_GOAL_REF' }
            : toolCall('update_goal', {
                goal_id: ref.id,
                revision: ref.revision,
                action: 'edit',
                objective: `C1_J07 human goal ${MK_J07} edited`,
              })
        }
        default: return { kind: 'text', content: 'C1_J07_HUMAN_TURN_DONE' }
      }
    }
    // ── J08: the MACHINE relay turn. create_goal must be REFUSED with the
    // typed authority code; the governed bash on the SAME turn must still run
    // (the refusal is scoped to the goal operation, not the turn).
    if (lastUser.includes(MK_J08)) {
      switch (tools) {
        case 0: return toolCall('create_goal', { objective: `C1_J08 machine relay goal ${MK_J08}` })
        case 1: return toolCall('bash', bashArgs(`printf '%s' '${SUM_J08}' > ${FILE_J08}`))
        default: return { kind: 'text', content: 'C1_J08_DONE' }
      }
    }
    // ── J10: the long governed body. The first write proves the body STARTED
    // (the crash window is open); `sleep 60` keeps it in flight until the
    // driver SIGKILLs the Host.
    if (lastUser.includes(MK_J10)) {
      return tools === 0
        ? toolCall('bash', bashArgs(`echo body-started > ${FILE_J10_START} && sleep 60 && echo body-done > ${FILE_J10_DONE}`))
        : { kind: 'text', content: 'C1_J10_TURN_DONE' }
    }
    // ── J09: the two review asks that bracket the human Stop. Each is a
    // governed bash ask; the FIRST one's wake is held open by J09_GATE above.
    if (lastUser.includes(MK_J09) || lastUser.includes(MK_J09B)) {
      return tools === 0
        ? toolCall('bash', bashArgs(`printf '%s' '${lastUser.includes(MK_J09B) ? 'j09b' : 'j09'}' # ${lastUser.includes(MK_J09B) ? MK_J09B : MK_J09}`))
        : { kind: 'text', content: 'C1_J09_ASK_TURN_DONE' }
    }
    // (2c) keep the Officer BUSY on a long tool turn so the review wake is
    // ACCEPTED into the native Inbox but cannot be claimed yet.
    if (lastUser.includes('C1_A6_BUSY')) {
      // After the crash/restart this marker must retire fast: the queued
      // next-step wake cannot be claimed while a fresh 45 s turn runs.
      if (a6BusyDone) return { kind: 'text', content: 'C1_A6_BUSY_DONE' }
      return tools === 0
        ? toolCall('bash', bashArgs('sleep 45 && echo c1-a6-busy-done'))
        : { kind: 'text', content: 'C1_A6_BUSY_DONE' }
    }

    // (2a) the Alpha.6 Officer wake. Both the guard ask and the plane PA ask
    // arrive here; each turn lists and resolves exactly the id its text names
    // (or the first pending id for a merged wake).
    if (lastUser.startsWith('[team-review-wake')) {
      // A6-INBOX: hold the wake turn open long enough to SIGKILL the Host
      // AFTER the native Inbox claimed the message.
      if (A6_INBOX) await new Promise((resolve) => setTimeout(resolve, 30_000))
      // J09 (Sticky Stop): hold THIS wake until the driver has issued the
      // human Stop, so the Stop lands while the wake coordinator (the latch)
      // is LIVE — the documented precondition of the Sticky Stop marker. The
      // hard ceiling keeps a driver bug from hanging the run: a timeout is
      // recorded, never silently "released".
      if (J09_GATE.armed) {
        J09_GATE.holding = true
        await new Promise((resolve) => {
          J09_GATE.release = () => {
            if (J09_GATE.releasedBy === null) J09_GATE.releasedBy = 'driver'
            resolve()
          }
          setTimeout(() => {
            if (J09_GATE.releasedBy === null) J09_GATE.releasedBy = 'timeout'
            resolve()
          }, 45_000)
        })
        J09_GATE.holding = false
      }
      if (A6_TIMEOUT_MS > 0) return { kind: 'text', content: 'C1_A6_TIMEOUT_NO_DECISION' }
      if (A6_STICKY_STOP && !a6ResumePhase) return { kind: 'text', content: 'C1_A6_STICKY_STOP_PENDING' }
      const named = [...lastUser.matchAll(/^-\s*(ctrl-[A-Za-z0-9_-]+)\s*$/gm)][0]?.[1]
        ?? /requestId=([^\]\s]+)/.exec(lastUser)?.[1]
        ?? ''
      if (tools === 0) {
        return toolCall('team_list_pending_control', {
          rootSessionId: CREATE_ROOT_A6,
          requestToken: `c1-a6-list-${String(mockWakeSeq++)}`,
        })
      }
      if (tools === 1) {
        const listText = contentText(toolMsgsOf(req).slice(-1)[0]?.content ?? '')
        const first = /"requestId"\s*:\s*"([^"]+)"/.exec(listText)?.[1]
          ?? /requestId[=:]\s*([A-Za-z0-9_.:-]+)/.exec(listText)?.[1]
          ?? ''
        return toolCall('team_resolve_control', {
          rootSessionId: CREATE_ROOT_A6,
          requestToken: `c1-a6-res-${String(mockWakeSeq++)}`,
          requestId: named !== '' ? named : first,
          decision: a6HumanPhase ? 'escalate' : a6HandoffPhase ? 'handoff' : 'allow',
        })
      }
      return { kind: 'text', content: 'C1_A6_OFFICER_DONE' }
    }

    // (2b) the C1 notification turns (token-leading, no dedupe).
    if (lastUser.startsWith(NOTIF_PREFIX)) {
      if (a6DenyOnce) {
        // GAP-1 DENY control: the kit owns the decision for this window (the
        // durable row is denied over the remote channel). Ending the
        // notification turn without resolving keeps the race deterministic.
        return { kind: 'text', content: 'C1_NOTIF_DEFERRED' }
      }
      // S4 injection: the Z member-ask notification (summary carries the
      // side-effect file marker) is REFUSED at the model layer — the
      // durable request + the pending list are what make this recoverable.
      if (lastUser.includes(SUM_Z_FILE)) {
        return { kind: 'error', status: 500, message: 'c1 smoke S4: deliberate notification delivery failure', code: 'c1-smoke-s4' }
      }
      const requestId = extractNotifRequestId(lastUser)
      // Root + verdict from the summary markers (the renderer's bounded
      // summary line carries the command/summary text).
      let root = CREATE_ROOT_Y
      let decision = 'allow'
      if (lastUser.includes(CREATE_ROOT_A6)) {
        root = CREATE_ROOT_A6
        decision = 'allow'
      } else if (lastUser.includes(SUM_A6_ALLOW) || lastUser.includes(SUM_A6_SELF) || lastUser.includes(SUM_A6_HANDOFF)) {
        root = CREATE_ROOT_A6
        decision = 'allow'
      } else if (lastUser.includes(SUM_X_ALLOW) || lastUser.includes(SUM_X_DENY)) {
        root = CREATE_ROOT_X
        decision = lastUser.includes(SUM_X_DENY) ? 'deny' : 'allow'
      } else if (lastUser.includes(SUM_Z_S5)) {
        root = CREATE_ROOT_Z
      }
      if (tools === 0) {
        return toolCall('team_list_pending_control', {
          rootSessionId: root,
          requestToken: `c1-notif-list-${requestId ?? 'x'}`,
        })
      }
      if (tools === 1) {
        return toolCall('team_resolve_control', {
          rootSessionId: root,
          requestToken: `c1-notif-res-${requestId ?? 'x'}`,
          requestId: requestId ?? '',
          decision,
        })
      }
      return { kind: 'text', content: 'C1_NOTIF_DONE' }
    }

    // (3) member chains.
    if (lastUser.includes(MK_A6_HANDOFF)) {
      switch (tools) {
        case 0: return toolCall('bash', bashArgs(CMD_A6_HANDOFF))
        case 1: return { kind: 'text', content: 'C1_A6_HANDOFF_DONE' }
        default: return { kind: 'text', content: `C1_A6_HANDOFF_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_A6SELF)) {
      switch (tools) {
        case 0: return toolCall('bash', bashArgs(CMD_A6_SELF))
        case 1: return { kind: 'text', content: 'C1_A6_SELF_DONE' }
        default: return { kind: 'text', content: `C1_A6_SELF_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_A6MEM)) {
      // The busy marker must win the race: the Leader sends C1_A6_BUSY before
      // it delegates, but the Member's first model request can arrive before
      // that turn starts. Hold this request briefly so the Officer is already
      // in its long tool turn when the PA ask is steered into the Inbox.
      if (A6_INBOX_ACTIVE && !a6BusyDone) await new Promise((resolve) => setTimeout(resolve, 6000))
      // PD42 same-Team ceiling arm, on the SAME Member turn that already
      // produced the Officer-approved plane execution: a REAL fs write inside
      // the ceiling (must succeed + one ALLOW guard fact), a write outside it
      // (must be refused `IO_WRITE_DENIED`, zero bytes on disk) and a read
      // outside it (refused `IO_READ_DENIED`).
      if (PD42_CELLINGS) {
        if (tools === 1) return toolCall('write', { file_path: FILE_PD42_INSIDE, content: SUM_PD42_INSIDE })
        if (tools === 2) return toolCall('write', { file_path: FILE_PD42_OUTSIDE, content: SUM_PD42_OUTSIDE })
        if (tools === 3) return toolCall('read', { file_path: FILE_PD42_OUTSIDE })
        if (tools === 4) return { kind: 'text', content: 'C1_A6_MEMBER_DONE' }
      }
      switch (tools) {
        // PD41-ABORT-CLASS: the archive/lifecycle Stop reaches the call a few
        // async steps later than `session/cancel`, so the body must still be
        // ALIVE when the non-user cause lands. `C1_A6_STOP_CMD=linger` keeps
        // the canonical allow command (so the notification summary still
        // carries `SUM_A6_ALLOW` — the branch below routes on it) and just
        // makes the body sleep afterwards: the effect file lands and the body
        // is still running when the hook/cancel cause arrives. An instrument
        // choice about the STOPPED body, never a product change; the offset is
        // still `C1_A6_STOP_TIMING_MS`.
        case 0: return toolCall('bash', bashArgs(
          process.env['C1_A6_CRASH'] === 'body'
            ? CMD_A6_BODY
            : process.env['C1_A6_STOP_CMD'] === 'linger'
              ? `${CMD_A6_ALLOW} && sleep 20`
              : CMD_A6_ALLOW,
        ))
        case 1: return { kind: 'text', content: 'C1_A6_MEMBER_DONE' }
        default: return { kind: 'text', content: `C1_A6_MEMBER_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_A6_NEWWORKER)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT_A6,
          requestToken: `c1-a6-ho-worker-${RUN_STAMP}`,
          delegationTemplateId: 'worker',
          label: 'w-a6-ho',
        })
        case 1: {
          const wid = extractInstanceId(toolMsgsOf(req)[0]?.content)
          if (wid === null) return { kind: 'text', content: `C1_A6_HO_WORKER_EXTRACT_FAIL :: ${contentText(toolMsgsOf(req)[0]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_A6,
            requestToken: `c1-a6-ho-delegate-${RUN_STAMP}`,
            delegationInstanceId: wid,
            label: 'w-a6-ho',
            prompt: MK_A6_HANDOFF,
            async: true,
          })
        }
        case 2: return { kind: 'text', content: 'C1_A6_HO_DONE' }
        default: return { kind: 'text', content: `C1_A6_HO_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_A6) && JOINT_LEADER_IDLE && !A6_INBOX_ACTIVE) {
      // The JOINT driver owns provisioning; a second create here would put TWO
      // live Officers on the team and the assignment ports would (correctly)
      // refuse every delegated-Officer read.
      return { kind: 'text', content: 'C1_A6_LEADER_IDLE' }
    }
    if (lastUser.includes(MK_A6)) {
      if (A6_INBOX_ACTIVE) {
        switch (tools) {
          case 0: return toolCall('team_create_member', {
            rootSessionId: CREATE_ROOT_A6,
            requestToken: `c1-a6-officer-${RUN_STAMP}`,
            delegationTemplateId: 'officer',
            label: 'officer',
          })
          case 1: return toolCall('team_create_member', {
            rootSessionId: CREATE_ROOT_A6,
            requestToken: `c1-a6-worker-${RUN_STAMP}`,
            delegationTemplateId: 'worker',
            label: 'w-a6',
          })
          case 2: {
            const officerId = extractInstanceId(toolMsgsOf(req)[0]?.content)
            if (officerId === null) return { kind: 'text', content: `C1_A6_OFFICER_EXTRACT_FAIL :: ${contentText(toolMsgsOf(req)[0]?.content).slice(0, 300)}` }
            return toolCall('team_send_message', {
              rootSessionId: CREATE_ROOT_A6,
              requestToken: `c1-a6-busy-${RUN_STAMP}`,
              recipientInstanceId: officerId,
              body: 'C1_A6_BUSY',
            })
          }
          case 3: {
            const workerId = extractInstanceId(toolMsgsOf(req)[1]?.content)
            if (workerId === null) return { kind: 'text', content: `C1_A6_WORKER_EXTRACT_FAIL :: ${contentText(toolMsgsOf(req)[1]?.content).slice(0, 300)}` }
            return toolCall('team_delegate', {
              rootSessionId: CREATE_ROOT_A6,
              requestToken: `c1-a6-delegate-${RUN_STAMP}`,
              delegationInstanceId: workerId,
              label: 'w-a6',
              prompt: MK_A6MEM,
              async: true,
            })
          }
          case 4: return { kind: 'text', content: 'C1_A6_LEADER_DONE' }
          default: return { kind: 'text', content: `C1_A6_LEADER_FALLTHROUGH tools=${String(tools)}` }
        }
      }
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT_A6,
          requestToken: `c1-a6-officer-${RUN_STAMP}`,
          delegationTemplateId: 'officer',
          label: 'officer',
        })
        case 1: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT_A6,
          requestToken: `c1-a6-worker-${RUN_STAMP}`,
          delegationTemplateId: 'worker',
          label: 'w-a6',
        })
        case 2: {
          const workerId = extractInstanceId(toolMsgsOf(req)[1]?.content)
          if (workerId === null) return { kind: 'text', content: `C1_A6_WORKER_EXTRACT_FAIL :: ${contentText(toolMsgsOf(req)[1]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_A6,
            requestToken: `c1-a6-delegate-${RUN_STAMP}`,
            delegationInstanceId: workerId,
            label: 'w-a6',
            prompt: MK_A6MEM,
            async: true,
          })
        }
        case 3: return { kind: 'text', content: 'C1_A6_LEADER_DONE' }
        case 4: return { kind: 'text', content: 'C1_A6_LEADER_DONE' }
        default: return { kind: 'text', content: `C1_A6_LEADER_FALLTHROUGH tools=${String(tools)}` }
      }
    }
    if (lastUser.includes(MK_XMEM)) {
      switch (tools) {
        case 0: return toolCall('bash', bashArgs(CMD_X_ALLOW))
        case 1: return toolCall('bash', bashArgs(CMD_X_DENY))
        case 2: return { kind: 'text', content: 'C1_XMEM_DONE' }
        default: return { kind: 'text', content: `C1_XMEM_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_ZMEM)) {
      // ONE bash: it is blocked at the control wait until the recovered
      // allow arrives (S4); then it executes and the turn ends.
      switch (tools) {
        case 0: return toolCall('bash', bashArgs(CMD_Z))
        case 1: return { kind: 'text', content: 'C1_ZMEM_DONE' }
        default: return { kind: 'text', content: `C1_ZMEM_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_YMEM)) {
      switch (tools) {
        case 0: return toolCall('bash', bashArgs(CMD_Y))
        case 1: return { kind: 'text', content: 'C1_YMEM_DONE' }
        default: return { kind: 'text', content: `C1_YMEM_FALLTHROUGH tools=${tools}` }
      }
    }

    // (4) leader chains.
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'C1_DISC_DONE' }
    if (lastUser.includes(MK_X) || lastUser.includes(MK_Z)) {
      const isX = lastUser.includes(MK_X)
      const root = isX ? CREATE_ROOT_X : CREATE_ROOT_Z
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: root,
          requestToken: `c1-${isX ? 'x' : 'z'}-create-${RUN_STAMP}`,
          delegationTemplateId: 'worker',
          label: isX ? 'w-x' : 'w-z',
        })
        case 1: {
          const id = extractInstanceId(toolMsgsOf(req)[0]?.content)
          if (id === null) return { kind: 'text', content: `C1_${isX ? 'X' : 'Z'}_EXTRACT_FAIL :: ${contentText(toolMsgsOf(req)[0]?.content).slice(0, 300)}` }
          return toolCall('team_delegate', {
            rootSessionId: root,
            requestToken: `c1-${isX ? 'x' : 'z'}-delegate-${RUN_STAMP}`,
            delegationInstanceId: id,
            label: isX ? 'w-x' : 'w-z',
            prompt: isX ? MK_XMEM : MK_ZMEM,
            async: true,
          })
        }
        case 2: return { kind: 'text', content: isX ? 'C1_X_DONE' : 'C1_Z_DONE' }
        default: return { kind: 'text', content: `C1_${isX ? 'X' : 'Z'}_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_Y)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT_Y,
          requestToken: `c1-y-create-${RUN_STAMP}`,
          delegationTemplateId: 'worker',
          label: 'w-y',
        })
        case 1: {
          const id = extractInstanceId(toolMsgsOf(req)[0]?.content)
          if (id === null) return { kind: 'text', content: `C1_Y_EXTRACT_FAIL :: ${contentText(toolMsgsOf(req)[0]?.content).slice(0, 300)}` }
          // SYNC delegation (EXPLICIT async: false — the 2026-09-27
          // ruling made the sync path opt-in; no arg = async default) —
          // the S6 blocked Leader turn: this call does not return to the
          // model until the member's work unit settles, which requires a
          // control decision.
          return toolCall('team_delegate', {
            rootSessionId: CREATE_ROOT_Y,
            requestToken: `c1-y-delegate-${RUN_STAMP}`,
            delegationInstanceId: id,
            label: 'w-y',
            prompt: MK_YMEM,
            async: false,
          })
        }
        case 2: return { kind: 'text', content: 'C1_Y_DONE' }
        default: return { kind: 'text', content: `C1_Y_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_ZCHECK)) {
      // The explicit recovery + S5 chain (NO notification involved):
      // list pending (S4c) → resolve the member's ask (S4d) →
      // request_control probe (S5a) → request_control RETRY, same token
      // (S5a: same requestId, one row, no re-notify) → done.
      // The member instance id: the session history carries the
      // create_member result (a tool message from the Z leader chain).
      const allToolMsgs = messagesOf(req).filter(isToolResultMessage)
      const memberId = allToolMsgs.map((m) => extractInstanceId(m.content)).find((v) => v !== null) ?? null
      switch (tools) {
        case 0: return toolCall('team_list_pending_control', {
          rootSessionId: CREATE_ROOT_Z,
          requestToken: `c1-z-check-list-${RUN_STAMP}`,
        })
        case 1: {
          const requestId = extractListedRequestId(toolMsgsOf(req)[0]?.content)
          if (requestId === null) return { kind: 'text', content: `C1_ZCHECK_EXTRACT_FAIL :: ${contentText(toolMsgsOf(req)[0]?.content).slice(0, 300)}` }
          return toolCall('team_resolve_control', {
            rootSessionId: CREATE_ROOT_Z,
            requestToken: `c1-z-check-res-${RUN_STAMP}`,
            requestId,
            decision: 'allow',
          })
        }
        case 2:
          if (memberId === null) return { kind: 'text', content: 'C1_ZCHECK_MEMBERID_FAIL :: no instance id in history' }
          return toolCall('team_request_control', {
            rootSessionId: CREATE_ROOT_Z,
            requestToken: S5_TOKEN,
            kind: 'leader-approval',
            targetInstanceId: memberId,
            actionName: 'bash',
            toolName: 'bash',
            summary: `S5 idempotency probe ${SUM_Z_S5}`,
          })
        case 3:
          if (memberId === null) return { kind: 'text', content: 'C1_ZCHECK_MEMBERID_FAIL :: no instance id in history (retry)' }
          // THE idempotent retry: the SAME scope (identical arguments)
          // + the SAME requestToken (= the correlation) → the existing
          // row, no new request, no re-notification.
          return toolCall('team_request_control', {
            rootSessionId: CREATE_ROOT_Z,
            requestToken: S5_TOKEN,
            kind: 'leader-approval',
            targetInstanceId: memberId,
            actionName: 'bash',
            toolName: 'bash',
            summary: `S5 idempotency probe ${SUM_Z_S5}`,
          })
        case 4: return { kind: 'text', content: 'C1_Z_LEADER_DONE' }
        default: return { kind: 'text', content: `C1_ZCHECK_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_XCROSS)) {
      // RH2/RH3 (PR #20 closure): the X Leader — a DIFFERENT team's leader
      // on the same production domain — addresses Team Z's ledger:
      // list pending for ROOTZ → resolve ZREQ (decision allow) for ROOTZ.
      // The tool-layer caller-root gate must reject BOTH with
      // TEAM_TOOL_CALLER_ROOT_MISMATCH before any downstream effect;
      // ROOTZ/ZREQ ride in the trigger text (the oracle is a closure that
      // cannot see the later-computed zReq).
      const mRootZ = /ROOTZ=(\S+)/.exec(lastUser)
      const mZReq = /ZREQ=(\S+)/.exec(lastUser)
      const rootZ = mRootZ === null ? '' : mRootZ[1]
      const zReqId = mZReq === null ? '' : mZReq[1]
      switch (tools) {
        case 0: return toolCall('team_list_pending_control', {
          rootSessionId: rootZ,
          requestToken: `c1-xc-list-${RUN_STAMP}`,
        })
        case 1: return toolCall('team_resolve_control', {
          rootSessionId: rootZ,
          requestToken: `c1-xc-res-${RUN_STAMP}`,
          requestId: zReqId,
          decision: 'allow',
        })
        case 2: return { kind: 'text', content: 'C1_XCROSS_DONE' }
        default: return { kind: 'text', content: `C1_XCROSS_FALLTHROUGH tools=${tools}` }
      }
    }
    return { kind: 'text', content: 'C1_NOOP_DONE' }
  }
}

/** Poll the in-process mock request log for the first request matching pred. */
async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find(pred)
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) {
      log(`mock wait timed out: ${label} (requests=${mock.requests.length})`)
      return null
    }
    await new Promise((r) => setTimeout(r, 400))
  }
}

// ── durable control ledger (read-only) ─────────────────────────────────────

/**
 * The plugin's durable control ledger (storages/team_domain.json →
 * tables.ledger): the control service persists requests/decisions/
 * consumptions as ledger entries with factType
 * `control-request-recorded` / `control-decision-recorded` /
 * `control-allow-consumed`, each entry a JSON string
 * {factType, rootSessionId, payload, ...}. Read-only.
 */
function readControlLedger(root) {
  const out = { requests: [], decisions: [], consumptions: [], abandonments: [], transfers: [], escalations: [], executionResults: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const ledger = parsed?.tables?.ledger
    if (ledger === null || typeof ledger !== 'object') { out.error = 'no ledger table'; return out }
    for (const [k, v] of Object.entries(ledger)) {
      if (k === '__ledger_sequence_counter' || typeof v !== 'string') continue
      let entry
      try { entry = JSON.parse(v) } catch { continue }
      if (String(entry?.rootSessionId) !== root) continue
      const payload = entry?.payload ?? {}
      if (entry.factType === 'control-request-recorded') {
        // J06 (2026-11-11): the identity carry is part of the MEASURED row.
        // The original projection omitted it, so an arm could not tell a leg
        // that carried the bound-Blueprint identity from one that did not —
        // exactly the distinction the J06 verdict is about.
        out.requests.push({
          sequence: Number(k),
          factType: entry.factType,
          requestId: payload.requestId,
          kind: payload.kind,
          toolName: payload.toolName,
          actionName: payload.actionName,
          targetInstanceId: payload.targetInstanceId,
          status: payload.status,
          correlation: payload.correlation,
          approvalCaseId: payload.approvalCaseId,
          legOrdinal: payload.legOrdinal,
          reviewAuthority: payload.reviewAuthority,
          operationOwnerTemplateId: payload.operationOwnerTemplateId,
          operationToolOwner: payload.operationToolOwner,
          operationToolName: payload.operationToolName,
          operationToolDefinitionIdentity: payload.operationToolDefinitionIdentity,
          authorityGeneration: payload.authorityGeneration,
          blueprintContentHash: payload.blueprintContentHash,
          blueprintRevision: payload.blueprintRevision,
          perEffectRequiredAuthorities: payload.perEffectRequiredAuthorities,
          createdAt: entry.createdAt,
        })
      } else if (entry.factType === 'control-decision-recorded') {
        out.decisions.push({ sequence: Number(k), factType: entry.factType, requestId: payload.requestId, decision: payload.decision, decider: payload.decider, resolver: payload.resolver ?? payload.resolvedBy, reason: payload.reason, createdAt: entry.createdAt })
      } else if (entry.factType === 'control-allow-consumed') {
        out.consumptions.push({ sequence: Number(k), factType: entry.factType, requestId: payload.requestId, createdAt: entry.createdAt })
      } else if (entry.factType === 'control-request-abandoned') {
        out.abandonments.push({ sequence: Number(k), factType: entry.factType, requestId: payload.requestId, reason: payload.reason, createdAt: entry.createdAt })
      } else if (entry.factType === 'control-current-leg-transferred') {
        out.transfers.push({ sequence: Number(k), factType: entry.factType, ...payload })
      } else if (entry.factType === 'control-escalation-recorded') {
        out.escalations.push({ sequence: Number(k), factType: entry.factType, ...payload })
      } else if (entry.factType === 'control-execution-result') {
        // A6 closing-round fact, additive: the post-backend outcome observed
        // for one durable PA request. The ORIGINAL audit reader omitted this
        // branch, which is why a written fact was invisible to it.
        out.executionResults.push({ sequence: Number(k), factType: entry.factType, requestId: payload.requestId, callId: payload.callId, outcome: payload.outcome, recordedAt: payload.recordedAt, createdAt: entry.createdAt })
      }
    }
  } catch (error) {
    out.error = String(error?.message ?? error)
  }
  return out
}

/**
 * WP3-FENCE-TIMING helper: the durable ledger sequence counter
 * (`__ledger_sequence_counter`), i.e. the highest sequence the service has
 * ALLOCATED (not necessarily written). Reading it lets the driver prove that
 * a fence trip BURNED exactly one sequence: the trip allocates the
 * consumption sequence and then commits the abandonment at its own, so the
 * counter is `decisionSequence + 2` while the ledger has no row at
 * `decisionSequence + 1`.
 */
function readLedgerCounter() {
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const raw = parsed?.tables?.ledger?.['__ledger_sequence_counter']
    if (typeof raw !== 'string') return null
    const counter = JSON.parse(raw)
    return typeof counter?.value === 'number' ? counter.value : null
  } catch { return null }
}

/** Sleep until the given wall-clock ms; the last ~12 ms are a spin so the
 *  sub-millisecond offsets the fence instrument steers on are not rounded by
 *  the timer wheel. */
async function sleepUntilWallClock(targetMs) {
  const coarse = targetMs - Date.now() - 12
  if (coarse > 0) await new Promise((resolve) => setTimeout(resolve, coarse))
  while (Date.now() < targetMs) { /* spin the last few ms */ }
}

/** The durable member rows for one root (the real child sessions). */
function readMemberRows(root) {  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    const rows = parsed?.tables?.member_instances
    if (rows === null || typeof rows !== 'object') return []
    const out = []
    for (const v of Object.values(rows)) {
      if (typeof v !== 'string') continue
      let row
      try { row = JSON.parse(v) } catch { continue }
      if (String(row?.rootSessionId) === root) out.push(row)
    }
    return out
  } catch { return [] }
}

/** Drive the Officer's OWN bash ask and prove the self-ask reached the Leader. */
async function runAlpha6SelfReview({ booted, mock }) {
  const officer = readMemberRows(CREATE_ROOT_A6).find((row) => row.templateId === 'officer' && typeof row.childSessionId === 'string')
  if (officer === undefined) return { ok: false, reason: 'no Officer child session', leaderWakes: 0, officerWakes: 0, executed: false }
  const before = mock.requests.length
  const prompt = await apiPrompt(booted.origin, booted.cookie, officer.childSessionId, MK_A6SELF, 'c1a6self')
  const done = await waitForMock(
    mock,
    (r) => r.body !== null && lastUserTextOf(r).includes(MK_A6SELF)
      && replyToolNames(r).length === 0
      && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_A6_SELF_DONE',
    Number(process.env['C1_A6_WAIT_MS'] ?? 300_000),
    'Officer self-ask done after Leader allow + plane execute',
  )
  const after = mock.requests.slice(before)
  writeEvidence('a6-self-mock.json', after.map((r) => ({
    seq: r.seq,
    lastUser: lastUserTextOf(r).slice(0, 900),
    reply: r.reply,
    toolResults: toolMsgsOf(r).map((m) => contentText(m?.content).slice(0, 1200)),
  })))
  const wakes = after.filter((r) => lastUserTextOf(r).startsWith('[team-review-wake'))
  const leaderWakes = wakes.filter((r) => JSON.stringify(r.body ?? '').includes('You are the A6 leader'))
  const officerWakes = wakes.filter((r) => JSON.stringify(r.body ?? '').includes('C1 smoke Officer'))
  const execText = existsSync(FILE_A6_SELF) ? readFileSync(FILE_A6_SELF, 'utf8') : ''
  const executed = execText.includes(SUM_A6_SELF)
  const ledger = readControlLedger(CREATE_ROOT_A6)
  const selfAsk = ledger.requests.filter((r) => r.targetInstanceId === officer.instanceId && r.actionName === 'team-tool-execute').at(-1)
  const selfDecision = selfAsk === undefined ? undefined : ledger.decisions.find((d) => d.requestId === selfAsk.requestId)
  // The Leader recipient is the LEGACY notification seam for a legal
  // Leader route (not the Officer review wake); count those turns too.
  const leaderNotifications = after.filter((r) =>
    lastUserTextOf(r).startsWith('[team-control') && JSON.stringify(r.body ?? '').includes('You are the A6 leader'))
  const leaderDecided = selfDecision?.decider?.role === 'leader'
  return {
    ok: prompt.status === 200 && done !== null && executed && selfAsk !== undefined
      && leaderDecided && leaderNotifications.length > 0,
    promptStatus: prompt.status,
    doneSeen: done !== null,
    wakes: wakes.length,
    leaderWakes: leaderWakes.length,
    officerWakes: officerWakes.length,
    leaderNotifications: leaderNotifications.length,
    selfRequestId: selfAsk?.requestId ?? null,
    selfActionName: selfAsk?.actionName ?? null,
    selfDecision: selfDecision ?? null,
    leaderDecided,
    executed,
    execText,
    filePath: FILE_A6_SELF,
    requestId: selfAsk?.requestId ?? null,
    ledger,
  }
}

/** The Officer hands the PA leg to the Leader; the Leader must be the
 *  successor recipient and the original call executes once after its allow. */
async function runAlpha6Handoff({ booted, mock }) {
  const before = mock.requests.length
  // A settled worker cannot resume its suspended tool call after approval, so
  // the Leader creates a FRESH worker for the handoff leg.
  const kick = await apiPrompt(booted.origin, booted.cookie, CREATE_ROOT_A6, MK_A6_NEWWORKER, 'c1a6ho-kick')
  let worker = null
  const workerDeadline = Date.now() + 60_000
  while (Date.now() < workerDeadline && worker === null) {
    worker = readMemberRows(CREATE_ROOT_A6).find((row) => row.label === 'w-a6-ho' && typeof row.childSessionId === 'string') ?? null
    if (worker === null) await new Promise((resolve) => setTimeout(resolve, 200))
  }
  if (worker === null) return { ok: false, reason: 'no fresh handoff worker session', kickStatus: kick.status, executed: false, leaderNotifications: 0 }
  const prompt = kick
  const done = await waitForMock(
    mock,
    (r) => r.body !== null && lastUserTextOf(r).includes(MK_A6_HANDOFF)
      && replyToolNames(r).length === 0
      && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_A6_HANDOFF_DONE',
    Number(process.env['C1_A6_WAIT_MS'] ?? 300_000),
    'handoff call done after Leader allow + plane execute',
  )
  const after = mock.requests.slice(before)
  writeEvidence('a6-handoff-mock.json', after.map((r) => ({
    seq: r.seq,
    lastUser: lastUserTextOf(r).slice(0, 900),
    reply: r.reply,
    toolResults: toolMsgsOf(r).map((m) => contentText(m?.content).slice(0, 1200)),
  })))
  const leaderNotifications = after.filter((r) =>
    lastUserTextOf(r).startsWith('[team-control') && JSON.stringify(r.body ?? '').includes('You are the A6 leader'))
  const ledger = readControlLedger(CREATE_ROOT_A6)
  const ask = ledger.requests.filter((r) => r.targetInstanceId === worker.instanceId && r.actionName === 'team-tool-execute').at(-1)
  const transfer = ask === undefined ? undefined : ledger.transfers.find((t) => t.currentLegRequestId === ask.requestId)
  const decision = ask === undefined ? undefined : ledger.decisions.find((d) => d.requestId === ask.requestId)
  const execText = existsSync(FILE_A6_HANDOFF) ? readFileSync(FILE_A6_HANDOFF, 'utf8') : ''
  const executed = execText.includes(SUM_A6_HANDOFF)
  const ok = prompt.status === 200 && done !== null && executed
    && transfer !== undefined && transfer.target === 'leader' && transfer.cause === 'officer-handoff'
    && decision?.decider?.role === 'leader' && leaderNotifications.length > 0
  return {
    ok,
    promptStatus: prompt.status,
    doneSeen: done !== null,
    requestId: ask?.requestId ?? null,
    transfer: transfer ?? null,
    decision: decision ?? null,
    leaderNotifications: leaderNotifications.length,
    executed,
    execText,
    filePath: FILE_A6_HANDOFF,
    ledger,
  }
}

/** The scripted human resolution (the boot root is the host-known operator
 *  = human; the member's ask is leader-approval → resolvable by Leader OR
 *  human — the Leader is busy in S6, so the human resolves). */
async function scriptedHumanApproval(origin, cookie, root, requestId) {
  const res = await remoteCall(origin, cookie, 'team.resolveControl', {
    teamSessionId: root,
    requestId,
    decision: 'allow',
    note: 'c1 smoke S6 scripted human resolution (the Leader is blocked in the sync delegate)',
  }, 'c1s6', 4)
  writeEvidence('s6-approval-response.json', res.body ?? res)
  return res
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`c1 real-host smoke — stamp ${RUN_STAMP}`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${TESTUSE} @ ${HOST_BASELINE_SHA.slice(0, 10)}`)
  log(`evidence=${RUN_DIR}`)

  preflight()
  const hostPort = await pickHostPort()
  if (!(await portFree(MOCK_PORT))) dieFatal(`mock port ${MOCK_PORT} busy`)
  log(`ports: host=${hostPort} mock=${MOCK_PORT}`)

  // Zero-touch record: the live instances (read-only pre probe).
  const preStable = {
    p3080: await probeStableInstance('http://127.0.0.1:3080/'),
    p3180: await probeStableInstance('http://127.0.0.1:3180/'),
  }
  writeEvidence('pre-stable-probe.json', preStable)
  log(`stable pre-probe: 3080=${preStable.p3080.status} 3180=${preStable.p3180.status}`)

  // World materialization.
  rmSync(HOME, { recursive: true, force: true })
  rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
  mkdirSync(WORKSPACE, { recursive: true })
  log('world materialized (scratch workspace; the preset rides the patch layer written at boot)')

  // Mock model.
  const mockLog = join(RUN_DIR, 'mock.log')
  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: makeDecide(),
    log: (l) => {
      try { writeFileSync(mockLog, l + '\n', { flag: 'a' }) } catch { /* best-effort */ }
    },
  })
  log(`mock model listening on ${mock.port}`)

  const instanceLog = join(RUN_DIR, 'instance.log')
  writeFileSync(instanceLog, '', { flag: 'w' })

  // ── the shared zero-boot preflight (owner ruling 2026-11-11) ─────────────
  // No Host is spawned unless THIS run's declared facts grade PASS. The JSON
  // is written before the start, so a run directory without it is a driver
  // defect rather than an environment fact.
  const hostPin = spawnSync('git', ['-C', TESTUSE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() ?? ''
  const hostPorcelain = spawnSync('git', ['-C', TESTUSE, 'status', '--porcelain'], { encoding: 'utf8' }).stdout ?? ''
  const bootPreflight = await runBootPreflight({
    env: { required: [], provided: process.env },
    hostPin: { declared: TEST_USE_BASELINE_SHA, actual: hostPin },
    candidate: {
      expectedSha: spawnSync('git', ['-C', WORKTREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() ?? '',
      actualSha: spawnSync('git', ['-C', WORKTREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout?.trim() ?? '',
      source: 'DEV-LIVE branch head (not a frozen candidate)',
    },
    modalities: [{ id: 'text', supported: true }, { id: 'tool-call', supported: true }],
    officer: { required: true, count: 1, arm: 'J01' },
    ports: [
      { port: hostPort, free: (await probeStableInstance(`http://127.0.0.1:${hostPort}/__p6t6/health`)).status === 'unreachable' },
      { port: mock.port, free: true },
    ],
    world: { dshHome: HOME, workspaceRoot: WORKTREE, exists: false },
    isSanctionedPort: isSanctionedTestPort,
    arms: { selected: JOINT_ARMS.map(([id]) => id), known: JOINT_ARMS.map(([id]) => id) },
  })
  writeEvidence('boot-preflight.json', bootPreflight)
  if (bootPreflight.verdict !== 'PASS') {
    log(`PREFLIGHT ${bootPreflight.verdict}: ${JSON.stringify(bootPreflight.blocking ?? []).slice(0, 1200)}`)
    writeEvidence('summary.json', { runStamp: RUN_STAMP, preflight: bootPreflight })
  }
  assertBootPreflight(bootPreflight)
  writeEvidence('preflight-host-clean.json', { declared: TEST_USE_BASELINE_SHA, actual: hostPin, porcelain: hostPorcelain.trim() })

  const booted = await bootHost({ port: hostPort, home: HOME, mockPort: mock.port, instanceLog })
  const host = booted.host

  const FAILS = []
  const fail = (id) => FAILS.push(id)

  try {
    // ── L0: discovery (the boot Leader's model-facing tool surface) ──
    log('── L0: discovery ──')
    const discPrompt = await apiPrompt(booted.origin, booted.cookie, ROOT, MK_DISC)
    if (discPrompt.status !== 200) fail('L0')
    const discReq = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_DISC) && (r.body?.tools ?? []).length > 0, 120_000, 'DISC model request')
    if (discReq === null) {
      fail('L0')
      check('L0', 'discovery model request observed', false, `apiPrompt=${JSON.stringify(discPrompt.body).slice(0, 300)}`)
    } else {
      const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t)).sort()
      writeEvidence('l0-surface.json', { surface, discRequest: { seq: discReq.seq, tools: surface } })
      log(`discovery surface (${surface.length} tools): ${surface.join(', ')}`)
      const denyList = surface.filter(
        (n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n),
      )
      // PD42: the MEMBER surface is the shipped governed preset, whose extra
      // faces (goal/plan/jobs/search/skill/present) the smoke discovery turn
      // never sees. They are removed from the A6 worker/officer/leader
      // templates through `builtinToolDeny` so the A2C-2 coverage gate passes;
      // the Goal arm runs on its OWN template, which declares no permissions
      // policy and therefore keeps them.
      for (const name of (PD42_CELLINGS ? PD42_GOVERNED_EXTRA_TOOLS : [])) {
        if (!denyList.includes(name)) denyList.push(name)
      }
      const missingTeam = TEAM_TOOL_CATALOG.filter((n) => !surface.includes(n))
      check('L0', 'discovery captured the surface; read + bash present; the 12-tool C1 catalog is the closed team set (the boot leader inherits the full catalog — the saved blueprints deny the non-team remainder)',
        surface.includes('read') && surface.includes('bash') && missingTeam.length === 0,
        `surface=${surface.length} missingTeam=[${missingTeam.join(',')}] denyList=[${denyList.join(',')}]`)
      if (discReq.reply === undefined || discReq.reply.kind !== 'text' || discReq.reply.content !== 'C1_DISC_DONE') {
        writeEvidence('l0-diagnostic-mock.json', mock.requests.slice(-4).map((r) => ({ seq: r.seq, reply: r.reply })))
        throw new Error(`L0 diagnostic abort: the DISC request (seq ${discReq.seq}) got reply ${JSON.stringify(discReq.reply).slice(0, 200)}`)
      }
      if (ALPHA6_BOOT_ONLY) {
        const wakeDir = join(HOME, 'alpha6-wake-intents')
        writeEvidence('a6-boot.json', {
          schemaVersion: 5,
          runtime: 'real Host 0.2.0-rc.2',
          config: { alpha6ReviewRouting: true, alpha6WakeIntentPath: wakeDir },
          toolCount: booted.health.body?.toolCount ?? null,
          surface,
          wakeSeamPresent: true,
          note: 'The Host booted the opted-in v5 Team: the durable intent path was configured and the live wake seam existed, otherwise the plugin refuses the boot.',
        })
        check('A6-BOOT', 'the real Host boots the opted-in v5 Alpha.6 row (durable wake-intent path + live wake seam)', true,
          `toolCount=${String(booted.health.body?.toolCount)}`)
        log('── A6-BOOT complete: stopping before the legacy Leader-approval arc ──')
        stopHost(host)
        await mock.close()
        if (!FLAG_KEEP) {
          rmSync(HOME, { recursive: true, force: true })
          rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
        }
        process.exit(0)
      }
      // The saved blueprints (the deny list needs the live surface).
      writeFileSync(join(BLUEPRINT_DIR, 'c1-x.yaml'), savedBlueprintYaml(BP_X_ID, `You are the leader of the C1 smoke X team. ${MK_X}`, `You are worker-x of the C1 smoke X team. ${MK_XMEM}`, denyList))
      writeFileSync(join(BLUEPRINT_DIR, 'c1-y.yaml'), savedBlueprintYaml(BP_Y_ID, `You are the leader of the C1 smoke Y team. ${MK_Y}`, `You are worker-y of the C1 smoke Y team. ${MK_YMEM}`, denyList))
      writeFileSync(join(BLUEPRINT_DIR, 'c1-z.yaml'), savedBlueprintYaml(BP_Z_ID, `You are the leader of the C1 smoke Z team. ${MK_Z}`, `You are worker-z of the C1 smoke Z team. ${MK_ZMEM}`, denyList))
      log(`saved blueprints X + Y + Z written (deny list = ${denyList.length} names)`)

      if (JOINT) {
        const ok = await runJointScenario({ booted, mock, denyList, host })
        stopHost(LIVE_HOST_AFTER_RESTART ?? host)
        await mock.close()
        if (!FLAG_KEEP) {
          rmSync(HOME, { recursive: true, force: true })
          rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
        }
        writeEvidence('teardown.json', {
          dshHome: HOME,
          dshHomeRemoved: !FLAG_KEEP && !existsSync(HOME),
          blueprintDirRemoved: !FLAG_KEEP && !existsSync(BLUEPRINT_DIR),
          hostStopped: true,
          // J10 cold-boots a replacement; `host.exitInfo` on the ORIGINAL only
          // records the SIGKILL, so name the process that teardown stopped.
          hostExit: (LIVE_HOST_AFTER_RESTART ?? host).exitInfo ?? null,
          restartHostStopped: LIVE_HOST_AFTER_RESTART !== null,
          mockClosed: true,
          keptForDebug: FLAG_KEEP,
        })
        log(`teardown: DSH_HOME removed=${String(!FLAG_KEEP && !existsSync(HOME))} host stopped=true`)
        process.exit(ok ? 0 : 2)
      }
    }

    if (FAILS.includes('L0')) throw new Error('L0 failed — aborting before team.create')

    // ── S1+S2+S3: team X (async delegation — the liveness path) ─────────
    log('── S1–S3: team X (async delegate; the liveness arc) ──')
    const createX = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_X,
      blueprintId: BP_X_ID,
      initialWork: { prompt: MK_X },
    }, 'c1x')
    writeEvidence('s1-team-create-x.json', createX.body ?? createX)
    const createXOk = createX.status === 200
      && createX.body?.result?.ok === true
      && createX.body?.result?.value?.data?.path === 'fresh-root'
    check('S1.0', 'team.create (X) succeeds on the fresh root', createXOk, `status=${createX.status} body=${JSON.stringify(createX.body ?? createX).slice(0, 400)}`)
    if (!createXOk) fail('S1.0')

    // X leader chain: create_member → delegate(async) → done.
    const xDone = await waitForMock(mock, (r) => r.body !== null && userTextOf(r).includes(MK_X) && lastUserTextOf(r).includes(MK_X) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_X_DONE', 300_000, 'X leader chain final')
    if (xDone === null) {
      fail('S1')
      check('S1', 'the X leader chain completed (create + async delegate admitted)', false, `requests=${mock.requests.length}`)
    }

    // The member's bash (the allow-ask) reaches the durable request.
    let xLedger = { requests: [], decisions: [], consumptions: [] }
    const xReqDeadline = Date.now() + 90_000
    for (;;) {
      xLedger = readControlLedger(CREATE_ROOT_X)
      if (xLedger.requests.length >= 1) break
      if (Date.now() >= xReqDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    // At this moment EXACTLY one request exists (the member's first ask).
    const xAllowReq = xLedger.requests.find((q) => q.kind === 'leader-approval')
    writeEvidence('s1-x-ledger-pending.json', xLedger)
    const xAllowRequestId = xAllowReq?.requestId ?? null
    check('S1b', 'the member bash ask created a durable leader-approval request (pending)', xAllowRequestId !== null,
      `requests=${JSON.stringify(xLedger.requests).slice(0, 300)}`)
    if (xAllowRequestId === null) fail('S1b')

    // S1: the LEADER's notification turn — the mock calls
    // team_list_pending_control; the EXACT requestId must appear in the
    // tool result.
    const xNotif = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_X_ALLOW), 120_000, 'X notification turn start')
    if (xNotif === null) {
      fail('S1')
      check('S1c', 'the C1 liveness notification reached the Leader as a model-visible input turn', false, `requests=${mock.requests.length}`)
    } else {
      writeEvidence('s1-x-notification-request.json', { seq: xNotif.seq, text: lastUserTextOf(xNotif).slice(0, 1200) })
      check('S1c', 'the C1 liveness notification reached the Leader (token-leading, the exact requestId + both approval-loop tools named)',
        lastUserTextOf(xNotif).includes('team_list_pending_control') && lastUserTextOf(xNotif).includes('team_resolve_control')
        && lastUserTextOf(xNotif).includes(xAllowRequestId ?? ''),
        `text=${lastUserTextOf(xNotif).slice(0, 200)}`)
      if (!lastUserTextOf(xNotif).includes(xAllowRequestId ?? '')) fail('S1c')
      const xNotifList = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_X_ALLOW) && toolMsgsOf(r).length === 1, 120_000, 'X notification list result')
      if (xNotifList === null) {
        fail('S1')
        check('S1d', 'S1: the Leader called team_list_pending_control (tool result observed)', false, `requests=${mock.requests.length}`)
      } else {
        const listResult = contentText(toolMsgsOf(xNotifList).pop()?.content ?? '')
        writeEvidence('s1-x-list-result.json', { seq: xNotifList.seq, result: listResult.slice(0, 2000) })
        check('S1d', 'S1: team_list_pending_control returned the EXACT pending requestId',
          listResult.includes(xAllowRequestId ?? '\u0000'),
          `result=${listResult.slice(0, 300)}`)
        if (!listResult.includes(xAllowRequestId ?? '\u0000')) fail('S1d')
      }
    }

    // S2: the leader resolves allow (the same model-facing tool); the
    // member's bash EXECUTES; one consumption fact.
    const xNotifDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_X_ALLOW) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_NOTIF_DONE', 120_000, 'X notification turn done')
    if (xNotifDone === null) {
      fail('S2')
      check('S2a', 'the X leader resolved the allow through team_resolve_control (turn completed)', false, `requests=${mock.requests.length}`)
    }
    const xExec = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_XMEM) && toolMsgsOf(r).length === 1, 240_000, 'X member bash #1 result')
    if (xExec === null) {
      fail('S2')
      check('S2b', 'S2: the member bash executed after the allow (tool result returned)', false, `requests=${mock.requests.length}`)
    } else {
      const execResult = contentText(toolMsgsOf(xExec).pop()?.content ?? '')
      writeEvidence('s2-x-bash-result.json', { seq: xExec.seq, result: execResult.slice(0, 800) })
      check('S2b', 'S2: the member bash EXECUTED after the Leader allow (guard passed, output returned)',
        execResult.includes('x-allow-executed') && !/blocked|denied|pending/i.test(execResult.slice(0, 400)),
        `result=${execResult.slice(0, 200)}`)
      if (!execResult.includes('x-allow-executed')) fail('S2b')
      check('S2c', 'S2: the side effect landed (the allow file exists)', existsSync(FILE_X_ALLOW), `file=${FILE_X_ALLOW}`)
      if (!existsSync(FILE_X_ALLOW)) fail('S2c')
    }

    // S3: the member's SECOND bash (the deny-ask) — a second durable
    // request, a second notification, the leader resolves DENY.
    const xDenyNotif = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_X_DENY), 240_000, 'X deny notification')
    const xLedger2 = readControlLedger(CREATE_ROOT_X)
    writeEvidence('s3-x-ledger-deny-pending.json', xLedger2)
    const xDenyReq = xLedger2.requests.find((q) => q.requestId !== xAllowRequestId && q.kind === 'leader-approval')
    if (xDenyNotif === null || xDenyReq === undefined) {
      fail('S3')
      check('S3a', 'S3: the second member ask created a second durable request + notification', false,
        `requests=${JSON.stringify(xLedger2.requests).slice(0, 300)} notif=${xDenyNotif === null ? 'none' : xDenyNotif.seq}`)
    } else {
      check('S3a', 'S3: the second member ask created a second durable request + notification', true, `requestId=${xDenyReq.requestId} notifSeq=${xDenyNotif.seq}`)
      const xDenyDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_X_DENY) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_NOTIF_DONE', 120_000, 'X deny notification done')
      const xDenyResult = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_XMEM) && toolMsgsOf(r).length === 2, 240_000, 'X member bash #2 result')
      if (xDenyDone === null || xDenyResult === null) {
        fail('S3')
        check('S3b', 'S3: the Leader resolved deny and the member received the verdict', false, `requests=${mock.requests.length}`)
      } else {
        const denyResult = contentText(toolMsgsOf(xDenyResult).pop()?.content ?? '')
        writeEvidence('s3-x-deny-result.json', { seq: xDenyResult.seq, result: denyResult.slice(0, 800) })
        check('S3b', 'S3: the denied member bash was BLOCKED (verdict returned, no output)',
          /blocked|denied|deny|pending/i.test(denyResult.slice(0, 400)) && !denyResult.includes('x-deny-executed'),
          `result=${denyResult.slice(0, 200)}`)
        if (!/blocked|denied|deny|pending/i.test(denyResult.slice(0, 400))) fail('S3b')
        check('S3c', 'S3: the denied bash had ZERO side effects (the deny file does NOT exist)', !existsSync(FILE_X_DENY), `file=${FILE_X_DENY}`)
        if (existsSync(FILE_X_DENY)) fail('S3c')
      }
    }

    // S2/S3 ledger closure: decisions + exactly one consumption for the
    // ALLOWED request (the denied one is never consumed).
    const xLedgerFinal = readControlLedger(CREATE_ROOT_X)
    writeEvidence('s2s3-x-ledger-final.json', xLedgerFinal)
    const xAllowConsumptions = xLedgerFinal.consumptions.filter((c) => c.requestId === xAllowRequestId)
    const xDenyConsumptions = xLedgerFinal.consumptions.filter((c) => c.requestId !== undefined && c.requestId !== xAllowRequestId)
    const xAllowDecision = xLedgerFinal.decisions.find((d) => d.requestId === xAllowRequestId)
    const xDenyDecision = xLedgerFinal.decisions.find((d) => d.requestId !== undefined && d.requestId !== xAllowRequestId)
    check('S2d', 'S2: exactly ONE consumption fact for the allowed request (allow-once)', xAllowConsumptions.length === 1,
      `consumptions=${JSON.stringify(xLedgerFinal.consumptions).slice(0, 300)}`)
    if (xAllowConsumptions.length !== 1) fail('S2d')
    check('S3d', 'S3: the denied request has a deny decision and ZERO consumptions',
      xDenyDecision !== undefined && String(xDenyDecision.decision).toLowerCase().includes('den') && xDenyConsumptions.length === 0,
      `denyDecision=${JSON.stringify(xDenyDecision) ?? 'none'} denyConsumptions=${xDenyConsumptions.length}`)
    if (xDenyDecision === undefined || xDenyConsumptions.length !== 0) fail('S3d')
    check('S2e', 'S2: the allow decision is durable in the ledger (recorded by the model-facing tool)',
      xAllowDecision !== undefined && String(xAllowDecision.decision).toLowerCase().includes('all'),
      `allowDecision=${JSON.stringify(xAllowDecision) ?? 'none'}`)
    if (xAllowDecision === undefined) fail('S2e')

    // ── S4+S5: team Z (async delegate; the notification is REFUSED) ─────
    log('── S4–S5: team Z (notification failure recovery + idempotent retry) ──')
    const createZ = await remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_Z,
      blueprintId: BP_Z_ID,
      initialWork: { prompt: MK_Z },
    }, 'c1z')
    writeEvidence('s4-team-create-z.json', createZ.body)
    const createZOk = createZ.status === 200
      && createZ.body?.result?.ok === true
      && createZ.body?.result?.value?.data?.path === 'fresh-root'
    check('S4.0', 'team.create (Z) succeeds', createZOk, `status=${createZ.status} body=${JSON.stringify(createZ.body ?? createZ).slice(0, 300)}`)
    if (!createZOk) fail('S4.0')

    // S4: the notification delivery was ATTEMPTED and REFUSED (mock 500
    // record for the Z member-ask notification request).
    const zNotifReq = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Z_FILE), 120_000, 'Z notification attempt (the refused one)')
    writeEvidence('s4-z-notification-attempt.json', zNotifReq == null ? { present: false } : {
      seq: zNotifReq.seq,
      status: zNotifReq.status,
      error: zNotifReq.error,
      text: lastUserTextOf(zNotifReq).slice(0, 1200),
    })
    check('S4a', 'S4: the notification delivery was attempted and failed (mock refused the Leader notification turn, HTTP 500)',
      zNotifReq !== null && zNotifReq.status === 500,
      `seq=${zNotifReq?.seq} status=${zNotifReq?.status}`)
    if (zNotifReq === null || zNotifReq.status !== 500) fail('S4a')

    // S4: the request REMAINS durable + pending (the failure did not
    // remove/deny/allow it). "pending" = no control-decision-recorded
    // row for the requestId (the payload has no status field).
    let zLedger = readControlLedger(CREATE_ROOT_Z)
    const zReqDeadline = Date.now() + 60_000
    for (;;) {
      zLedger = readControlLedger(CREATE_ROOT_Z)
      if (zLedger.requests.length >= 1) break
      if (Date.now() >= zReqDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    const zReq = zLedger.requests.find((q) => q.kind === 'leader-approval' && q.correlation !== S5_TOKEN)
    const zPending = zReq !== undefined && !zLedger.decisions.some((d) => d.requestId === zReq.requestId)
    writeEvidence('s4-z-ledger-pending.json', zLedger)
    check('S4b', 'S4: after the notification failure the request is still durable + pending (no decision row; not removed)',
      zPending,
      `requests=${JSON.stringify(zLedger.requests).slice(0, 300)} decisions=${JSON.stringify(zLedger.decisions).slice(0, 200)}`)
    if (zReq === undefined) fail('S4b')

    // XCROSS (RH2/RH3, PR #20 closure): the X Leader — a DIFFERENT team's
    // leader on the SAME production domain — addresses Team Z's ledger
    // while Z's request is pending (before the S4 recovery input):
    //   XC1/RH2: team_list_pending_control(root=Z) →
    //            TEAM_TOOL_CALLER_ROOT_MISMATCH, no pending data;
    //   XC2/RH3: team_resolve_control(root=Z, requestId=Z-pending) →
    //            TEAM_TOOL_CALLER_ROOT_MISMATCH, no decision recorded;
    //   XC3/RH3 closure: Z's request is STILL pending (zero decision /
    //            zero consumption rows for it).
    // The gate fires in the COMMON tool entry (before any
    // ControlService/TeamRuntime effect), so the rejections must carry
    // the typed P0 code and the Z ledger must be untouched.
    if (zReq !== undefined) {
      const xcPrompt = await apiPrompt(booted.origin, booted.cookie, CREATE_ROOT_X,
        `${MK_XCROSS} cross-root probe: ROOTZ=${CREATE_ROOT_Z} ZREQ=${zReq.requestId} — call team_list_pending_control for ROOTZ, then team_resolve_control for ROOTZ with ZREQ (decision allow).`)
      if (xcPrompt.status !== 200) fail('XC1')
      const xcList = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_XCROSS) && toolMsgsOf(r).length === 1, 120_000, 'XCROSS list result')
      const xcListResult = xcList === null ? '' : contentText(toolMsgsOf(xcList).pop()?.content ?? '')
      writeEvidence('xcross-list-result.json', { seq: xcList?.seq ?? null, result: xcListResult.slice(0, 2000) })
      const xcListRejected = xcListResult.includes('TEAM_TOOL_CALLER_ROOT_MISMATCH')
      check('XC1', 'RH2: Leader X team_list_pending_control(root=Z) rejected with TEAM_TOOL_CALLER_ROOT_MISMATCH (no pending data leaked)',
        xcListRejected && !xcListResult.includes(zReq.requestId),
        `result=${xcListResult.slice(0, 300)}`)
      if (!xcListRejected || xcListResult.includes(zReq.requestId)) fail('XC1')
      const xcDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_XCROSS) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_XCROSS_DONE', 120_000, 'XCROSS chain done')
      const xcRes = xcDone === null ? '' : contentText(toolMsgsOf(xcDone).slice(-1)[0]?.content ?? '')
      writeEvidence('xcross-resolve-result.json', { seq: xcDone?.seq ?? null, result: xcRes.slice(0, 2000) })
      const xcResRejected = xcRes.includes('TEAM_TOOL_CALLER_ROOT_MISMATCH')
      check('XC2', 'RH3: Leader X team_resolve_control(root=Z, requestId=Z-pending) rejected with TEAM_TOOL_CALLER_ROOT_MISMATCH (no decision recorded)',
        xcDone !== null && xcResRejected,
        `result=${xcRes.slice(0, 300)}`)
      if (xcDone === null || !xcResRejected) fail('XC2')
      const zLedgerAfterXcross = readControlLedger(CREATE_ROOT_Z)
      writeEvidence('xcross-z-ledger-after.json', zLedgerAfterXcross)
      const zStillPending = zLedgerAfterXcross.decisions.filter((d) => d.requestId === zReq.requestId).length === 0
        && zLedgerAfterXcross.consumptions.filter((c) => c.requestId === zReq.requestId).length === 0
        && zLedgerAfterXcross.requests.some((q) => q.requestId === zReq.requestId)
      check('XC3', 'RH3: after the cross-root list + resolve attempts, Team Z request is STILL pending (zero decision rows, zero consumptions)',
        zStillPending,
        `decisions=${JSON.stringify(zLedgerAfterXcross.decisions).slice(0, 200)} consumptions=${JSON.stringify(zLedgerAfterXcross.consumptions).slice(0, 200)}`)
      if (!zStillPending) fail('XC3')
    } else {
      // No pending Z request (an earlier failure — the chain needs a
      // pending requestId to address); record the criteria as failed
      // without crashing the run.
      for (const [id, name] of [
        ['XC1', 'RH2: Leader X team_list_pending_control(root=Z) rejected with TEAM_TOOL_CALLER_ROOT_MISMATCH (no pending data leaked)'],
        ['XC2', 'RH3: Leader X team_resolve_control(root=Z, requestId=Z-pending) rejected with TEAM_TOOL_CALLER_ROOT_MISMATCH (no decision recorded)'],
        ['XC3', 'RH3: after the cross-root list + resolve attempts, Team Z request is STILL pending (zero decision rows, zero consumptions)'],
      ]) {
        check(id, name, false, 'skipped: no pending Z request to probe (an earlier criterion failed)')
        fail(id)
      }
    }

    // UPSTREAM LIVE-FACT (run 3, this round): a model-error turn dies
    // after a FINITE retry storm (observed: 5 retries — mock seq 23–28
    // all 500), and a turn that ENDS IN ERROR does NOT re-wake its queued
    // input (agent-loop `kick()`: the post-turn re-wake requires
    // `wakeRequested`, which a live running driver never latches for
    // mid-turn input — the queued input is stranded until the next
    // EXTERNAL input). So the explicit recovery input must arrive after
    // the failed turn has settled: wait for mock quiescence (the retry
    // storm over → the turn dead → the session idle), then send with a
    // bounded re-prompt (a re-prompt to an idle session claims the whole
    // queue, so a stranded first prompt is drained by its own turn).
    let lastSeenCount = mock.requests.length
    let lastGrowAt = Date.now()
    let quiesced = false
    const quiesceDeadline = Date.now() + 120_000
    for (;;) {
      await new Promise((r) => setTimeout(r, 2000))
      if (mock.requests.length !== lastSeenCount) {
        lastSeenCount = mock.requests.length
        lastGrowAt = Date.now()
      } else if (Date.now() - lastGrowAt >= 10_000) {
        quiesced = true
        break
      }
      if (Date.now() >= quiesceDeadline) break
    }
    log(`S4 recovery preflight: mock quiescence ${quiesced ? 'observed' : 'NOT observed (120s deadline)'} (requests=${mock.requests.length})`)

    // S4 recovery: an EXPLICIT Leader input (no notification involved) →
    // list (S4c) → resolve (S4d) → S5 probe (request_control) → S5 retry
    // (same scope + same token) → done. Bounded re-prompt: a prompt
    // stranded behind a still-settling failed turn is drained by the next
    // one (the idle session claims the whole queue in one turn).
    let zCheckList = null
    for (let attempt = 1; attempt <= 3 && zCheckList === null; attempt += 1) {
      const zCheckPrompt = await apiPrompt(booted.origin, booted.cookie, CREATE_ROOT_Z, MK_ZCHECK)
      if (zCheckPrompt.status !== 200) fail('S4c')
      zCheckList = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_ZCHECK) && toolMsgsOf(r).length === 1, 90_000, `Z recovery chain: list result (attempt ${attempt})`)
    }
    if (zCheckList === null) {
      fail('S4c')
      check('S4c', 'S4: the explicit Leader input reached the Leader turn (recovery chain running)', false, `requests=${mock.requests.length}`)
    } else {
      const zListResult = contentText(toolMsgsOf(zCheckList).pop()?.content ?? '')
      writeEvidence('s4-z-list-result.json', { seq: zCheckList.seq, result: zListResult.slice(0, 2000) })
      check('S4c', 'S4: team_list_pending_control (explicit read, NO notification) discovered the exact pending requestId',
        zListResult.includes(zReq.requestId ?? '\u0000'), `result=${zListResult.slice(0, 300)}`)
      if (!zListResult.includes(zReq.requestId ?? '\u0000')) fail('S4c')

      const zCheckDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_ZCHECK) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_Z_LEADER_DONE', 240_000, 'Z recovery chain done')
      check('S4d', 'S4: the Leader resolved the recovered request through team_resolve_control (chain completed)',
        zCheckDone !== null, `requests=${mock.requests.length}`)
      if (zCheckDone === null) fail('S4d')

      // S4e: the member's ORIGINAL blocked bash now proceeds (its
      // control wait returned the allow; the guard consumed it).
      const zExec = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_ZMEM) && toolMsgsOf(r).length === 1, 240_000, 'Z member bash result (after recovery)')
      if (zExec === null) {
        fail('S4e')
        check('S4e', 'S4: the recovered member bash EXECUTED (the operation proceeded after the pending-list recovery)', false, `requests=${mock.requests.length}`)
      } else {
        const zResult = contentText(toolMsgsOf(zExec).pop()?.content ?? '')
        writeEvidence('s4-z-bash-result.json', { seq: zExec.seq, result: zResult.slice(0, 800) })
        check('S4e', 'S4: the recovered member bash EXECUTED (the operation proceeded after the pending-list recovery)',
          zResult.includes('z-executed') && !/blocked|denied|pending/i.test(zResult.slice(0, 400)),
          `result=${zResult.slice(0, 200)}`)
        if (!zResult.includes('z-executed')) fail('S4e')
        check('S4f', 'S4: the recovered side effect landed (the z file exists)', existsSync(FILE_Z), `file=${FILE_Z}`)
        if (!existsSync(FILE_Z)) fail('S4f')
      }
    }

    // S5: the idempotent retry through the production tool surface —
    // same scope + same requestToken (the correlation) → the SAME
    // requestId, ONE durable row, NO duplicate notification.
    const zCheckReq1 = mock.requests.find((r) => r.body !== null && lastUserTextOf(r).includes(MK_ZCHECK) && toolMsgsOf(r).length === 3)
    const zCheckReq2 = mock.requests.find((r) => r.body !== null && lastUserTextOf(r).includes(MK_ZCHECK) && toolMsgsOf(r).length === 4)
    // TRIGGER-SCOPED extraction (LIVE-FOUND run 4: the Z root history
    // carries the MK_Z chain's create_member + delegate tool results
    // BEFORE the ZCHECK trigger — filtering the full message array
    // shifted every index by 2, so the "probe result" was actually the
    // list result and the "retry result" the resolve result). The
    // post-trigger window: req1 = [list, resolve, probe], req2 =
    // [list, resolve, probe, retry].
    const probeTools = zCheckReq1 === undefined ? [] : toolMsgsOf(zCheckReq1)
    const retryTools = zCheckReq2 === undefined ? [] : toolMsgsOf(zCheckReq2)
    const s5ProbeResult = String(probeTools[2]?.content ?? '')
    const s5RetryResult = String(retryTools[3]?.content ?? '')
    const s5ProbeId = extractResultRequestId(s5ProbeResult)
    const s5RetryId = extractResultRequestId(s5RetryResult)
    writeEvidence('s5-z-idempotency.json', {
      s5ProbeResult: s5ProbeResult.slice(0, 2000),
      s5RetryResult: s5RetryResult.slice(0, 2000),
      probeToolsWindow: probeTools.map((m) => String(m.content ?? '').slice(0, 1200)),
      retryToolsWindow: retryTools.map((m) => String(m.content ?? '').slice(0, 1200)),
      s5ProbeId,
      s5RetryId,
    })
    check('S5a', 'S5: the same scope + same correlation retried through team_request_control returned the SAME requestId',
      s5ProbeId !== null && s5ProbeId === s5RetryId,
      `probe=${s5ProbeId} retry=${s5RetryId}`)
    if (s5ProbeId === null || s5ProbeId !== s5RetryId) fail('S5a')

    const zLedgerFinal = readControlLedger(CREATE_ROOT_Z)
    writeEvidence('s5-z-ledger-final.json', zLedgerFinal)
    const s5Rows = zLedgerFinal.requests.filter((q) => q.correlation === S5_TOKEN)
    check('S5b', 'S5: the idempotent retry wrote exactly ONE durable request row for the scope', s5Rows.length === 1,
      `rows=${JSON.stringify(zLedgerFinal.requests.filter((q) => q.kind === 'leader-approval').map((q) => ({ id: q.requestId, correlation: q.correlation }))).slice(0, 300)}`)
    if (s5Rows.length !== 1) fail('S5b')

    // The S5 probe's notification: exactly ONE delivery attempt in the
    // mock corpus (the idempotent retry did NOT re-notify). Wait for it
    // to be processed (it is queued behind the ZCHECK turn).
    const s5NotifFirst = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Z_S5), 120_000, 'S5 probe notification (post-turn)')
    const s5NotifAttempts = mock.requests.filter((r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Z_S5) && toolMsgsOf(r).length === 0)
    check('S5c', 'S5: exactly ONE notification delivery attempt for the S5 probe request (the idempotent retry did NOT re-notify)',
      s5NotifFirst !== undefined && s5NotifAttempts.length === 1,
      `attempts=${s5NotifAttempts.length}`)
    if (s5NotifAttempts.length !== 1) fail('S5c')

    // Wait for the S5 notification chain to finish (list → resolve allow)
    // before reading the decision row (no ledger race).
    const s5NotifDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Z_S5) && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_NOTIF_DONE', 120_000, 'S5 probe notification chain done')

    const zLedgerFinal2 = readControlLedger(CREATE_ROOT_Z)
    const zConsumptions = zLedgerFinal2.consumptions.filter((c) => c.requestId === zReq?.requestId)
    const s5Decision = zLedgerFinal2.decisions.find((d) => d.requestId === s5ProbeId)
    check('S4g', 'S4: the recovered allow produced exactly ONE consumption fact (allow-once)', zConsumptions.length === 1,
      `consumptions=${JSON.stringify(zLedgerFinal2.consumptions).slice(0, 300)}`)
    if (zConsumptions.length !== 1) fail('S4g')
    check('S5d', 'S5: the S5 probe request was resolved through the liveness chain (the decision is durable)',
      s5Decision !== undefined, `decision=${JSON.stringify(s5Decision) ?? 'none'}`)
    if (s5Decision === undefined) fail('S5d')

    // ── S6: team Y (SYNC delegate — the busy-Leader characterization) ────
    log('── S6: team Y (sync delegate; the busy-Leader characterization) ──')
    // LIVE-FACT (run 3): team.create AWAITS the root's boot turn (it
    // delivers initialWork and does not respond until that turn COMPLETES).
    // With a sync delegate in the boot chain the turn blocks on the human
    // decision — so awaiting create() inline self-deadlocks the kit
    // against the decision it must later make (run 3: the create fetch
    // burned the full 240s client timeout → status=0, while the server
    // completed the create and the whole S6a–S6g arc still passed).
    // Fire the create WITHOUT awaiting; collect its response after the
    // human allow unblocks the boot turn.
    const createYPromise = remoteCall(booted.origin, booted.cookie, 'team.create', {
      rootSessionId: CREATE_ROOT_Y,
      blueprintId: BP_Y_ID,
      initialWork: { prompt: MK_Y },
    }, 'c1y')

    // Wait for the member's durable ask (the Leader is now BLOCKED in the
    // sync delegate — the turn has not returned to the model).
    let yLedger = { requests: [] }
    const yReqDeadline = Date.now() + 120_000
    for (;;) {
      yLedger = readControlLedger(CREATE_ROOT_Y)
      if (yLedger.requests.length >= 1) break
      if (Date.now() >= yReqDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    const yReq = yLedger.requests.find((q) => q.kind === 'leader-approval')
    writeEvidence('s6-y-ledger-pending.json', yLedger)
    if (yReq === undefined) {
      fail('S6')
      check('S6a', 'S6: the member bash ask created a durable request while the Leader turn was blocked in the sync delegate', false,
        `requests=${JSON.stringify(yLedger.requests).slice(0, 300)}`)
    } else {
      check('S6a', 'S6: the member bash ask created a durable request while the Leader turn was blocked in the sync delegate', true,
        `requestId=${yReq.requestId}`)
      // S6 characterization point 1: at THIS moment the Leader's delegate
      // has not returned (no MK_Y request carrying the delegate result)
      // and the queued notification has NOT been processed (no c1-y
      // notification request in the mock corpus yet).
      const yDelegateReturned = mock.requests.some((r) => r.body !== null && lastUserTextOf(r).includes(MK_Y) && toolMsgsOf(r).length >= 2)
      const yNotifSeen = mock.requests.some((r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Y))
      const yHealthBusy = await p6t6Health(booted.port)
      writeEvidence('s6-y-busy-characterization.json', {
        note: 'captured while the Leader turn is blocked in the sync delegate and the notification is queued (immediate Leader decision NOT schedulable in this topology — the human resolver channel is the breaker; the guidance is async: true for approval-capable work)',
        yDelegateReturned,
        yNotifSeen,
        healthDuringBusy: yHealthBusy.body,
        mockTimeline: mock.requests.map((r) => ({ seq: r.seq, receivedAt: r.receivedAt, userHead: lastUserTextOf(r).slice(0, 60) })),
      })
      check('S6b', 'S6 (characterization): while the Leader is blocked, the root notification is QUEUED — not yet processed (its model request is absent; the delegate result is absent)',
        !yDelegateReturned && !yNotifSeen,
        `delegateReturned=${yDelegateReturned} notifSeen=${yNotifSeen}`)
      // The row must still be healthy (no plugin deadlock at the row).
      check('S6c', 'S6: the plugin row stays healthy while the Leader is blocked (no row-level deadlock)',
        yHealthBusy.status === 200 && yHealthBusy.body?.ok === true,
        `health=${JSON.stringify(yHealthBusy.body).slice(0, 200)}`)
      if (!(yHealthBusy.status === 200 && yHealthBusy.body?.ok === true)) fail('S6c')

      // S6: the HUMAN resolver channel stays open: resolve while the
      // Leader is busy AND the notification delivery is in flight (the
      // control lock is NOT held by the delivery — the fire-and-forget
      // notifier runs after the lock release).
      const yApproval = await scriptedHumanApproval(booted.origin, booted.cookie, CREATE_ROOT_Y, yReq.requestId)
      const yApprovalOk = yApproval.status === 200
        && yApproval.body?.result?.ok !== false
        && JSON.stringify(yApproval.body).includes('allow')
      check('S6d', 'S6: the human resolver channel works WHILE the Leader is busy + the notification in flight (no control-lock deadlock)',
        yApprovalOk, `status=${yApproval.status} body=${JSON.stringify(yApproval.body).slice(0, 300)}`)
      if (!yApprovalOk) fail('S6d')

      // The human allow unblocks the sync delegate → the member turn ends
      // → the delegate returns → the boot turn completes → the
      // team.create(Y) RPC finally responds.
      const createY = await createYPromise
      writeEvidence('s6-team-create-y.json', createY.body)
      const createYOk = createY.status === 200
        && createY.body?.result?.ok === true
        && createY.body?.result?.value?.data?.path === 'fresh-root'
      check('S6.0', 'team.create (Y) succeeds (the RPC awaits the boot turn; the human allow unblocked it)',
        createYOk, `status=${createY.status} body=${JSON.stringify(createY.body ?? createY).slice(0, 300)}`)
      if (!createYOk) fail('S6.0')

      // The member's guard consumes the allow; the bash executes; the
      // member turn ends; the sync delegate RETURNS; the Leader turn
      // completes.
      const yDone = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).includes(MK_Y) && toolMsgsOf(r).length >= 2 && (r.reply?.kind === 'text' ? r.reply.content : '') === 'C1_Y_DONE', 300_000, 'Y leader turn complete')
      check('S6e', 'S6: after the human allow the member bash executed and the blocked Leader turn COMPLETED (the sync delegate returned)',
        yDone !== null && existsSync(FILE_Y),
        `yDone=${yDone === null ? 'null' : yDone.seq} fileExists=${existsSync(FILE_Y)}`)
      if (yDone === null || !existsSync(FILE_Y)) fail('S6e')

      // S6 characterization point 2: the QUEUED notification is now
      // processed — its model request appears AFTER the Leader turn
      // completed, and the pending list on the post-turn Leader reflects
      // the recorded decision (the request is no longer pending).
      const yNotifAfter = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Y), 120_000, 'Y queued notification processed post-turn')
      if (yNotifAfter === null) {
        fail('S6f')
        check('S6f', 'S6 (characterization): the queued notification was processed AFTER the Leader turn completed', false, `requests=${mock.requests.length}`)
      } else {
        // The notification chain lists the pending requests — wait for
        // the list result (the decision is recorded → the request is not
        // listed as pending).
        const yNotifList = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r).startsWith(NOTIF_PREFIX) && lastUserTextOf(r).includes(SUM_Y) && toolMsgsOf(r).length === 1, 60_000, 'Y post-turn notification list result')
        const yDoneAt = yDone?.receivedAt
        const yNotifAt = yNotifAfter.receivedAt
        const yListResult = yNotifList === undefined ? '' : contentText(toolMsgsOf(yNotifList).pop()?.content ?? '')
        writeEvidence('s6-y-post-turn-notification.json', {
          yDoneAt,
          yNotifAt,
          queuedThenProcessed: yDoneAt !== undefined && yNotifAt !== undefined && new Date(yNotifAt).getTime() >= new Date(yDoneAt).getTime(),
          listResult: yListResult.slice(0, 1200),
        })
        check('S6f', 'S6 (characterization): the queued notification was processed AFTER the Leader turn completed (immediate decision NOT schedulable in this topology)',
          yDoneAt !== undefined && yNotifAt !== undefined && new Date(yNotifAt).getTime() >= new Date(yDoneAt).getTime(),
          `doneAt=${yDoneAt} notifAt=${yNotifAt}`)
        if (yNotifList === undefined) fail('S6f')
        check('S6g', 'S6: on the post-turn Leader the pending list reflects the recorded decision (the request is no longer pending)',
          yNotifList !== undefined && !yListResult.includes(yReq.requestId ?? '\u0000'),
          `listResult=${yListResult.slice(0, 200)}`)
        if (yNotifList !== undefined && yListResult.includes(yReq.requestId ?? '\u0000')) fail('S6g')
      }
    }
  } finally {
    // Teardown (evidence is flushed before the world goes).
    log('teardown: stopping host + mock')
    stopHost(host)
    try {
      await mock.close()
    } catch { /* best-effort */ }
    const postStable = {
      p3080: await probeStableInstance('http://127.0.0.1:3080/'),
      p3180: await probeStableInstance('http://127.0.0.1:3180/'),
    }
    writeEvidence('post-stable-probe.json', postStable)
    writeEvidence('mock-requests.json', mock.requests.map((r) => ({
      seq: r.seq,
      receivedAt: r.receivedAt,
      status: r.status ?? null,
      userTextHead: lastUserTextOf(r).slice(0, 200),
      toolMsgCountAfterLastUser: toolMsgsOf(r).length,
      reply: r.reply,
    })))
    writeEvidence('instance-tail.txt', logTail(booted.instanceLog, 120))
    if (FLAG_KEEP) {
      log(`--keep: world retained at ${HOME}`)
    } else {
      rmSync(HOME, { recursive: true, force: true })
      rmSync(BLUEPRINT_DIR, { recursive: true, force: true })
      log(`world removed (${HOME})`)
    }
    const passed = criteria.filter((c) => c.ok).length
    const summary = {
      runStamp: RUN_STAMP,
      hostBaseline: HOST_BASELINE_SHA,
      hostPort,
      mockPort: MOCK_PORT,
      worktree: WORKTREE,
      criteria,
      passed,
      total: criteria.length,
      failed: FAILS,
      stable: { pre: preStable, post: postStable },
      verdict: FAILS.length === 0 ? 'PASS' : 'FAIL',
    }
    writeEvidence('summary.json', summary)
    log(`VERDICT ${summary.verdict} — ${passed}/${criteria.length} criteria passed${FAILS.length > 0 ? `; failed: ${FAILS.join(',')}` : ''}`)
  }

  process.exit(FAILS.length === 0 ? 0 : 2)
}

main().catch((e) => {
  try {
    log(`FATAL uncaught: ${e.stack ?? e}`)
    if (RUN_LOG !== null) writeEvidence('summary.json', { runStamp: RUN_STAMP, fatal: String(e.message ?? e), criteria })
  } catch { /* best-effort */ }
  process.exit(1)
})
