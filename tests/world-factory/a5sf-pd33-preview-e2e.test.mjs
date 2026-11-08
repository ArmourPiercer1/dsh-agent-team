/**
 * a5sf-pd33-preview-e2e.test.mjs — PD-33: the Preview scenario's PINS, host-free.
 *
 * ZERO Host boots, ZERO ports bound, ZERO model requests. What is pinned here is
 * not a measurement (the measurement lives in
 * `dev/agent-workflow/evidence/a5sf-pd33-preview-e2e/`); it is the SHAPE that
 * makes the measurement mean what the readiness report says it means:
 *
 *   1. the driver exists, is host-free under `--plan`, and its header states the
 *      Preview semantic ("stop the target Member", not a Team-wide Stop);
 *   2. the roster the report prints is DERIVED, not typed: the report's 36-name
 *      accounting must equal 19 preset tools + 15 team tools + 2 instrument
 *      tools, and the deferred seven must be absent from the preset surface;
 *   3. every judge reads a counter/fact/durable line — the shell case must say it
 *      measures the DISCLOSED boundary (guard allows, OS denies), never that the
 *      service axis refused;
 *   4. `read_image`'s case is a ROUTE case: it must require 0 guard facts and
 *      0 image bytes, so a fallthrough to the fs face cannot pass;
 *   5. `web_search`'s case must accept BOTH shipped states and never assume a
 *      backend exists (deployment-conditional, 0 POSTs is a valid branch).
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = new URL('../../', import.meta.url).pathname
const DRIVER_DIR = join(ROOT, 'tests/world-factory/drivers/a5sf-pd33-preview-e2e')
const DRIVER = readFileSync(join(DRIVER_DIR, 'run-boot.mjs'), 'utf8')
const TRIPWIRE = readFileSync(join(DRIVER_DIR, 'pd33-base-web-tripwire.mjs'), 'utf8')
const REPORT = readFileSync(join(ROOT, 'docs/plans/active/alpha5-sandbox-first/PREVIEW-READINESS-2026-11-15.md'), 'utf8')
const EVIDENCE_README = readFileSync(join(ROOT, 'dev/agent-workflow/evidence/a5sf-pd33-preview-e2e/README.md'), 'utf8')

/** The shipped preset's tool rows, as the roster in §2 accounts for them. */
const PRESET_TOOLS = [
  'bash', 'read', 'write', 'edit', 'grep', 'glob', 'job_list', 'job_output', 'job_kill',
  'skill', 'present', 'web_fetch', 'web_search', 'create_goal', 'get_goal', 'update_goal',
  'exit_plan_mode', 'todo_write', 'read_image',
]
const TEAM_TOOLS = [
  'team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member',
  'team_delegate', 'team_follow_up', 'team_collect', 'team_send_message', 'team_report_progress',
  'team_request_control', 'team_resolve_control', 'team_list_pending_control',
  'team_archive_member', 'team_grant_permission', 'team_revoke_permission',
]
const INSTRUMENT_TOOLS = ['u5_canary', 'u6fs_probe']
const DEFERRED = [
  'workflow', 'subagent', 'subagent_fork', 'send_message', 'interrupt_agent', 'list_agents', 'ask_user_question',
]

test('PD33-DRIVER: the driver is present, states the Preview stop semantic, and never builds a Team-wide stop', () => {
  assert.match(DRIVER, /PD-33/u)
  assert.match(DRIVER, /\*target Member\*[\s\S]{0,80}stops THAT Member/iu)
  assert.match(DRIVER, /by design for Preview/iu)
  // No invented "stop everything" arm: the Preview semantic is per-Member.
  assert.doesNotMatch(DRIVER, /team_wide_stop|stopTeamEverywhere/iu)
})

test('PD33-ROSTER: 19 preset + 15 team + 2 instrument = 36, and the deferred seven are absent', () => {
  assert.equal(PRESET_TOOLS.length, 19)
  assert.equal(TEAM_TOOLS.length, 15)
  assert.equal(INSTRUMENT_TOOLS.length, 2)
  assert.equal(PRESET_TOOLS.length + TEAM_TOOLS.length + INSTRUMENT_TOOLS.length, 36)
  for (const name of DEFERRED) {
    assert.ok(!PRESET_TOOLS.includes(name), `${name} must not be a preset tool`)
    assert.ok(!TEAM_TOOLS.includes(name), `${name} must not be a team tool`)
  }
  // The report's §2 accounting must agree with these numbers, not with prose.
  assert.match(REPORT, /19（preset 产品工具）\+ 15（team）\+ 2（仪器）= 36/u)
})

test('PD33-DEFERRED: the driver probes every deferred name and expects a typed unknown-tool refusal', () => {
  const m = /const DEFERRED_NAMES = Object\.freeze\(\[([\s\S]*?)\]\)/u.exec(DRIVER)
  assert.ok(m, 'DEFERRED_NAMES must be a frozen literal list')
  const names = [...m[1].matchAll(/'([a-z_]+)'/gu)].map((x) => x[1])
  assert.deepEqual(names, DEFERRED, 'the probed names must be exactly the deferred surface')
  assert.match(DRIVER, /unknown tool/u)
  assert.match(DRIVER, /deferred-tools-typed/u)
})

test('PD33-SHELL: the shell case measures the DISCLOSED boundary, never claims the service axis refused', () => {
  const i = DRIVER.indexOf("verdictOf('pd33:shell-write-boundary'")
  assert.ok(i > 0, 'the shell case must exist under its disclosed name')
  const block = DRIVER.slice(i, i + 1600)
  assert.match(block, /BL-17/u)
  assert.match(block, /guard-admits-the-spawn/u)
  assert.match(block, /os-profile-stops-the-write/u)
  assert.doesNotMatch(block, /guard-refused-before-spawn/u, 'the refuted claim must not survive as a clause name')
})

test('PD33-READ-IMAGE: a route case — 0 guard facts and 0 image bytes, or it does not pass', () => {
  const i = DRIVER.indexOf("verdictOf('pd33:read-image-route'")
  assert.ok(i > 0)
  const block = DRIVER.slice(i, i + 1200)
  assert.match(block, /zero-guard-facts/u)
  assert.match(block, /zero-bytes/u)
  assert.match(block, /does not declare image input|image-capable model/u)
})

test('PD33-WEB-SEARCH: both shipped states are judged, and 0 POSTs is a valid branch', () => {
  assert.match(DRIVER, /WEB_PROVIDER_UNAVAILABLE/u)
  assert.match(DRIVER, /required.*format|branch=backend/u)
  const i = DRIVER.indexOf('branch=typed-unavailable')
  assert.ok(i > 0, 'the typed-unavailable branch must be a judged outcome')
})

test('PD33-NO-BASE-WEB: the inherited host `web` is counted, not argued about', () => {
  assert.match(TRIPWIRE, /host-web-call/u)
  assert.match(DRIVER, /hostWebCalls/u)
  assert.match(DRIVER, /pd33:no-base-web/u)
  assert.match(DRIVER, /A5SF_PD33_MUTATE/u)
})

test('PD33-EVIDENCE: the report and the evidence README state the class and the anchor', () => {
  assert.match(REPORT, /DEV-LIVE/u)
  assert.match(REPORT, /本报告不是 Alpha\.5 候选验收/u)
  assert.match(REPORT, /2026-11-08/u, 'the real-clock anchor must be disclosed')
  assert.match(EVIDENCE_README, /DEV-LIVE/u)
  assert.match(EVIDENCE_README, /does NOT claim/iu)
})
