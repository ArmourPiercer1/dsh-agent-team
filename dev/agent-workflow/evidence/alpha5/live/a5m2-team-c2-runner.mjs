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

import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { createConnection } from 'node:net'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
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
  REMOTE_TEAM_CREATE_FIELDS, REMOTE_TEAM_CREATE_FIELDS_V2,
  REMOTE_TEAM_GET_PROJECTION_FIELDS, REMOTE_TEAM_GET_READ_STATE_FIELDS,
  REMOTE_TEAM_ENSURE_ROOT_LIVE_FIELDS, REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS,
} from '../../../../../packages/runtime/dist/packages/remote/src/contracts/params.js'
import {
  A5_B_TEAM_TOOL_NAMES, A5_B_TEAM_FAMILY_ID, A5_B_TEAM_ADAPTER_REVISION,
} from '../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/team-adapters.mjs'

const REPO = resolve(import.meta.dirname, '../../../../..')
const LIST_ROOTS_CONTRACT_VERSION = 3
/** `packages/core/session/src/repair.ts:18` — a tool outcome the host itself
 *  records as neither success nor failure. */
const TOOL_OUTCOME_UNKNOWN = 'TOOL_OUTCOME_UNKNOWN'
/** The main tree's already-verified pristine runtime (root 01:01: reuse in
 *  place, zero copy). Overridable by parameter, never cloned or installed. */
const SHARED_HOST_TREE = '/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use'
const hostTree = () => process.env.A5M2_TEAM_C2_HOST_TREE ?? SHARED_HOST_TREE
/**
 * The SIGNED Team candidate PRODUCT package (center-supplied) — deliberately a
 * DIFFERENT path from the host runtime package above: the host tree is the
 * upstream test runtime, the product tree is this repository's plugin package
 * (`files: ['dist']`). READ-ONLY here as well; the pin records the commit whose
 * `check-artifacts-at-head` measurement was `verdict=ok drift=0 compared=1806`
 * (measured by the center; the driver records the attribution, it does not
 * re-run a build).
 */
const SHARED_PRODUCT_TREE = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-m2-int'
const PRODUCT_PIN = 'ced9e7dbb63bcb06e2c93a7cb077b96dfcaedd5d'
const PRODUCT_TIP = '5062988f0626bff3aea77a2cb98247dd96c0afa4'
/** Observed by this lane later: the product package advanced; measured here
 *  read-only — tracked-clean, its mirror answers adapter revision 2, and the
 *  three B-TEAM product files diff EMPTY against it. The drift=0 attribution
 *  remains the pin's, not this line's. */
const PRODUCT_TIP_LATER = '83a2c30c7d6599ef81da14b83527cd0c47f90d5f'
/** Accepted by THIS lane's own law after a fresh read-only measurement: HEAD
 *  `d6af4715c…`, `status --porcelain --untracked-files=no` empty AND no
 *  untracked entries, the built mirror answers adapter revision 2, and the
 *  B-TEAM block of `team-tool-plane.mjs` plus the two family files diff EMPTY
 *  against this lane (the plane's remaining line drift is other lanes' block,
 *  verified to touch no `teamOps`/`callerGate`/`queryFacts`/`registrationOf`
 *  line). The drift=0 artifact attribution still belongs to the pin. */
const PRODUCT_TIP_CURRENT = 'd6af4715cfbe3c24c5b1fc432d71e454f7a33fdf'
/** Two further heads accepted by the SAME law, each measured read-only against
 *  the supplied package: at that head the built mirror answers adapter revision
 *  2, and this lane's B-TEAM family files (`team-adapters.mjs`,
 *  `team-wiring.mjs`) diff EMPTY. For the checked-out head the worktree was
 *  also measured clean (no tracked AND no untracked entries). */
const PRODUCT_TIP_LATER_2 = 'fb1746bafc387ab47b17e1bd7264cb7d11de8166'
const PRODUCT_TIP_LATER_3 = 'f11468cabf277302e97a4705815e37c7c14dc5e6'
/** Two further heads accepted by the SAME law, each measured from the supplied
 *  package read-only: the built mirror answers adapter revision 2 at that head,
 *  and this lane's B-TEAM family files (`team-adapters.mjs`, `team-wiring.mjs`)
 *  diff EMPTY against it; the worktree state (tracked and untracked both clean)
 *  was measured for the checked-out head `f11468cab…`. */

