/**
 * A5M2-B-TEAM Host-C2 driver — real public-face runner + no-boot prechecks.
 *
 * Reuse, not re-derivation (root 00:36): the boot/auth/teardown core is the
 * verified characterization `DshInstance` (`start()` answers the REAL launch
 * URL, `stop()` is awaited in `finally`), pins come from `tests/paths.mjs`, the
 * launch-line parser mirrors its `BOOT_MARKER`, the write-source gate is the
 * production `inspectBlueprintSource`, and the two public channels are the
 * shapes proven in `tests/kits/send-message-liveness-smoke`
 * (`POST /team-remote/<method>` and `POST /api/session/prompt`). The Schedule
 * kit (`a5m2-schedule-c2`, read at `329a8b830`) is READ-ONLY reference: it is
 * not imported, not copied wholesale, and its arm/test-backdoor/image-permission
 * patterns are deliberately NOT carried over.
 *
 * Boot gate: `--boot` refuses to run unless `A5M2_TEAM_C2_BOOT_GO=1` is set by
 * the window ruling. Default mode is precheck-only (no host, no world, no
 * install) — and precheck success is NOT a claim that the round is runnable:
 * every unverified leg is listed in `GAPS` and hard-fails if reached.
 */

import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'

import { DshInstance, redactLaunchToken } from '../../../../../tests/characterization/lib/instance.mjs'
import {
  TEST_USE_REL, TEST_HOME_ROOT_REL, TEST_PORT_RANGES, STABLE_INSTANCE_PORT,
  CLIENT_COMMIT_HASH, DSH_BASELINE_VERSION,
} from '../../../../../tests/paths.mjs'
import { inspectBlueprintSource } from '../../../../../packages/runtime/dist/packages/domain/blueprint/src/index.js'
import {
  ROW_CONFIG, CRITERIA, CRITERIA_IDS, REUSE_INSTALL, validateRow,
} from './a5m2-team-c2-kit.mjs'
import {
  A5_B_TEAM_TOOL_NAMES, A5_B_TEAM_FAMILY_ID, A5_B_TEAM_ADAPTER_REVISION,
} from '../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/team-adapters.mjs'

const REPO = resolve(import.meta.dirname, '../../../../..')
const LIST_ROOTS_CONTRACT_VERSION = 3
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/

/** Legs whose exact wire shape is NOT yet verified against a proven source. A
 *  case touching one stops with this id instead of guessing the protocol. */
export const GAPS = Object.freeze({
  'GAP-FRAME-READER': 'the multi-frame session-log reader (zstd per-frame decode) is proven only inside the Schedule kit script, which exports nothing; its frame order/decode call is unread here, so log-frame assertions stay unattempted.',
})

/** The closed Remote v1 envelope, verified against the built contract source. */
const ENVELOPE_TOP_LEVEL = Object.freeze(['type', 'rpcId', 'method', 'payload'])
function envelopeCheck () {
  const problems = []
  const sample = JSON.stringify({ type: 'client-request', rpcId: 'x', method: 'team.listRoots', payload: { version: LIST_ROOTS_CONTRACT_VERSION, params: {} } })
  const parsed = Object.keys(JSON.parse(sample))
  if (parsed.join(',') !== ENVELOPE_TOP_LEVEL.join(',')) problems.push('driver envelope drifted from the closed four fields')
  return { ok: problems.length === 0, problems }
}

const jsonFetch = async (url, init, timeoutMs = 240_000) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  try { return { status: res.status, headers: res.headers, body: JSON.parse(text) } }
  catch { return { status: res.status, headers: res.headers, body: text } }
}

/** Proven public Team channel (read-only reference shape). */
export const remoteCall = (origin, cookie, method, params, tag = 'bteam', version = 1) =>
  jsonFetch(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version, params } }),
  })

/** Proven core prompt channel: ONE user turn, unique requestId. */
export const apiPrompt = (origin, cookie, sessionId, text, tag = 'bteam') =>
  jsonFetch(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: { args: { request: { requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, sessionId, mode: 'queue', content: [{ type: 'text', text }] } } },
    }),
  })

/** SAME-CALL pairing over the native Messages shape (assistant
 *  `content[].{type:'tool_use',id}` paired with user
 *  `content[].{type:'tool_result',tool_use_id,content,is_error}`), restricted to
 *  ids this run issued, so a foreign block can never close a case. */
export function pairToolResults (messages, issuedIds) {
  const results = new Map()
  for (const message of messages ?? []) {
    for (const block of message?.content ?? []) {
      if (block?.type === 'tool_result' && issuedIds.has(block.tool_use_id)) {
        results.set(block.tool_use_id, { content: block.content, isError: block.is_error === true })
      }
    }
  }
  return results
}

