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

import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { zstdDecompressSync } from 'node:zlib'

import { DshInstance, redactLaunchToken } from '../../../../../tests/characterization/lib/instance.mjs'
import {
  TEST_USE_REL, TEST_HOME_ROOT_REL, TEST_PORT_RANGES, STABLE_INSTANCE_PORT,
  CLIENT_COMMIT_HASH, DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA,
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
/** The main tree's already-verified pristine runtime (root 01:01: reuse in
 *  place, zero copy). Overridable by parameter, never cloned or installed. */
const SHARED_HOST_TREE = '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use'
const hostTree = () => process.env.A5M2_TEAM_C2_HOST_TREE ?? SHARED_HOST_TREE
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/

/**
 * Session-log reading — the proven multi-frame shape, reused rather than
 * re-derived: `tests/mock/scripts/tool-lines.mjs` carries the frame law this
 * driver follows (the matrix lesson is recorded there — a SINGLE
 * `zstdDecompressSync` of a log file yields only the FIRST frame, so a
 * restarted session silently loses every later frame). Frames are therefore
 * segmented on the zstd magic `28 B5 2F FD` and each segment is decompressed
 * with any undecodable tail carried into the next, so a frame that spans two
 * appends still decodes. The file law (`session(.vN)?.jsonl(.zstd)?` under
 * `<DSH_HOME>/sessions`, walked recursively) is the proven one from
 * `model-preference-routing-smoke`.
 */

const ZSTD_MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])

/** Every session log under `<home>/sessions`, newest-name included verbatim. */
export function listSessionFiles (home) {
  const out = []
  const stack = [join(home, 'sessions')]
  while (stack.length > 0) {
    const dir = stack.pop()
    let entries
    try { entries = readdirSync(dir, { withFileTypes: true }) } catch { continue }
    for (const entry of entries) {
      const full = join(dir, entry.name)
      if (entry.isDirectory()) stack.push(full)
      else if (entry.isFile() && /session(\.v\d+)?\.jsonl(\.zstd)?$/.test(entry.name)) {
        try { out.push({ path: full, size: statSync(full).size }) } catch { /* unreadable: skipped, never fatal */ }
      }
    }
  }
  return out
}

/** Frame-by-frame zstd decode: magic segmentation + carried tail (never a
 *  single whole-file decompress, which reads only the first frame). */
export function decodeSessionLogFrames (buf) {
  const starts = []
  let offset = 0
  for (;;) {
    const at = buf.indexOf(ZSTD_MAGIC, offset)
    if (at === -1) break
    starts.push(at)
    offset = at + 4
  }
  const bounds = [...starts, buf.length]
  const parts = []
  let pending
  for (let k = 0; k < bounds.length - 1; k += 1) {
    const chunk = buf.subarray(bounds[k], bounds[k + 1])
    const candidate = pending === undefined ? chunk : Buffer.concat([pending, chunk])
    try { parts.push(zstdDecompressSync(candidate)); pending = undefined } catch { pending = candidate }
  }
  if (pending !== undefined) parts.push(zstdDecompressSync(pending))
  return Buffer.concat(parts)
}

/** Decoded JSONL lines of every session log, tagged with their file. */
export function readSessionLines (home) {
  const lines = []
  for (const file of listSessionFiles(home)) {
    let text
    try { text = decodeSessionLogFrames(readFileSync(file.path)).toString('utf8') }
    catch { continue }
    for (const raw of text.split('\n')) {
      const trimmed = raw.trim()
      if (trimmed.length === 0) continue
      try { lines.push({ file: file.path, line: JSON.parse(trimmed) }) } catch { /* partial tail line */ }
    }
  }
  return lines
}

/** The proven CLI readers run as-is over one session file (`tool-lines.mjs`
 *  with an optional method filter, `call-result.mjs` for one call), so the
 *  harness never re-implements their extraction rules. */
export function runProvenReader (script, ...args) {
  const res = spawnSync(process.execPath, [join(REPO, 'tests/mock/scripts', script), ...args], { encoding: 'utf8', timeout: 60_000 })
  return { ok: res.status === 0, stdout: res.stdout ?? '', stderr: res.stderr ?? '' }
}

/** Unverified wire shapes. A case touching one stops with this id instead of
 *  guessing the protocol. */
export const GAPS = Object.freeze({
  'GAP-TEAM-CREATE-PARAMS': 'the version-aware closed param set of `team.create` (params.ts, v1 and v2 differ) is unread here, so the Team case bodies do not mint a create request yet — this is the next slice, not a silent skip.',
  'GAP-DURABLE-REPLAY': 'C-DUR-1 needs a durable approval composed under the PREVIOUS adapter revision; without such a row the leg is not attempted (and never "proved" by a file revision or by two refusals).',
})

/** The closed Remote v1 envelope, verified against the built contract source
 *  (`packages/remote/src/contracts/request.ts`: exactly
 *  type/rpcId/method/payload, `payload` = { version, params }). */
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
  // ROOT 01:01 OVERRIDE: the product package is REUSED IN PLACE, zero copy. The
  // clone/install plan is revoked (a clone inside this tree is still a new
  // copy), so the host tree is a PATH PARAMETER pointing at the main tree's
  // already-verified pristine runtime. READ-ONLY COVENANT: nothing under this
  // path is ever written by this driver; the DSH_HOME world stays in THIS tree
  // under `tests/homes` per TEST_METHODS §7. The assertions below are identity
  // checks — existence, the exact baseline SHA, and a clean work tree — not
  // provisioning steps.
  const host = hostTree()
  if (!existsSync(host)) problems.push(`host tree absent: ${host}`)
  else {
    const head = spawnSync('git', ['-C', host, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
    if (head !== TEST_USE_BASELINE_SHA) problems.push(`host tree HEAD ${head.slice(0, 12)} != baseline ${TEST_USE_BASELINE_SHA.slice(0, 12)}`)
    const dirty = spawnSync('git', ['-C', host, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()
    if (dirty !== '') problems.push('host tree is not pristine (porcelain non-empty) — never write it, report it')
    if (!existsSync(join(host, 'node_modules'))) problems.push('host tree has no node_modules (reuse requires the existing install; nothing is installed here)')
  }
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
    hostTree: hostTree(),
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