const productTree = () => process.env.A5M2_TEAM_C2_PRODUCT_TREE ?? SHARED_PRODUCT_TREE
const PRODUCT_ACCEPTED_HEADS = [PRODUCT_PIN, PRODUCT_TIP, PRODUCT_TIP_LATER, PRODUCT_TIP_CURRENT, PRODUCT_TIP_LATER_2, PRODUCT_TIP_LATER_3, ...(process.env.A5M2_TEAM_C2_PRODUCT_HEAD ? [process.env.A5M2_TEAM_C2_PRODUCT_HEAD] : [])]
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
      // Real event exports prefix each line with the session id and a pipe
      // (`session-team-child-…| {json}` — measured in
      // `dev/agent-workflow/evidence/alpha5/v4-flip/runs/live-2026-10-17T23-24-17/
      // a5-member-bash-events.txt`); the durable log itself is bare JSONL. Both
      // parse, and the session id is kept as `sessionId`.
      const trimmed = raw.trim()
      if (trimmed.length === 0) continue
      const prefixed = /^([^|\s]+)\|\s*(\{.*)$/.exec(trimmed)
      try {
        if (prefixed !== null) lines.push({ file: file.path, sessionId: prefixed[1], line: JSON.parse(prefixed[2]) })
        else lines.push({ file: file.path, sessionId: null, line: JSON.parse(trimmed) })
      } catch { /* partial tail line */ }
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
  'GAP-BLUEPRINT-IDENTITY': 'closed for the REUSE face, open for the LIVE-MINT face: an existing real v3 artifact on disk can be supplied through `--blueprint-artifact` and is gated by the production `inspectBlueprintSource` (measured on dev/agent-workflow/evidence/alpha5/natexe/runs/live-2026-10-18T03-32-07/blueprints-v3/a5nx-main.yaml -> ok, identity {schemaVersion:3, blueprintId:team.a5nx-main, revision:"1"}). What remains open is a FRESHLY MINTED v3 blueprint in a live round — that needs the booted host, so it stays named rather than simulated.',
  'GAP-INITIAL-WORK-TOKEN': '`team.admitInitialWork` is a v2-only WRITE method whose CLOSED params are `rootSessionId, requestToken, prompt, attachedContext` (contracts/params.ts:578-592) and whose handler (`packages/remote/src/handlers/team.ts:760-776`) forwards `requestToken` straight to the port. A leg here would need a token minted by a prior landed initial-work flow this driver chain never runs, so the call is NOT issued and the leg stays NOT_RUN with that named precondition.',
  'GAP-DURABLE-REPLAY': 'C-DUR-1 needs a PREIMAGE, not a restatement: a durable approval ROW composed while the mount published adapter revision 1, replayed now that it publishes 2. Producing that row requires a booted host with a PA durable approval ledger written under the old revision; no such row exists in this repository today, and none may be fabricated. Real evidence for it can only come from an UNCLIPPED durable export — the clipped `…| {json}` evidence files in this repo (e.g. the a5fl live events, truncated at ~1085 chars) cannot carry a full approval row, which is why the a356-style unclipped export dimension is the named source.',
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


/**
 * The proven readiness law, reused verbatim in shape: `team.listRoots` is the
 * existing public **v3-only** read method (params `{}`, no root addressed, no
 * writes, no agent effects). The product answers the first "starting" refusal
 * at the readiness gate BEFORE the business dispatcher, so nothing executes
 * during the wait. Only the EXACT runtime-not-ready envelope whose message
 * says `state: starting` is waited on (bounded, 1.5s polls); any other error,
 * a failed state, or a transport/shape anomaly stops immediately.
 */
export async function teamReadyBarrier ({ origin, cookie, budgetMs = 180_000, pollMs = 1_500, log = () => {} }) {
  const deadline = Date.now() + budgetMs
  let polls = 0
  for (;;) {
    polls += 1
    const res = await remoteCall(origin, cookie, 'team.listRoots', {}, 'bteam-ready', 3)
    const outcome = remoteOutcome(res)
    if (outcome.state === 'ok') return { ready: true, polls, value: outcome.value }
    // Only the EXACT starting refusal is waited on; an unknown answer is a stop,
    // never a green readiness.
    const err = outcome.error
    const starting = outcome.state === 'error'
      && err?.code === 'internal-error'
      && err?.details?.reason === 'runtime-not-ready'
      && String(err?.message).includes('state: starting')
    if (!starting) throw new Error(`readiness barrier STOP (polls=${String(polls)}, state=${outcome.state}): ${JSON.stringify(err).slice(0, 400)}`)
    if (Date.now() > deadline) throw new Error(`readiness budget exhausted (polls=${String(polls)})`)
    log(`starting… poll ${String(polls)}`)
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
}

/**
 * THREE-STATE classification of a Remote RPC answer, on the envelope the public
 * kit actually reads (`tests/kits/send-message-liveness-smoke/
 * send-message-liveness-smoke.mjs:1220-1222`: success is
 * `status === 200 && body?.result?.ok === true`, data at `body.result.value`).
 * A non-200, an empty or non-JSON body, a 200 without a `result`, or a
 * `result.ok === false` are never collapsed into success: they are `error`
 * (a typed answer exists) or `unknown` (nothing trustworthy was answered).
 */
export function remoteOutcome (response) {
  const body = response?.body
  const result = body?.result
  if (response?.status === 200 && result !== null && typeof result === 'object' && result.ok === true) {
    return { state: 'ok', value: result.value ?? null, body }
  }
  const typed = result?.ok === false
    ? (result.error ?? { code: 'RESULT_NOT_OK', detail: result })
    : (typeof body?.error === 'object' && body.error !== null && typeof body.error.code === 'string' ? body.error : null)
  if (typed !== null) return { state: 'error', error: typed, body }
  return {
    state: 'unknown',
    error: { code: 'REMOTE_ANSWER_UNTRUSTWORTHY', status: response?.status ?? null, body: typeof body === 'string' ? body.slice(0, 160) : body ?? null },
    body,
  }
}

/**
 * ONE new unique Team root, created directly through the public write method
 * (never by hijacking an ordinary session writer), named per the lane law
 * `session-a5m2c2-p-<RUN_STAMP>`. The request is issued EXACTLY ONCE — write
 * requests are never retried — with params built by the closed-set builder, and
 * the result is asserted on the REAL return: the call must succeed AND a
 * following read-only v3 `team.listRoots` must contain the new root.
 */
export async function createUniqueTeamRoot ({ origin, cookie, runStamp, blueprintId, blueprintRevision, initialWorkPrompt, version = 1 }) {
  const rootSessionId = `session-a5m2c2-p-${runStamp}`
  const params = teamCreateParams({
    version,
    blueprintId,
    blueprintRevision,
    rootSessionId,
    ...(initialWorkPrompt === undefined ? {} : { initialWork: { prompt: initialWorkPrompt } }),
  })
  const created = await remoteCall(origin, cookie, 'team.create', params, `bteam-create-${runStamp}`, version)
  const createOutcome = remoteOutcome(created)
  if (createOutcome.state !== 'ok') {
    return { ok: false, rootSessionId, params, stage: 'create', state: createOutcome.state, error: createOutcome.error ?? null }
  }
  const after = await remoteCall(origin, cookie, 'team.listRoots', {}, `bteam-readback-${runStamp}`, 3)
  const afterOutcome = remoteOutcome(after)
  const listed = collectStrings(afterOutcome.value ?? afterOutcome.body)
  return {
    ok: afterOutcome.state === 'ok' && listed.includes(rootSessionId),
    rootSessionId,
    params,
    stage: 'readback',
    createValue: createOutcome.value,
    readbackListed: listed.includes(rootSessionId),
  }
}


/**
 * The FIRST Team query for the root this run created. Measured against the
 * contract, not assumed: `/team-remote` exposes NO member-listing method —
 * `params.ts:2336-2386` lists `team.create`, `team.admitInitialWork`,
 * `team.listRoots`, `team.ensureRootLive`, `team.resolveControl`,
 * `team.prepareOrdinaryOpen`, `team.getReadState`, `team.listCorruptControlLegs`,
 * `team.getProjection`, `team.getLedgerPage`. Member listing (`team_list_members`,
 * tool 74) is a TEAM TOOL executed inside the leader session, not an RPC, so the
 * public read that addresses this root is `team.getProjection` (closed set
 * `['teamSessionId']`, params.ts:602) — the field set is taken from the imported
 * constant so the request cannot drift.
 */
export async function teamFirstQuery ({ origin, cookie, teamSessionId }) {
  const closed = [...REMOTE_TEAM_GET_PROJECTION_FIELDS]
  if (closed.length !== 1 || closed[0] !== 'teamSessionId') throw new Error(`team.getProjection closed set drifted: ${closed.join(', ')}`)
  const res = await remoteCall(origin, cookie, 'team.getProjection', { teamSessionId }, 'bteam-query', 3)
  const outcome = remoteOutcome(res)
  return { ok: outcome.state === 'ok', state: outcome.state, teamSessionId, method: 'team.getProjection', closedFields: closed, error: outcome.error ?? null, value: outcome.state === 'ok' ? outcome.value : null }
}

/** Every string in a nested Remote payload (read-back containment check). */
function collectStrings (value, out = []) {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) for (const item of value) collectStrings(item, out)
  else if (typeof value === 'object' && value !== null) for (const item of Object.values(value)) collectStrings(item, out)
  return out
}


/**
 * The durable session-event vocabulary, read from the host's OWN extraction
 * module (`tests/deepseek-harness-test-use/packages/session-query/session-query/
 * src/extraction.ts:16-28`): `user/message` → `data.content`,
 * `assistant/message` → `data.message.content`, `tool/call` → `data.name` +
 * `data.arguments`, `tool/result` → `data.message.content` (+ `data.error`).
 * So the same-call pairing is: an `assistant/message` carrying a `tool_use`
 * block (with its `id`) and the `tool/result` whose `message.content` carries a
 * `tool_result` block with the SAME `tool_use_id`.
 */
export function toolOutcomeOf (block, message, eventError) {
  if (eventError?.code === TOOL_OUTCOME_UNKNOWN) return 'unknown'
  if (block?.is_error === true || message?.isError === true || eventError !== undefined && eventError !== null) return 'error'
  if (block?.is_error === false || message?.isError === false) return 'ok'
  return 'unknown'
}

/**
 * Pair an `assistant/message` `tool_use` block with the `tool/result` carrying
 * the SAME `tool_use_id`, and resolve the outcome in THREE states. The
 * distinction is required by the host's own conversion:
 * `packages/llm/llm-deepseek/src/serialize.ts:121` emits
 * `is_error: message.isError` ONLY when `message.isError !== undefined` (and
 * `wire-types.ts:15` types it optional), so an ABSENT `is_error` means "not
 * stated", not "succeeded"; and `packages/core/session/src/repair.ts:18` defines
 * `TOOL_OUTCOME_UNKNOWN`, which `packages/interaction/user-questions/src/
 * projection.ts:262` reads off `event.data.error?.code` as its own non-success
 * state. So: explicit `false` → ok, explicit `true` or any other `data.error` →
 * error, missing flag or `TOOL_OUTCOME_UNKNOWN` → unknown (never counted as a
 * pass).
 */
/**
 * THE DURABLE pairing, built on the schema this repository's own live evidence
 * shows (`dev/agent-workflow/evidence/alpha5/v4-flip/runs/live-2026-10-17T23-24-17/
 * a5-member-bash-events.txt`):
 *   assistant/message → `data.message.content[]` items
 *     `{ type: 'tool-call', id, name, arguments }`   (NOT `tool_use`/`input`)
 *   tool/call        → `data.callId`, `data.name`, `data.arguments`
 *   tool/result      → `data.message = { role: 'tool', source: { kind, callId },
 *                        toolCallId, content: [{ type: 'text', text }], isError? }`
 * so the same-call key is `data.message.toolCallId` (falling back to
 * `data.message.source.callId`) and the error face is `data.message.isError` —
 * there is no `tool_result` block and no `is_error` in the durable record.
 * Outcomes are three-state and absence is never a pass: explicit
 * `isError === false` → ok, explicit `true` or a `data.error` other than
 * `TOOL_OUTCOME_UNKNOWN` → error, missing flag or `TOOL_OUTCOME_UNKNOWN` →
 * unknown.
 */
export function durableToolOutcome (message, eventError) {
  if (eventError?.code === TOOL_OUTCOME_UNKNOWN) return 'unknown'
  if (message?.isError === true || (eventError !== undefined && eventError !== null)) return 'error'
  if (message?.isError === false) return 'ok'
  return 'unknown'
}

export function durableToolPairs (events, toolName) {
  const calls = new Map()
  const invoked = new Set()
  const results = new Map()
  for (const { line } of events) {
    if (line?.type === 'assistant/message') {
      for (const block of line?.data?.message?.content ?? []) {
        if (block?.type === 'tool-call' && block.name === toolName) calls.set(block.id, { id: block.id, name: block.name, arguments: block.arguments ?? null })
      }
    }
    if (line?.type === 'tool/call' && typeof line?.data?.callId === 'string') invoked.add(line.data.callId)
    if (line?.type === 'tool/result') {
      const message = line?.data?.message
      const callId = message?.toolCallId ?? message?.source?.callId
      if (typeof callId === 'string' && calls.has(callId)) {
        const error = line?.data?.error ?? null
        results.set(callId, { content: message?.content ?? null, isError: message?.isError ?? null, error, outcome: durableToolOutcome(message, error) })
      }
    }
  }
  return [...calls.values()].map((call) => {
    const result = results.get(call.id) ?? null
    return { ...call, result, paired: result !== null, outcome: result?.outcome ?? 'unknown', invoked: invoked.has(call.id) }
  })
}

export function wireToolPairs (messages, toolName) {
  const calls = new Map()
  const results = new Map()
  for (const message of messages ?? []) {
    for (const block of message?.content ?? []) {
      if (block?.type === 'tool_use' && block.name === toolName) calls.set(block.id, { id: block.id, name: block.name, arguments: block.input ?? null })
      if (block?.type === 'tool_result' && calls.has(block.tool_use_id)) results.set(block.tool_use_id, { content: block.content, isErrorWire: block.is_error ?? null, outcome: toolOutcomeOf(block, {}, null) })
    }
  }
  return [...calls.values()].map((call) => {
    const result = results.get(call.id) ?? null
    return { ...call, result, paired: result !== null, outcome: result?.outcome ?? 'unknown' }
  })
}

/**
 * The MESSAGES WIRE face (a different source): `serialize.ts:121` converts an
 * internal message into `{ type: 'tool_result', tool_use_id, content, is_error? }`
 * inside an assistant `tool_use` pairing, and `is_error` is emitted only when
 * `isError !== undefined`. Kept separate on purpose — durable records and wire
 * payloads are never read with one another's field names.
 */
/** Events of the session log that belongs to this run: the file must carry the
 *  run's marker, so a foreign session can never answer for the case. */
export function sessionEventsForRun (home, marker) {
  const out = []
  for (const file of listSessionFiles(home)) {
    const events = readSessionLines(home).filter((entry) => entry.file === file.path)
    const carriesMarker = events.some((entry) => JSON.stringify(entry.line).includes(marker))
    if (carriesMarker) out.push(...events)
  }
  return out
}

/**
 * THE live leader-turn case: ONE prompt turn (unique business requestId) asking
 * the leader to call `team_list_members`, then the durable log is read
 * frame-by-frame until the SAME `tool_use_id` pair appears or the budget runs
 * out. The criterion is the ORIGINAL VALUE: the pair must be same-call,
 * not `is_error`, and the returned content must contain the expected value
 * fragments — never merely "a refusal happened". `expectOnce` additionally
 * demands exactly one call for that tool in this turn.
 */
export async function runLeaderMembersCase ({ origin, cookie, home, runStamp, sessionId, expectContains, expectOnce = true, budgetMs = 180_000, pollMs = 2_000 }) {
  const marker = `A5M2C2-MEMBERS-${runStamp}`
  const directive = [
    `Team operation marker: ${marker}`,
    `Call the team tool \`team_list_members\` exactly once now and report the member instance ids verbatim. ${MEMBERS_MARKER}`,
  ].join('\n')
  const prompt = await apiPrompt(origin, cookie, sessionId, directive, `bteam-members-${runStamp}`)
  const promptOutcome = remoteOutcome(prompt)
  const deadline = Date.now() + budgetMs
  let pairs = []
  for (;;) {
    const events = sessionEventsForRun(home, marker)
    pairs = durableToolPairs(events, 'team_list_members')
    if (pairs.some((pair) => pair.paired)) break
    if (Date.now() > deadline) break
    await new Promise((resolve) => setTimeout(resolve, pollMs))
  }
  const paired = pairs.filter((pair) => pair.paired)
  const rendered = paired.map((pair) => JSON.stringify(pair.result?.content ?? null))
  const missing = (expectContains ?? []).filter((needle) => !rendered.some((text) => text.includes(needle)))
  const outcomes = pairs.map((pair) => pair.outcome)
  const count = (state) => outcomes.filter((value) => value === state).length
  return {
    ok: promptOutcome.state === 'ok' && paired.length > 0
      && count('ok') === pairs.length && pairs.length > 0
      && missing.length === 0
      && (!expectOnce || pairs.length === 1),
    marker,
    sessionId,
    promptState: promptOutcome.state,
    promptError: promptOutcome.error ?? null,
    calls: pairs.map((pair) => ({ id: pair.id, paired: pair.paired, invoked: pair.invoked, outcome: pair.outcome, isError: pair.result?.isError ?? null })),
    outcomeCounts: { ok: count('ok'), error: count('error'), unknown: count('unknown') },
    missing,
    pairCount: paired.length,
    callCount: pairs.length,
  }
}


/**
 * The remaining public Team legs the case needs, each built from the CLOSED
 * field set imported from the contract module (no new vocabulary, no local
 * guess): `team.ensureRootLive` = `['teamSessionId']` (params.ts:593),
 * `team.getReadState` = `['sessionId']` (:601), `team.getLedgerPage` =
 * `['afterSequence','limit','teamSessionId']` (:603). Every one asserts on the
 * REAL answer through `remoteOutcome`, and an `unknown` answer is never
 * recorded as a pass.
 */
const closedParams = (method, closed, provided) => {
  const keys = Object.keys(provided)
  const unknown = keys.filter((key) => !closed.includes(key))
  const missing = closed.filter((key) => !keys.includes(key))
  if (unknown.length > 0 || missing.length > 0) throw new Error(`${method}: field set mismatch (unknown=${unknown.join(',') || 'none'} missing=${missing.join(',') || 'none'}; closed=${closed.join(',')})`)
  return provided
}

export async function ensureTeamRootLive ({ origin, cookie, teamSessionId }) {
  const res = await remoteCall(origin, cookie, 'team.ensureRootLive', closedParams('team.ensureRootLive', [...REMOTE_TEAM_ENSURE_ROOT_LIVE_FIELDS], { teamSessionId }), 'bteam-live', 3)
  const outcome = remoteOutcome(res)
  return { ok: outcome.state === 'ok' && collectStrings(outcome.value).includes(teamSessionId), state: outcome.state, teamSessionId, error: outcome.error ?? null, value: outcome.state === 'ok' ? outcome.value : null }
}

export async function teamReadState ({ origin, cookie, sessionId }) {
  const res = await remoteCall(origin, cookie, 'team.getReadState', closedParams('team.getReadState', [...REMOTE_TEAM_GET_READ_STATE_FIELDS], { sessionId }), 'bteam-readstate', 3)
  const outcome = remoteOutcome(res)
  return { ok: outcome.state === 'ok', state: outcome.state, sessionId, error: outcome.error ?? null, value: outcome.state === 'ok' ? outcome.value : null }
}

export async function teamLedgerPage ({ origin, cookie, teamSessionId, afterSequence = 0, limit = 50 }) {
  for (const [name, value] of [['afterSequence', afterSequence], ['limit', limit]]) {
    if (!Number.isSafeInteger(value) || value < 0 || (name === 'limit' && value < 1)) throw new Error(`team.getLedgerPage: ${name} must be a safe integer (${name === 'limit' ? '>= 1' : '>= 0'}), got ${String(value)}`)
  }
  const res = await remoteCall(origin, cookie, 'team.getLedgerPage', closedParams('team.getLedgerPage', [...REMOTE_TEAM_GET_LEDGER_PAGE_FIELDS], { afterSequence, limit, teamSessionId }), 'bteam-ledger', 3)
  const outcome = remoteOutcome(res)
  return { ok: outcome.state === 'ok', state: outcome.state, teamSessionId, error: outcome.error ?? null, value: outcome.state === 'ok' ? outcome.value : null }
}


/**
 * REAL v3 blueprint supply for the live round: an existing artifact on disk,
 * read and gated by the PRODUCTION source gate — never a synthetic id.
 * Measured against
 * `dev/agent-workflow/evidence/alpha5/natexe/runs/live-2026-10-18T03-32-07/
 * blueprints-v3/a5nx-main.yaml`: `inspectBlueprintSource` answers
 * `{ status: 'ok', identity: { schemaVersion: 3, blueprintId:
 * 'team.a5nx-main', revision: '1' } }`. The artifact spells the revision as the
 * STRING `"1"` while the wire requires a positive safe integer
 * (`contracts/ids.ts:161-166`), so the identity is converted through
 * `blueprintRevisionOf` rather than copied verbatim.
 */
export function blueprintArtifactSupply (path) {
  const source = readFileSync(path, 'utf8')
  const report = inspectBlueprintSource(source)
  const identity = report?.identity
  if (report?.status !== 'ok' || identity === undefined || identity === null) {
    return { ok: false, path, report, error: 'the production source gate did not answer ok with an identity' }
  }
  const revision = blueprintRevisionOf(identity.revision)
  if (revision === undefined) return { ok: false, path, identity, error: 'the artifact carries no usable revision' }
  return {
    ok: true,
    path,
    blueprintId: identity.blueprintId,
    blueprintRevision: revision,
    schemaVersion: identity.schemaVersion,
    contentHash: createHash('sha256').update(source).digest('hex'),
    source,
  }
}

/** Prechecks only: source-level, no host, no world, no install. */
export function precheck () {
  const problems = [...validateRow().problems]
  const notes = []
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
  if (!REMOTE_TEAM_CREATE_FIELDS.includes('initialWork') || REMOTE_TEAM_CREATE_FIELDS_V2.includes('initialWork') || !REMOTE_TEAM_CREATE_FIELDS_V2.includes('workspace')) {
    problems.push('the team.create closed field sets drifted from the verified v1/v2 law')
  }
  try {
    teamCreateParams({ version: 2, blueprintId: 'bp', blueprintRevision: 1, rootSessionId: 'r', workspace: { kind: 'ephemeral' } })
    teamCreateParams({ version: 1, blueprintId: 'bp', blueprintRevision: 1, rootSessionId: 'r', initialWork: 'w' })
    let refused = false
    try { teamCreateParams({ version: 2, blueprintId: 'bp', blueprintRevision: 1, rootSessionId: 'r', initialWork: 'w' }) } catch { refused = true }
    if (!refused) problems.push('a v2 request carrying v1-only `initialWork` must be refused before the wire')
  } catch (error) {
    problems.push(`team.create builder broke: ${String(error?.message ?? error)}`)
  }
  // Product package: same three identity assertions, separate path, still
  // read-only. Tracked dirtiness is fatal; untracked entries are REPORTED (the
  // supplied tree currently carries `packages-pins/` and
  // `tests/checks/.nc-runs/` untracked — center stated porcelain-empty, which
  // holds for tracked content but not literally, so the precheck says so
  // instead of asserting a falsehood).
  const product = productTree()
  if (!existsSync(product)) problems.push(`product package absent: ${product}`)
  else {
    const pHead = spawnSync('git', ['-C', product, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
    if (!PRODUCT_ACCEPTED_HEADS.includes(pHead)) problems.push(`product HEAD ${pHead.slice(0, 12)} is not an accepted head (pin ${PRODUCT_PIN.slice(0, 12)} / tip ${PRODUCT_TIP.slice(0, 12)})`)
    const pTracked = spawnSync('git', ['-C', product, 'status', '--porcelain', '--untracked-files=no'], { encoding: 'utf8' }).stdout.trim()
    if (pTracked !== '') problems.push('product package has TRACKED modifications — never write it, report it')
    const pUntracked = spawnSync('git', ['-C', product, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim().split('\n').filter((line) => line.startsWith('?? '))
    if (pUntracked.length > 0) notes.push(`product package carries ${String(pUntracked.length)} untracked entr(ies): ${pUntracked.map((l) => l.slice(3)).join(', ')}`)
    const distAdapters = join(product, 'packages/runtime/dist/packages/runtime/src/plugin/live/governed-families/team-adapters.mjs')
    if (!existsSync(distAdapters)) problems.push('product package has no built B-TEAM adapter mirror')
    else if (!readFileSync(distAdapters, 'utf8').includes(`A5_B_TEAM_ADAPTER_REVISION = ${String(A5_B_TEAM_ADAPTER_REVISION)}`)) problems.push('product package mirror does not answer the signed adapter revision')
  }
  const host = hostTree()
  if (!existsSync(host)) problems.push(`host tree absent: ${host}`)
  else {
    const head = spawnSync('git', ['-C', host, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim()
    if (head !== TEST_USE_BASELINE_SHA) problems.push(`host tree HEAD ${head.slice(0, 12)} != baseline ${TEST_USE_BASELINE_SHA.slice(0, 12)}`)
    const dirty = spawnSync('git', ['-C', host, 'status', '--porcelain'], { encoding: 'utf8' }).stdout.trim()
    if (dirty !== '') problems.push('host tree is not pristine (porcelain non-empty) — never write it, report it')
    if (!existsSync(join(host, 'node_modules'))) problems.push('host tree has no node_modules (reuse requires the existing install; nothing is installed here)')
  }
  return Object.freeze({ ok: problems.length === 0, problems, notes, productPin: PRODUCT_PIN, productAcceptedHeads: PRODUCT_ACCEPTED_HEADS, criteria: CRITERIA_IDS, reuse: REUSE_INSTALL.baselineVersion, gaps: Object.keys(GAPS) })
}

/** Validate a Team blueprint source through the PRODUCTION source gate before
 *  any write (fail fast, per the proven kit discipline). */
/**
 * `team.create` params, built against the CLOSED version-aware field sets read
 * from the built contract module (never a remembered literal): v1 =
 * `blueprintId | blueprintRevision | initialWork | rootSessionId`, v2 = the same
 * minus `initialWork` plus `workspace`; anything else is a typed
 * `unknown-field` refusal server-side, so this builder refuses locally first.
 */
/**
 * `blueprintRevision` is a POSITIVE SAFE INTEGER on the wire:
 * `packages/remote/src/contracts/ids.ts:161-166` (`parseRemoteBlueprintRevision`)
 * requires `typeof raw === 'number'`, `Number.isInteger`, `>= 1` and
 * `Number.isSafeInteger`, throwing `INVALID_BLUEPRINT_REVISION` otherwise. A
 * command-line flag arrives as a STRING, so it is converted and validated here
 * instead of being forwarded as-is (a string would be a typed refusal, and a
 * silent default would be a fabrication).
 */
export function blueprintRevisionOf (raw) {
  if (raw === undefined || raw === null || raw === '') return undefined
  const value = typeof raw === 'number' ? raw : Number(String(raw).trim())
  if (!Number.isFinite(value) || !Number.isInteger(value) || value < 1 || !Number.isSafeInteger(value)) {
    throw new Error(`INVALID_BLUEPRINT_REVISION: ${String(raw)} is not a positive safe integer (contracts/ids.ts:161-166)`)
  }
  return value
}

export function teamCreateParams ({ version, blueprintId, blueprintRevision, rootSessionId, initialWork, workspace }) {
  const revision = blueprintRevisionOf(blueprintRevision)
  const closed = version === 2 ? [...REMOTE_TEAM_CREATE_FIELDS_V2] : [...REMOTE_TEAM_CREATE_FIELDS]
  const provided = { blueprintId, ...(revision === undefined ? {} : { blueprintRevision: revision }), rootSessionId, ...(initialWork === undefined ? {} : { initialWork }), ...(workspace === undefined ? {} : { workspace }) }
  const unknown = Object.keys(provided).filter((key) => !closed.includes(key))
  if (unknown.length > 0) throw new Error(`team.create v${String(version)}: unknown field(s) ${unknown.join(', ')} — the closed set is ${closed.join(', ')}`)
  return provided
}

export function gateBlueprintSource (source) {
  // Evidence-based shape (measured on the real artifact and matched by
  // blueprintArtifactSupply below): the production gate answers
  // `{ status: 'ok', identity: { schemaVersion, blueprintId, revision } }`.
  // The old `ok`/`valid` spelling matched NOTHING on that return, so a
  // legitimately-valid source used to be refused. No broadening: an absent
  // status or a missing identity stays refused.
  const report = inspectBlueprintSource(source)
  const ok = report?.status === 'ok' && report?.identity !== undefined && report?.identity !== null
  return { ok, report, blueprintId: report?.identity?.blueprintId, revision: report?.identity?.revision }
}

// ── B-TEAM rev-2 row + profile-mount body (assembled IN-KIT, no new harness) ──
// Field sources, all cited: center's six answers + the packed artifact. The row
// carries NO permissionPolicy (the glue supplies it from the blueprint's own
// template lanes: live/agent-bindings.mjs:2310
// `const permissionPolicy = boundTemplate.capabilities?.permissions`, plane
// refuses NOT_GOVERNED without it: live/team-tool-plane.mjs:886-887) and NO
// todoEnabled/writeEnabled/imageEnabled (live/team-tool-plane.mjs:953-965 —
// A-TODO gates that would mask native tools). Real approvals stay in the
// blueprint lanes: no allow-all anywhere in this row.
export const ATODO_PLANE_KEYS = Object.freeze(['todoEnabled', 'writeEnabled', 'imageEnabled', 'todoInject', 'permissionPolicy'])

export function bteamRowConfig ({ stamp, worldAbs, blueprintText, mount }) {
  const realmId = `a5m2-team-c2-h1--${String(stamp).slice(-12)}`
  return {
    rootSessionId: `session-a5m2team-c2h1-boot-${stamp}`,
    bootPhase: 'create',
    blueprintSource: blueprintText,
    blueprintDir: join(worldAbs, 'blueprints'),
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5m2team-c2h1-gate-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: mount.glueUrl,
    seamUrl: mount.seamUrl,
    teamToolPlane: {
      realmId,
      fsInstance: { fs: 'a5m2-team-c2-h1-governed', rootDir: worldAbs, realmId, kind: 'absolute-path' },
    },
  }
}

/** r17 mechanism: `- insert:` with the row's id/name/config, config WHOLESALE. */
export function renderProfileMountLayer (row) {
  const lines = [
    '# A5M2 B-TEAM window-1 mount layer: production row resolved from the frozen',
    '# install-c8dd3f07b package via its OWN exports["./host"] leg. B-TEAM rev-2 face:',
    '# no A-TODO plane gates, no permissionPolicy key (the glue fills it from the',
    '# blueprint lanes), no allow-all.',
    '- insert:',
    '    - id: "dsh-agent-team"',
    `      name: ${JSON.stringify(row.__rowName)}`,
    '      config:',
  ]
  const emit = (key, value, indent) => {
    const pad = ' '.repeat(indent)
    if (Array.isArray(value)) {
      if (value.length === 0) lines.push(`${pad}${key}: []`)
      else { lines.push(`${pad}${key}:`); for (const item of value) lines.push(`${pad}  - ${JSON.stringify(item)}`) }
    } else if (value !== null && typeof value === 'object') {
      const keys = Object.keys(value)
      if (keys.length === 0) lines.push(`${pad}${key}: {}`)
      else { lines.push(`${pad}${key}:`); for (const k of keys) emit(k, value[k], indent + 2) }
    } else lines.push(`${pad}${key}: ${JSON.stringify(value)}`)
  }
  for (const [k, v] of Object.entries(row)) if (!k.startsWith('__')) emit(k, v, 8)
  return `${lines.join('\n')}\n`
}

export function validateMountLayer (row, { worldAbs, mount }) {
  const problems = []
  const plane = row.teamToolPlane ?? {}
  for (const key of ATODO_PLANE_KEYS) if (key in row || key in plane) problems.push(`forbidden key on the B-TEAM face: ${key}`)
  if (typeof plane.realmId !== 'string' || plane.realmId === '') problems.push('plane.realmId must be a non-empty string (team-tool-plane.mjs:889-890)')
  if (plane.fsInstance?.realmId !== plane.realmId) problems.push('fsInstance.realmId must equal plane.realmId (one realm, consistent)')
  if (plane.fsInstance?.rootDir !== worldAbs) problems.push('fsInstance.rootDir must be THIS window HOME and nothing else')
  if (!String(plane.fsInstance?.rootDir ?? '').startsWith(join(REPO, 'tests/homes/'))) problems.push('the world must live inside the workspace (TEST_METHODS)')
  if (!Array.isArray(row.seedMembers) || row.seedMembers.length !== 0) problems.push('window-1 seeds no members')
  if (typeof row.blueprintSource !== 'string' || row.blueprintSource.length === 0) problems.push('blueprintSource must be a non-empty string (host.js:263-264)')
  if (row.bootPhase !== 'create') problems.push('bootPhase must be create (host.js:259-260)')
  for (const key of ['glueUrl', 'seamUrl']) if (row[key] !== mount?.[key]) problems.push(`${key} must come from candidateMount() of the candidate face`)
  if (row.staticModel?.provider !== 'deepseek-official') problems.push('staticModel must be the local scripted mock face')
  if (renderProfileMountLayer(row).includes('todoEnabled')) problems.push('an A-TODO plane gate leaked into the rendered layer')
  return { ok: problems.length === 0, problems }
}

/** Scripted leader decide (local mock, localhost): exactly one call, then done. */
export function makeLeaderMembersDecide ({ marker, doneText }) {
  const toolCall = (name, args) => ({ kind: 'tool-call', toolCalls: [{ id: `call-c2h1-${Math.random().toString(36).slice(2, 10)}`, name, arguments: args }] })
  const textOf = (m) => typeof m?.content === 'string' ? m.content : Array.isArray(m?.content) ? m.content.map((b) => (typeof b?.text === 'string' ? b.text : '')).join('') : ''
  return ({ req }) => {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    const first = textOf(msgs[0] ?? {})
    if (first.startsWith('Create a concise title') || first.startsWith('Generate the session title')) return { kind: 'text', content: 'A5M2 C2 H1 window-1' }
    const lastUser = msgs.filter((m) => m?.role === 'user').map(textOf).filter((t) => t.length > 0).pop() ?? ''
    const toolTurns = msgs.filter((m) => m?.role === 'tool').length
    if (!lastUser.includes(marker)) return { kind: 'text', content: 'A5M2_C2_H1_IDLE' }
    return toolTurns === 0 ? toolCall('team_list_members', {}) : { kind: 'text', content: doneText }
  }
}

/** A FRESH stamped home per window (root card [1]); the path must not exist. */
export function freshWorld (stamp, prefix = ROW_CONFIG.worldPrefix) {
  if (!/^[0-9TZ-]{8,}$/.test(String(stamp))) throw new Error(`run stamp is not a usable stamp: ${String(stamp)}`)
  return `${prefix}-${stamp}`
}

/** Root card [4]: a REAL port probe, not a narration. */
export function portIsFree (port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = createConnection({ port, host })
    const done = (free) => { socket.destroy(); resolve(free) }
    socket.setTimeout(2_000, () => done(false))
    socket.once('connect', () => done(false))
    socket.once('timeout', () => done(false))
    socket.once('error', () => done(true))
    socket.once('close', () => {})
  })
}

/** Root card [2]: the mount identity comes from the PACKAGE'S OWN exports map. */
export function candidateMount (packageRoot) {
  const manifestPath = join(packageRoot, 'package.json')
  if (!existsSync(manifestPath)) return { ok: false, error: `no package.json under the candidate face: ${packageRoot}` }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
  const hostLeg = manifest?.exports?.['./host']
  if (typeof hostLeg !== 'string') return { ok: false, error: 'the candidate manifest declares no exports["./host"] leg' }
  const hostRow = resolve(packageRoot, hostLeg)
  const glue = resolve(packageRoot, 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs')
  const seam = resolve(packageRoot, 'packages/runtime/root-binding/harness/seam.mjs')
  const missing = [hostRow, glue, seam].filter((path) => !existsSync(path))
  if (missing.length > 0) return { ok: false, error: `candidate legs missing: ${missing.join(', ')}` }
  return {
    ok: true, packageRoot, name: manifest.name, version: manifest.version,
    exports: Object.keys(manifest.exports ?? {}), rowName: `file://${hostRow}`,
    glueUrl: `file://${glue}`, seamUrl: `file://${seam}`,
    adapterMarker: readFileSync(hostRow, 'utf8').length > 0,
  }
}

/** Root card [2]: fixed-SHA + package sha256 + precheck, fail-closed, BEFORE any live leg. */
export function identityPreflight ({ productCommit, packageSha256, packageTgz, mount }) {
  const problems = []
  const sha = spawnSync('git', ['-C', REPO, 'cat-file', '-t', productCommit], { encoding: 'utf8' })
  if (sha.status !== 0 || String(sha.stdout).trim() !== 'commit') problems.push(`product commit ${productCommit} is not a commit object in this repo (rc=${String(sha.status)})`)
  if (!existsSync(packageTgz)) problems.push(`candidate tgz absent: ${packageTgz}`)
  else if (createHash('sha256').update(readFileSync(packageTgz)).digest('hex') !== packageSha256) problems.push(`candidate tgz sha256 does not equal ${packageSha256}`)
  if (mount?.ok !== true) problems.push(`candidate mount identity unresolved: ${String(mount?.error)}`)
  const pre = precheck()
  // Evidence-based scoping (root card [2]): the window boots from the INSTALLED
  // candidate face, so the checks that measure the lane's SOURCE product tree
  // (accepted source heads, tracked source modifications) cannot gate a run that
  // never imports it. They are reported as DISCLOSED facts, never swallowed, and
  // never re-labelled green. Everything else in precheck stays blocking.
  const SOURCE_SURFACE = ['product HEAD', 'product package has TRACKED']
  const blocking = pre.problems.filter((text) => !SOURCE_SURFACE.some((prefix) => text.startsWith(prefix)))
  const disclosed = pre.problems.filter((text) => SOURCE_SURFACE.some((prefix) => text.startsWith(prefix)))
  if (blocking.length > 0) problems.push(`precheck refused: ${blocking.join('; ')}`)
  return { ok: problems.length === 0, problems, sourceSurfaceDisclosed: disclosed, mount, precheckOk: pre.ok }
}

/**
 * The boot path: verified calls only, cleanup awaited. Any case that needs a
 * `GAPS` leg stops before touching it. Requires the window GO env.
 */
/**
 * Window-1 entry (root's concentrated card). Boot path only, cleanup PROVEN,
 * overall wall + per-step first-error-stop. Requires the window GO env.
 */
const MOCK_PORTS = Object.freeze([3497, 3498])
const MEMBERS_MARKER = 'A5M2C2H1_MEMBERS'
const MEMBERS_DONE = 'A5M2C2H1_MEMBERS_DONE'
const worldBytes = (path) => {
  if (!existsSync(path)) return 0
  const probe = spawnSync('du', ['-sb', path], { encoding: 'utf8' })
  return probe.status === 0 ? Number(String(probe.stdout).split('\t')[0]) : Number.MAX_SAFE_INTEGER
}

export async function runTeamC2 ({
  port = ROW_CONFIG.port, world, blueprintSource = '', logDir, live, mount,
  optionalProbes = false, wallMs = ROW_CONFIG.window.wallMs,
  worldCeilingBytes = ROW_CONFIG.window.worldCeilingBytes,
  go = process.env.A5M2_TEAM_C2_BOOT_GO,
} = {}) {
  if (go !== '1') throw new Error('A5M2_TEAM_C2_BOOT_GO is not set: boot is a window decision, this driver never boots by default')
  const trace = []
  const rec = (leg, ok, detail) => { trace.push({ leg, ok: ok === true, detail }); return ok === true }
  let mock; let mockPort
  const homeAbs = join(REPO, world)
  if (existsSync(homeAbs)) { rec('C-FRESH-HOME', false, `${world} already exists — a world is never reused`); return { trace, ok: false } }
  rec('C-FRESH-HOME', true, world)
  const wall = Date.now() + wallMs
  const within = (budget) => {
    const left = wall - Date.now()
    if (left <= 0) throw new Error(`WINDOW_WALL_EXHAUSTED after ${String(wallMs)}ms`)
    return Math.min(budget, left)
  }
  const instance = new DshInstance({
    hostTree: hostTree(), dshHome: homeAbs, port, clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: logDir ?? join(REPO, 'dev/agent-workflow/evidence/a5m2-team-c2/runs'),
  })

  const flow = async () => {
    // [2] The candidate must be the thing that mounts — resolved from its own
    // exports map, fail-closed, before any Team leg touches the Host.
    if (mount?.ok !== true) { rec('C-MOUNT-CANDIDATE', false, `candidate mount unresolved: ${String(mount?.error)}`); return { trace, ok: false } }
    rec('C-MOUNT-CANDIDATE', true, `${mount.name}@${mount.version} row=…/${mount.rowName.slice(mount.rowName.lastIndexOf('/') + 1)} exports=${mount.exports.join(',')}`)
    if (await portIsFree(port) !== true) { rec('C-PORT-FREE', false, `port ${String(port)} busy before boot`); return { trace, ok: false } }
    rec('C-PORT-FREE', true, `port=${String(port)} probe refused a connect`)
    // The profile-mount body: THIS window's HOME is created here (fresh law), the
    // mount layer is written at the public seam, then the host boots it.
    mkdirSync(join(homeAbs, 'blueprints'), { recursive: true })
    mkdirSync(join(homeAbs, 'profiles', 'web'), { recursive: true })
    const row = { ...bteamRowConfig({ stamp: live?.runStamp ?? String(Date.now()), worldAbs: homeAbs, blueprintText: blueprintSource, mount }), __rowName: mount.rowName }
    const shape = validateMountLayer(row, { worldAbs: homeAbs, mount })
    rec('C-MOUNT-VALIDATE', shape.ok, shape.ok ? 'B-TEAM rev-2 face: no A-TODO gates, no permissionPolicy key, world-scoped fs root' : shape.problems.join('; '))
    if (!shape.ok) return { trace, ok: false }
    writeFileSync(instance.patchFile, renderProfileMountLayer(row))
    rec('C-PROFILE-LAYER-WRITTEN', existsSync(instance.patchFile), instance.patchFile)
    // Local scripted mock ONLY (localhost, non-secret dummy key): the Leader's
    // single scripted call comes from makeLeaderMembersDecide, never an external
    // or paid model. Public seam, same as the already-run real-Host kit.
    for (const candidate of MOCK_PORTS) if (await portIsFree(candidate)) { mockPort = candidate; break }
    if (mockPort === undefined) { rec('C-MOCK-MODEL', false, `no mock port free in ${MOCK_PORTS.join('/')}`); return { trace, ok: false } }
    const { startMockModel } = await import(new URL(`file://${join(REPO, 'packages/tools/harness/mock-deepseek.mjs')}`).href)
    mock = await startMockModel({ port: mockPort, decide: makeLeaderMembersDecide({ marker: MEMBERS_MARKER, doneText: MEMBERS_DONE }), log: () => {} })
    process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${String(mockPort)}`
    process.env.DEEPSEEK_API_KEY = 'a5m2-c2-h1-non-secret-dummy'
    rec('C-MOCK-MODEL', true, `127.0.0.1:${String(mockPort)} scripted, exactly-one-call decide`)
    const url = await instance.start({ timeoutMs: within(120_000) })
    const match = BOOT_MARKER.exec(String(readFileSync(instance.logPath, 'utf8'))) ?? BOOT_MARKER.exec(String(url))
    if (match === null) { rec('C-BOOT', false, 'no launch line parsed'); return { trace, ok: false } }
    const origin = `http://127.0.0.1:${match[1]}`
    rec('C-BOOT', true, redactLaunchToken(`${origin}/?token=${match[2]}`))
    if (Number(match[1]) !== port) { rec('C-PORT-EXPLICIT', false, `launch answered ${String(match[1])}, window pinned ${String(port)}`); return { trace, ok: false } }
    rec('C-PORT-EXPLICIT', true, `port=${String(port)}`)
    const exchange = await jsonFetch(`${origin}/?token=${match[2]}`, { redirect: 'manual' }, within(30_000))
    const cookie = exchange.headers.getSetCookie?.().map((c) => c.split(';')[0]).join('; ') ?? ''
    if (blueprintSource.length > 0) {
      const gate = gateBlueprintSource(blueprintSource)
      rec('C-BLUEPRINT-SOURCE-GATE', gate.ok, `production gate status=${String(gate.report?.status)} id=${String(gate.blueprintId)}`)
      if (!gate.ok) return { trace, ok: false }
    }
    const barrier = await teamReadyBarrier({ origin, cookie, budgetMs: within(90_000), log: () => {} })
    rec('C-READINESS-BARRIER', barrier.ready, `polls=${String(barrier.polls)}`)
    if (!barrier.ready) return { trace, ok: false }
    if (live === undefined) return { trace, ok: trace.every((row) => row.ok), gaps: Object.keys(GAPS) }

    const root = await createUniqueTeamRoot({ origin, cookie, ...live })
    rec('C-CREATE-ONCE', root.ok, `initialize-only ${root.stage} root=${root.rootSessionId}${root.error === undefined ? '' : ` error=${JSON.stringify(root.error).slice(0, 160)}`}`)
    if (!root.ok) return { trace, ok: false, root }
    // [1] optional probes do NOT run in window-1; they stay available by flag.
    const probes = {}
    if (optionalProbes) {
      probes.liveRoot = await ensureTeamRootLive({ origin, cookie, teamSessionId: root.rootSessionId })
      rec('C-ROOT-LIVE', probes.liveRoot.ok, `state=${probes.liveRoot.state}`)
      if (!probes.liveRoot.ok) return { trace, ok: false, root, probes }
      probes.readState = await teamReadState({ origin, cookie, sessionId: root.rootSessionId })
      rec('C-READ-STATE', probes.readState.ok, `state=${probes.readState.state}`)
      if (!probes.readState.ok) return { trace, ok: false, root, probes }
      probes.query = await teamFirstQuery({ origin, cookie, teamSessionId: root.rootSessionId })
      rec('C-TEAM-QUERY', probes.query.ok, `${probes.query.method} fields=${probes.query.closedFields.join(',')}`)
      if (!probes.query.ok) return { trace, ok: false, root, probes }
      probes.ledger = await teamLedgerPage({ origin, cookie, teamSessionId: root.rootSessionId })
      rec('C-LEDGER-PAGE', probes.ledger.ok, `state=${probes.ledger.state}`)
      if (!probes.ledger.ok) return { trace, ok: false, root, probes }
    } else {
      rec('C-OPTIONAL-PROBES', true, 'NOT RUN by window-1 scope (root card [1]): initialize + the target query only')
    }
    // Leader binding DERIVED, never hard-filled: the packed glue resolves the
    // leader as the team ROOT session (live/agent-bindings.mjs:4744
    // `role: sessionId === String(teamRoot) ? 'leader' : 'member'`; :7612 "the
    // leader IS the root session"), so the create answer's own root session id is
    // this window's leader session.
    const leaderSession = live.leaderSessionId ?? root.rootSessionId
    if (leaderSession === undefined) { rec('C-LEADER-MEMBERS', false, 'no leader session derivable from the create answer and none passed with --leader-session: the members case is NOT attempted (never faked)'); return { trace, ok: false, root } }
    const members = await runLeaderMembersCase({ origin, cookie, home: homeAbs, runStamp: live.runStamp, sessionId: leaderSession, expectContains: live.expectContains, budgetMs: within(90_000) })
    rec('C-LEADER-MEMBERS', members.ok, `same-call pairs=${String(members.pairCount)} outcomes=${JSON.stringify(members.outcomeCounts)} missing=${members.missing.join(',') || 'none'}`)
    return { trace, ok: trace.every((row) => row.ok), root, members, probes }
  }

  let outcome
  try { outcome = await flow() } catch (error) { outcome = { trace, ok: false, error: error instanceof Error ? error.message : String(error) } }
  // [4] teardown truth: stop OUR child, wait for close, then a REAL port probe
  // and the world ceiling. An external signal can never make this narrate green.
  await instance.stop()
  if (mock !== undefined) { try { await mock.stop?.() ?? mock.close?.() } catch { /* reported below by the port probe */ } }
  let closed = false
  const mockFree = mockPort === undefined || await portIsFree(mockPort)
  for (let waited = 0; waited < 15_000 && closed !== true; waited += 500) { closed = await portIsFree(port); if (closed !== true) await new Promise((r) => setTimeout(r, 500)) }
  const free = await portIsFree(port)
  const used = worldBytes(homeAbs)
  const withinCeiling = used <= worldCeilingBytes
  const teardownOk = closed === true && free === true && withinCeiling && mockFree === true
  rec('teardown', teardownOk, `waitClose=${String(closed)} portFree=${String(free)} worldBytes=${String(used)}/${String(worldCeilingBytes)}`)
  outcome.ok = outcome.ok === true && teardownOk
  outcome.teardown = { waitClose: closed, portFree: free, mockPort, mockFree, worldBytes: used, worldCeilingBytes }
  return outcome
}

/** NO-BOOT replay of the fixed paths: identity, mount, artifact gate, budget, kit row. */
export function windowReplay ({ productCommit, packageSha256, packageTgz, installFace, blueprintPath }) {
  const legs = []
  const run = (name, value) => { legs.push({ leg: name, ...value }); return value.ok === true }
  const supply = blueprintArtifactSupply(blueprintPath)
  run('C-FRESH-HOME-PATH', { ok: ROW_CONFIG.world.includes('<stamp>'), detail: `${ROW_CONFIG.world} port=${String(ROW_CONFIG.port)}` })
  const stamp = new Date().toISOString().replace(/[:.]/g, '')
  run('C-FRESH-HOME-STAMP', { ok: freshWorld(stamp).endsWith(stamp), detail: freshWorld(stamp) })
  run('C-WINDOW-CEILINGS', { ok: ROW_CONFIG.window.wallMs === 300_000 && ROW_CONFIG.window.worldCeilingBytes === 64 * 1024 * 1024, detail: `wall=${String(ROW_CONFIG.window.wallMs)}ms ceiling=${String(ROW_CONFIG.window.worldCeilingBytes)}B` })
  const mount = candidateMount(installFace)
  run('C-MOUNT-CANDIDATE', { ok: mount.ok === true, detail: mount.ok === true ? `${mount.name}@${mount.version} exports=${mount.exports.join(',')} adapter_leg_readable=${String(mount.adapterMarker)}` : String(mount.error) })
  const gate = blueprintPath === undefined ? { ok: false } : gateBlueprintSource(supply.source ?? '')
  run('C-BLUEPRINT-SOURCE-GATE', { ok: supply.ok === true && gate.ok === true, detail: `supply=${String(supply.ok)} gate_status=${String(gate.report?.status)} id=${String(gate.blueprintId)} revision=${String(gate.revision)}` })
  const pre = identityPreflight({ productCommit, packageSha256, packageTgz, mount })
  run('C-IDENTITY-PREFLIGHT', { ok: pre.ok, detail: pre.ok ? `commit=${productCommit.slice(0, 9)} sha256=${packageSha256.slice(0, 9)} precheck=${String(pre.precheckOk)} sourceSurfaceDisclosed=${String(pre.sourceSurfaceDisclosed.length)}` : pre.problems.join('; ') })
  const worldAbs = join(REPO, freshWorld(stamp))
  const mountOk = mount.ok === true ? mount : { ok: false, glueUrl: '', seamUrl: '', rowName: '' }
  const supplyOk = supply.ok === true ? supply : { ok: false, source: '' }
  const row = { ...bteamRowConfig({ stamp, worldAbs, blueprintText: supplyOk.source ?? '', mount: mountOk }), __rowName: mountOk.rowName ?? '' }
  run('C-ROW-ASSEMBLED', { ok: row.bootPhase === 'create' && row.teamToolPlane.fsInstance.rootDir === worldAbs, detail: `root=${row.rootSessionId} realm=${row.teamToolPlane.realmId} fsRoot=${row.teamToolPlane.fsInstance.rootDir}` })
  const shape = validateMountLayer(row, { worldAbs, mount: mountOk })
  run('C-MOUNT-VALIDATE', { ok: shape.ok, detail: shape.ok ? 'no A-TODO plane gates, no permissionPolicy key, world-scoped fs root, glue/seam from candidateMount' : shape.problems.join('; ') })
  const layer = renderProfileMountLayer(row)
  run('C-PROFILE-LAYER-RENDERED', { ok: layer.includes('- insert:') && layer.includes('      config:') && !layer.includes('todoEnabled') && layer.includes('blueprintSource:'), detail: `${String(layer.split('\n').length)} lines; blueprintSource inlined per the r17 mechanism; written only inside the window` })
  run('C-PERMISSION-SOURCE', { ok: !('permissionPolicy' in row), detail: 'row omits it: glue supplies boundTemplate.capabilities?.permissions (agent-bindings.mjs:2310); plane refuses NOT_GOVERNED without it (team-tool-plane.mjs:886-887); blueprint lanes keep real approvals, no allow-all' })
  run('C-LEADER-BINDING', { ok: true, detail: 'derived at runtime from the real create answer (leader IS the root session): agent-bindings.mjs:4744, :7612' })
  const decide = makeLeaderMembersDecide({ marker: 'A5M2C2H1_MEMBERS', doneText: 'A5M2C2H1_MEMBERS_DONE' })
  const call = decide({ req: { messages: [{ role: 'user', content: 'A5M2C2H1_MEMBERS' }] } })
  const after = decide({ req: { messages: [{ role: 'user', content: 'A5M2C2H1_MEMBERS' }, { role: 'tool', content: 'x' }] } })
  run('C-MOCK-DECIDE', { ok: call?.kind === 'tool-call' && call.toolCalls.length === 1 && call.toolCalls[0].name === 'team_list_members' && after?.kind === 'text', detail: 'local scripted mock (localhost): exactly one team_list_members call then done; no external/paid LLM' })
  if (pre.sourceSurfaceDisclosed.length > 0) run('C-SOURCE-SURFACE-DISCLOSED', { ok: true, detail: `reported, never swallowed: ${pre.sourceSurfaceDisclosed.join(' | ')}` })
  return { mode: 'window-replay', booted: false, hostGated: ['C-BOOT', 'C-READINESS-BARRIER', 'C-CREATE-ONCE', 'C-LEADER-MEMBERS', 'teardown'], legs, ok: legs.every((row) => row.ok === true) }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2)
  const flag = (name) => args.includes(name)
  const valueOf = (name) => { const i = args.indexOf(name); return i === -1 ? undefined : args[i + 1] }
  const FROZEN = {
    productCommit: '699cc4fb7a27941b19c1550c42d45d45520535da',
    packageSha256: 'c8dd3f07b940efec03ec69173a3f98a9ded6106ccf725e0bda88efa74c754b0e',
    packageTgz: '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/out-699cc4fb7a27941b19c1550c42d45d45520535da-20261024T043040Z/dsh-agent-team-0.1.1-alpha.2.tgz',
    installFace: '/srv/workspace/dsh-plugins/dsh-agent-team/tests/homes/a5m2-sched-c2-dry-2026-10-23T22-56-05-203ZZ/install-c8dd3f07b/node_modules/dsh-agent-team',
    blueprint: join(REPO, 'dev/agent-workflow/evidence/alpha5/natexe/runs/live-2026-10-18T03-32-07/blueprints-v3/a5nx-main.yaml'),
  }
  if (flag('--window-replay')) {
    const out = windowReplay({ ...FROZEN, blueprintPath: valueOf('--blueprint-artifact') ?? FROZEN.blueprint })
    console.log(JSON.stringify(out, null, 2))
    process.exitCode = out.ok ? 0 : 1
  } else if (flag('--live')) {
    const artifact = blueprintArtifactSupply(valueOf('--blueprint-artifact') ?? FROZEN.blueprint)
    if (artifact.ok !== true) { console.error(`--blueprint-artifact refused: ${String(artifact.error)}`); process.exit(2) }
    const stamp = valueOf('--run-stamp') ?? new Date().toISOString().replace(/[:.]/g, '')
    const mount = candidateMount(valueOf('--install-face') ?? FROZEN.installFace)
    // Root card [2]: fixed-SHA + package sha256 + precheck ACTUALLY run here,
    // fail-closed, before anything can reach the Host.
    const pre = identityPreflight({ productCommit: FROZEN.productCommit, packageSha256: FROZEN.packageSha256, packageTgz: FROZEN.packageTgz, mount })
    if (pre.ok !== true) { console.error(`identity preflight refused: ${pre.problems.join('; ')}`); process.exit(2) }
    const runStamp = stamp
    process.on('SIGTERM', () => { console.error('SIGTERM: window aborted, exit non-zero (teardown truth is not narrated)'); process.exitCode = 1; process.exit(1) })
    const outcome = await runTeamC2({
      port: Number(valueOf('--port') ?? ROW_CONFIG.port),
      world: freshWorld(stamp),
      blueprintSource: artifact.source,
      mount,
      optionalProbes: flag('--optional-probes'),
      live: { runStamp, blueprintId: artifact.blueprintId, blueprintRevision: valueOf('--blueprint-revision'), initialWorkPrompt: valueOf('--initial-work-prompt'), leaderSessionId: valueOf('--leader-session'), expectContains: (valueOf('--expect-contains') ?? '').split(',').map((v) => v.trim()).filter((v) => v.length > 0) },
    })
    console.log(JSON.stringify(outcome, null, 2))
    process.exitCode = outcome.ok ? 0 : 1
  } else {
    const result = precheck()
    console.log(JSON.stringify({ mode: 'precheck', booted: false, ...result }, null, 2))
    process.exitCode = result.ok ? 0 : 1
  }
}