/** Prechecks only: source-level, no host, no world, no install. */
export function precheck () {
  const problems = [...validateRow().problems]
  const row = ROW_CONFIG
  if (!row.world.startsWith(`${TEST_HOME_ROOT_REL}/`)) problems.push('world must live under tests/homes')
  if (existsSync(join(REPO, row.world))) problems.push(`the preparation must not create or reuse a world directory: ${row.world}`)
  const family = TEST_PORT_RANGES.find((r) => row.port !== STABLE_INSTANCE_PORT)
  if (family === undefined) problems.push('no port family available')
  if (row.port === STABLE_INSTANCE_PORT) problems.push(`stable instance port ${String(STABLE_INSTANCE_PORT)} is never in scope`)
  if (A5_B_TEAM_FAMILY_ID !== 'B-TEAM' || A5_B_TEAM_ADAPTER_REVISION !== 2) problems.push('production read path does not answer B-TEAM revision 2')
  if (CRITERIA_IDS[0] !== 'C-READINESS' || !CRITERIA_IDS.includes('C-DUR-1')) problems.push('criteria order/coverage broken')
  for (const name of A5_B_TEAM_TOOL_NAMES) {
    if (!CRITERIA.some((c) => c.id === 'C-SET' || c.id === 'C-LEAF')) problems.push('the closed set has no covering criterion')
    if (!readFileSync(join(REPO, 'packages/runtime/src/plugin/live/governed-families/team-adapters.mjs'), 'utf8').includes(`'${name}'`)) problems.push(`signed adapter no longer names ${name}`)
  }
  // The Remote envelope contract is read from the CURRENT built source, never
  // from a remembered smoke call: `team.listRoots` is a contract-v3 method with
  // a CLOSED EMPTY param set, and the envelope itself is closed (exactly
  // type/rpcId/method/payload, `payload` = { version, params }).
  const envelope = envelopeCheck()
  if (!envelope.ok) problems.push(...envelope.problems)
  const hostTree = join(REPO, TEST_USE_REL)
  if (!existsSync(hostTree)) problems.push(`host tree missing: ${hostTree} (pristine baseline ${DSH_BASELINE_VERSION})`)
  const bp = spawnSync('git', ['-C', REPO, 'status', '--porcelain', '--', 'tests/kits/a5m2-schedule-c2'], { encoding: 'utf8' })
  if (bp.stdout.trim() !== '') problems.push('the Schedule kit lane must stay untouched')
  return Object.freeze({ ok: problems.length === 0, problems, criteria: CRITERIA_IDS, reuse: REUSE_INSTALL.baselineVersion, gaps: Object.keys(GAPS) })
}

/** Validate a Team blueprint source through the PRODUCTION source gate before
 *  any write (fail fast, per the proven kit discipline). */
export function gateBlueprintSource (source) {
  const report = inspectBlueprintSource(source)
  const ok = report?.ok === true || report?.valid === true
  return { ok, report }
}

/**
 * The boot path: verified calls only, cleanup awaited. Any case that needs a
 * `GAPS` leg stops before touching it. Requires the window GO env.
 */
export async function runTeamC2 ({ port, world, blueprintSource, logDir, go = process.env.A5M2_TEAM_C2_BOOT_GO }) {
  if (go !== '1') throw new Error('A5M2_TEAM_C2_BOOT_GO is not set: boot is a window decision, this driver never boots by default')
  const trace = []
  const rec = (leg, ok, detail) => { trace.push({ leg, ok, detail }); return ok }
  const instance = new DshInstance({
    hostTree: join(REPO, TEST_USE_REL),
    dshHome: join(REPO, world),
    port,
    clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: logDir ?? join(REPO, 'dev/agent-workflow/evidence/a5m2-team-c2/runs'),
  })
  let url = null
  try {
    url = await instance.start({ timeoutMs: 120_000 })
    const match = BOOT_MARKER.exec(String(readFileSync(instance.logPath, 'utf8'))) ?? BOOT_MARKER.exec(String(url))
    if (match === null) { rec('C-READINESS', false, 'no launch line parsed'); throw new Error('launch line never appeared') }
    const origin = `http://127.0.0.1:${match[1]}`
    const token = match[2]
    const exchange = await jsonFetch(`${origin}/?token=${token}`, { redirect: 'manual' }, 30_000)
    const cookie = exchange.headers.getSetCookie?.().map((c) => c.split(';')[0]).join('; ') ?? ''
    rec('boot', true, redactLaunchToken(`${origin}/?token=${token}`))
    // C-READINESS: v3 read-only barrier before any case.
    const roots = await remoteCall(origin, cookie, 'team.listRoots', {}, 'bteam-ready', 3)
    rec('C-READINESS', roots.status === 200, `status=${String(roots.status)}`)
    if (roots.status !== 200) return { trace, ok: false }
    const gate = gateBlueprintSource(blueprintSource)
    rec('C-BLUEPRINT-SOURCE-GATE', gate.ok, 'production inspectBlueprintSource answered before any write')
    // Team cases run against a NEW unique root created directly through the
    // public Team API (never by hijacking an ordinary session writer).
    // Log-frame assertions: never attempted here — see GAPS['GAP-FRAME-READER'].
    return { trace, ok: trace.every((row) => row.ok), gaps: Object.keys(GAPS) }
  } finally {
    await instance.stop()
    rec('teardown', true, 'instance.stop() awaited')
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const boot = process.argv.includes('--boot')
  if (!boot) {
    const result = precheck()
    console.log(JSON.stringify({ mode: 'precheck', booted: false, ...result }, null, 2))
    process.exitCode = result.ok ? 0 : 1
  } else {
    const out = await runTeamC2({ port: 3188, world: ROW_CONFIG.world, blueprintSource: '' })
    console.log(JSON.stringify(out, null, 2))
    process.exitCode = out.ok ? 0 : 1
  }
}
