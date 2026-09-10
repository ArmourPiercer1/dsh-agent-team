#!/usr/bin/env node
/**
 * a2perm-legacy.mjs — V1 (0.1.1-alpha.2 freeze) R1 legacy-regression probe.
 *
 * Drives the RUNNING legacy world (a2perm-boot.mjs A2_WORLD=legacy — the
 * SAME alpha.2 build, NO user-layer product-row override: the BUNDLE layer
 * shipped my-team-bp-1 blueprint with NO capabilities field stands) and
 * emits legacy-probe.json:
 *
 *   - health ok + toolCount 10 (the full factory catalog) + leader-only
 *     live sessions (the shipped row seeds no members);
 *   - catalog.list carries my-team-bp-1 (the shipped default in force);
 *   - the R1 selection-set probe: ALL TEN team tools registered on the
 *     leader (no per-teammate capability selection in the legacy default);
 *   - ZERO permission listeners on the alpha.2 build: a live write/read of
 *     a workspace file via the full tools/pre-execute waterfall executes
 *     WITHOUT creating ANY control request row (a legacy blueprint has no
 *     capabilities.permissions → the A6 glue installs zero listeners).
 *
 * Usage: node a2perm-legacy.mjs   (A2_STAMP optional — default = newest)
 */
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EV = dirname(fileURLToPath(import.meta.url))
function findMainRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'instance.mjs'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} carries .worktrees/RC1`)
    dir = parent
  }
}
const REPO = findMainRepoRoot(EV)

let STAMP = process.env.A2_STAMP
let STATE_FILE
if (STAMP) {
  STATE_FILE = join(EV, `a2state-legacy-${STAMP}.json`)
} else {
  const states = readdirSync(EV).filter((f) => f.startsWith('a2state-legacy-') && f.endsWith('.json')).sort()
  if (states.length === 0) { console.error('no a2state-legacy-*.json — boot the legacy world first'); process.exit(1) }
  STATE_FILE = join(EV, states[states.length - 1])
  STAMP = states[states.length - 1].replace(/^a2state-legacy-/, '').replace(/\.json$/, '')
}
if (!existsSync(STATE_FILE)) { console.error(`no state file: ${STATE_FILE}`); process.exit(1) }
const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
const { origin, cookie, port, rootSessionId } = state
const OUT_FILE = join(EV, `legacy-probe-${STAMP}.json`)
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  appendFileSync(OUT_FILE + '.log', stamped + '\n')
}

async function fetchJson(url, init, timeoutMs = 30_000) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    return { status: res.status, body, text }
  } catch (e) {
    return { status: null, body: { readError: String(e?.message ?? e) } }
  }
}
async function remoteCall(method, params, version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `leg-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}`,
      method,
      payload: { version, params },
    }),
  }, 60_000)
}
async function p6t6State() {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 15_000)
}
async function p6t6Health() {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}
async function p6t6Tool(name, args, as, callId) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as, callId }),
  }, 60_000)
}

const checks = []
function check(id, label, expected, actual, ok, detail) {
  checks.push({ id, label, expected, actual, ok: !!ok, detail: detail ?? null })
  log(`${ok ? 'PASS' : 'FAIL'} ${id} — ${label}${!ok ? ` (expected=${JSON.stringify(expected)?.slice(0, 200)} actual=${JSON.stringify(actual)?.slice(0, 200)})` : ''}`)
}

const evidence = {
  stamp: STAMP,
  purpose: 'R1 legacy-regression probe on the 0.1.1-alpha.2 build: the shipped default my-team-bp-1 (NO capabilities field) delivers the legacy FULL team-tool catalog to the leader with ZERO permission listeners — no capability wiring, no control-plane involvement',
  worldHome: state.home,
  branch: state.branch,
  rootSessionId,
  startedAt: new Date().toISOString(),
}

async function main() {
  const hb = await p6t6Health()
  check('legacy-health-ok', 'p6t6 health ok', true, hb.body?.ok === true, hb.body?.ok === true, JSON.stringify(hb.body).slice(0, 300))
  check('legacy-toolcount-10', 'factory catalog toolCount = 10', 10, hb.body?.toolCount ?? null, hb.body?.toolCount === 10)
  const live = hb.body?.liveSessions ?? []
  check('legacy-leader-only', 'shipped row seeds no members (leader-only live sessions)', JSON.stringify([rootSessionId]), JSON.stringify(live),
    JSON.stringify(live) === JSON.stringify([rootSessionId]), JSON.stringify(live))

  let st = (await p6t6State()).body
  check('legacy-blueprint-shipped', 'teamSession blueprintId = my-team-bp-1 (the BUNDLE layer shipped default stands)', 'my-team-bp-1', st?.teamSession?.blueprintId ?? null,
    st?.teamSession?.blueprintId === 'my-team-bp-1')
  check('legacy-control-zero-at-boot', 'zero control state at boot (nothing has asked yet)', { requests: 0, decisions: 0, consumptions: 0 },
    { requests: st?.control?.requests?.length, decisions: st?.control?.decisions?.length, consumptions: st?.control?.consumptions?.length },
    st?.control?.requests?.length === 0 && st?.control?.decisions?.length === 0 && st?.control?.consumptions?.length === 0)

  const catalog = await remoteCall('catalog.list', {})
  check('legacy-catalog-shipped', 'catalog.list carries my-team-bp-1', 'my-team-bp-1 present', catalog.status === 200 && JSON.stringify(catalog.body).includes('my-team-bp-1'),
    catalog.status === 200 && JSON.stringify(catalog.body).includes('my-team-bp-1'), JSON.stringify(catalog.body).slice(0, 300))

  // the R1 selection-set probe: all TEN team tools registered on the leader
  const TEN_TOOLS = [
    'team_list_members', 'team_list_templates', 'team_inspect_config', 'team_create_member',
    'team_delegate', 'team_follow_up', 'team_send_message', 'team_report_progress',
    'team_request_control', 'team_resolve_control',
  ]
  const probe = async (name) => {
    const r = await p6t6Tool(name, {}, rootSessionId, `a2-legacy-probe-${name}`)
    if (r.body?.ok === true) return 'registered'
    const msg = String(r.body?.error?.message ?? '')
    return /unknown|not registered|not a tool|no tool/i.test(msg) ? 'not-registered' : `registered-tool-error: ${msg.slice(0, 120)}`
  }
  const selectionSet = {}
  for (const name of TEN_TOOLS) selectionSet[name] = await probe(name)
  evidence.selectionSet = selectionSet
  const missing = TEN_TOOLS.filter((n) => selectionSet[n] === 'not-registered')
  check('legacy-full-10-catalog', 'ALL TEN team tools registered on the legacy leader (no capability selection)',
    '0 missing', `${missing.length} missing: ${missing.join(', ') || '-'}`, missing.length === 0, JSON.stringify(selectionSet).slice(0, 400))

  // ZERO permission listeners: a live write/read through the full
  // tools/pre-execute waterfall executes with NO control-plane involvement.
  // The legacy root works in its durable default workspace (read it from
  // the teamSession row — never assume DSH_HOME).
  const workspace = String(st?.teamSession?.defaultWorkspace ?? '')
  check('legacy-defaultworkspace-known', 'teamSession defaultWorkspace is known (the probe file target)', 'non-empty', workspace, workspace.length > 0, workspace)
  const probeFile = 'a2-legacy-probe.txt'
  const probePath = join(workspace, probeFile)
  const w = await p6t6Tool('write', { file_path: probeFile, content: 'legacy-zero-listener-ok' }, rootSessionId, 'a2-legacy-write-1')
  const wMsg = String(w.body?.error?.message ?? '')
  check('legacy-write-executes', 'legacy leader write executes (no permission listener vetoes it)', 'ok', w.body?.ok === true ? 'ok' : `error: ${wMsg.slice(0, 150)}`,
    w.body?.ok === true, JSON.stringify(w.body).slice(0, 250))
  check('legacy-write-file-on-disk', 'the written file exists on disk with the payload', 'legacy-zero-listener-ok', existsSync(probePath) ? readFileSync(probePath, 'utf8') : '<missing>',
    existsSync(probePath) && readFileSync(probePath, 'utf8') === 'legacy-zero-listener-ok')
  const r = await p6t6Tool('read', { file_path: probeFile }, rootSessionId, 'a2-legacy-read-1')
  check('legacy-read-executes', 'legacy leader read executes (no permission listener vetoes it)', 'ok', r.body?.ok === true ? 'ok' : `error: ${String(r.body?.error?.message ?? '').slice(0, 150)}`,
    r.body?.ok === true, JSON.stringify(r.body).slice(0, 250))
  st = (await p6t6State()).body
  check('legacy-zero-control-rows', 'ZERO control rows after the live write+read (the alpha.2 permission plane is absent for the legacy blueprint)',
    { requests: 0, decisions: 0, consumptions: 0 },
    { requests: st?.control?.requests?.length, decisions: st?.control?.decisions?.length, consumptions: st?.control?.consumptions?.length },
    st?.control?.requests?.length === 0 && st?.control?.decisions?.length === 0 && st?.control?.consumptions?.length === 0,
    JSON.stringify(st?.control ?? null).slice(0, 300))

  evidence.finishedAt = new Date().toISOString()
  evidence.verdict = {
    overall: checks.every((c) => c.ok) ? 'R1 LEGACY PASS' : 'R1 LEGACY FAIL',
    total: checks.length,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
  }
  writeFileSync(OUT_FILE, JSON.stringify({ ...evidence, checks }, null, 2))
  log(`verdict: ${evidence.verdict.overall} (${evidence.verdict.passed}/${evidence.verdict.total}) → ${OUT_FILE}`)
  if (!evidence.verdict.overall.endsWith('PASS')) process.exitCode = 1
}

await main()
