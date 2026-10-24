/**
 * Source-level self-test for the C2 driver's session-log reader — no host, no
 * world, no boot. It pins the matrix lesson the reader exists because of: a log
 * file with MORE THAN ONE zstd frame (what a restarted session writes) must
 * yield every frame, while a single whole-buffer decompress is not trusted to
 * do so.
 */
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import { decodeSessionLogFrames, resultError, teamCreateParams, createUniqueTeamRoot, teamFirstQuery, sameCallToolPairs } from './a5m2-team-c2-runner.mjs'

const first = Buffer.from('{"line":"frame-one"}\n')
const second = Buffer.from('{"line":"frame-two"}\n')
const log = Buffer.concat([zstdCompressSync(first), zstdCompressSync(second)])

let wholeFileDecode
try {
  wholeFileDecode = { ok: true, text: zstdDecompressSync(log).toString('utf8') }
} catch (error) {
  wholeFileDecode = { ok: false, error: String(error?.code ?? error?.message ?? error).slice(0, 60) }
}

const frames = decodeSessionLogFrames(log).toString('utf8')
const result = {
  framesInLog: 2,
  bytes: log.length,
  wholeFileDecode,
  frameSegmentedRecoversBoth: frames.includes('frame-one') && frames.includes('frame-two'),
}
/* Contract-level proof of the ready/create/read-back logic against canned
 * Remote envelopes — NOT a host round, and not presented as one. */
const STARTING = { error: { code: 'internal-error', message: 'team runtime state: starting', details: { reason: 'runtime-not-ready' } } }
const OK_ROOTS = { payload: { ok: true, roots: [{ rootSessionId: 'session-a5m2c2-p-T1' }] } }
const contract = {
  startingIsWaitable: resultError(STARTING)?.details?.reason === 'runtime-not-ready'
    && String(STARTING.error.message).includes('state: starting'),
  okIsNotAnError: resultError(OK_ROOTS) === null,
  v2RefusesInitialWork: (() => { try { teamCreateParams({ version: 2, blueprintId: 'b', blueprintRevision: 1, rootSessionId: 'r', initialWork: 'w' }); return false } catch { return true } })(),
  v1AcceptsInitialWork: (() => { try { teamCreateParams({ version: 1, blueprintId: 'b', blueprintRevision: 1, rootSessionId: 'r', initialWork: { prompt: 'p' } }); return true } catch { return false } })(),
}
// A fake transport stands in for the host: create answers ok once, the
// read-back answers with the root listed, and the assertion is on the REAL
// returned object (never on a retry, never on a caught exception).
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body)
  const payload = body.method === 'team.create'
    ? { ok: true, rootSessionId: body.payload.params.rootSessionId }
    : body.method === 'team.getProjection'
      ? { ok: true, projection: { teamSessionId: body.payload.params.teamSessionId, members: [] } }
      : { ok: true, roots: [{ rootSessionId: body.payload.params.rootSessionId ?? 'session-a5m2c2-p-T1' }] }
  return { status: 200, headers: new Headers(), text: async () => JSON.stringify({ payload }) }
}
const root = await createUniqueTeamRoot({ origin: 'http://127.0.0.1:1', cookie: 'c', runStamp: 'T1', blueprintId: 'team.bteam.c2', blueprintRevision: 1 })
contract.createOnceThenReadbackListsTheRoot = root.ok === true && root.stage === 'readback' && root.readbackListed === true
contract.rootSessionIdFollowsLaneLaw = root.rootSessionId === 'session-a5m2c2-p-T1'
const query = await teamFirstQuery({ origin: 'http://127.0.0.1:1', cookie: 'c', teamSessionId: root.rootSessionId })
contract.firstTeamQueryAddressesTheCreatedRoot = query.ok === true && query.method === 'team.getProjection'
  && query.closedFields.join(',') === 'teamSessionId'
  && query.body.payload.projection.teamSessionId === root.rootSessionId
/* Same-call pairing and the ORIGINAL-VALUE criterion, exercised over the
 * durable vocabulary the host's own extraction module defines
 * (`assistant/message` → data.message.content, `tool/result` →
 * data.message.content). Canned events — the live body is in the runner and
 * runs only on a booted round. */
const CALL_ID = 'call-a5m2c2-1'
const events = [
  { file: 'f', line: { type: 'assistant/message', data: { message: { content: [{ type: 'tool_use', id: CALL_ID, name: 'team_list_members', input: {} }] } } } },
  { file: 'f', line: { type: 'tool/result', data: { message: { content: [{ type: 'tool_result', tool_use_id: CALL_ID, is_error: false, content: [{ type: 'text', text: '{"members":[{"memberInstanceId":"mi-1"}]}' }] }] } } } },
  { file: 'f', line: { type: 'tool/result', data: { message: { content: [{ type: 'tool_result', tool_use_id: 'other-id', content: [] }] } } } },
]
const pairs = sameCallToolPairs(events, 'team_list_members')
contract.sameCallPairingUsesTheToolUseId = pairs.length === 1 && pairs[0].paired === true && pairs[0].result.isError === false
contract.foreignToolResultIsNotCounted = pairs[0].result.content.some((block) => block.type === 'text' && block.text.includes('mi-1'))
console.log(JSON.stringify(result, null, 2))
process.exitCode = result.frameSegmentedRecoversBoth && Object.values(contract).every(Boolean) ? 0 : 1
