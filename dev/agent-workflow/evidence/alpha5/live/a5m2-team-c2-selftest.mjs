/**
 * Source-level self-test for the C2 driver's session-log reader — no host, no
 * world, no boot. It pins the matrix lesson the reader exists because of: a log
 * file with MORE THAN ONE zstd frame (what a restarted session writes) must
 * yield every frame, while a single whole-buffer decompress is not trusted to
 * do so.
 */
import { readFileSync } from 'node:fs'
import { zstdCompressSync, zstdDecompressSync } from 'node:zlib'
import { decodeSessionLogFrames, remoteOutcome, teamCreateParams, createUniqueTeamRoot, teamFirstQuery, blueprintRevisionOf, ensureTeamRootLive, teamReadState, teamLedgerPage, durableToolPairs, wireToolPairs, toolOutcomeOf, durableToolOutcome } from './a5m2-team-c2-runner.mjs'

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
  startingIsWaitable: remoteOutcome({ status: 200, body: STARTING }).error?.details?.reason === 'runtime-not-ready'
    && String(STARTING.error.message).includes('state: starting')
    && remoteOutcome({ status: 200, body: STARTING }).state === 'error',
  okUsesTheRealResultEnvelope: remoteOutcome({ status: 200, body: { result: { ok: true, value: OK_ROOTS } } }).state === 'ok',
  v2RefusesInitialWork: (() => { try { teamCreateParams({ version: 2, blueprintId: 'b', blueprintRevision: 1, rootSessionId: 'r', initialWork: 'w' }); return false } catch { return true } })(),
  v1AcceptsInitialWork: (() => { try { teamCreateParams({ version: 1, blueprintId: 'b', blueprintRevision: 1, rootSessionId: 'r', initialWork: { prompt: 'p' } }); return true } catch { return false } })(),
}
// A fake transport stands in for the host: create answers ok once, the
// read-back answers with the root listed, and the assertion is on the REAL
// returned object (never on a retry, never on a caught exception).
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body)
  const value = body.method === 'team.create'
    ? { data: { path: 'fresh-root', rootSessionId: body.payload.params.rootSessionId } }
    : body.method === 'team.getProjection'
      ? { projection: { teamSessionId: body.payload.params.teamSessionId, members: [] } }
      : body.method === 'team.ensureRootLive' || body.method === 'team.getReadState'
        ? { addressed: body.payload.params.teamSessionId ?? body.payload.params.sessionId, state: 'live' }
        : body.method === 'team.getLedgerPage'
          ? { entries: [], nextAfterSequence: 0 }
          : { roots: [{ rootSessionId: body.payload.params.rootSessionId ?? 'session-a5m2c2-p-T1' }] }
  return { status: 200, headers: new Headers(), text: async () => JSON.stringify({ result: { ok: true, value } }) }
}
const root = await createUniqueTeamRoot({ origin: 'http://127.0.0.1:1', cookie: 'c', runStamp: 'T1', blueprintId: 'team.bteam.c2', blueprintRevision: 1 })
contract.createOnceThenReadbackListsTheRoot = root.ok === true && root.stage === 'readback' && root.readbackListed === true
contract.rootSessionIdFollowsLaneLaw = root.rootSessionId === 'session-a5m2c2-p-T1'
const query = await teamFirstQuery({ origin: 'http://127.0.0.1:1', cookie: 'c', teamSessionId: root.rootSessionId })
contract.firstTeamQueryAddressesTheCreatedRoot = query.ok === true && query.method === 'team.getProjection'
  && query.closedFields.join(',') === 'teamSessionId'
  && JSON.stringify(query.value).includes(root.rootSessionId)
/* Same-call pairing and the ORIGINAL-VALUE criterion, exercised over the
 * durable vocabulary the host's own extraction module defines
 * (`assistant/message` → data.message.content, `tool/result` →
 * data.message.content). Canned events — the live body is in the runner and
 * runs only on a booted round. */
const CALL_ID = 'call-a5m2c2-1'
const events = [
  { file: 'f', line: { type: 'assistant/message', data: { message: { content: [{ type: 'tool-call', id: CALL_ID, name: 'team_list_members', arguments: '{}' }] } } } },
  { file: 'f', line: { type: 'tool/call', data: { callId: CALL_ID, name: 'team_list_members', arguments: '{}' } } },
  { file: 'f', line: { type: 'tool/result', data: { message: { role: 'tool', source: { kind: 'tool', callId: CALL_ID }, toolCallId: CALL_ID, isError: false, content: [{ type: 'text', text: '{"members":[{"memberInstanceId":"mi-1"}]}' }] } } } },
  { file: 'f', line: { type: 'tool/result', data: { message: { role: 'tool', toolCallId: 'other-id', isError: false, content: [] } } } },
]
/* The three-state outcome, over the host's own conversion law:
 * serialize.ts:121 emits `is_error` only when `isError !== undefined`, so a
 * missing flag is NOT a pass; repair.ts:18 / projection.ts:262 make
 * TOOL_OUTCOME_UNKNOWN its own non-success state. */
const wire = (isErrorWire) => ({ is_error: isErrorWire })
contract.outcomeExplicitFalseIsOk = toolOutcomeOf(wire(false), {}, null) === 'ok'
contract.outcomeMissingFlagIsUnknown = toolOutcomeOf({}, {}, null) === 'unknown'
contract.outcomeExplicitTrueIsError = toolOutcomeOf(wire(true), {}, null) === 'error'
contract.outcomeInternalIsErrorFalseIsOk = toolOutcomeOf({}, { isError: false }, null) === 'ok'
contract.outcomeUnknownErrorCodeStaysUnknown = toolOutcomeOf(wire(false), {}, { code: 'TOOL_OUTCOME_UNKNOWN' }) === 'unknown'
contract.outcomeOtherErrorIsError = toolOutcomeOf(wire(false), {}, { code: 'TOOL_FAILED' }) === 'error'
const pairs = durableToolPairs(events, 'team_list_members')
contract.sameCallPairingUsesTheDurableToolCallId = pairs.length === 1 && pairs[0].paired === true && pairs[0].invoked === true && pairs[0].outcome === 'ok' && pairs[0].result.isError === false
contract.foreignToolResultIsNotCounted = pairs.length === 1 && pairs[0].result.content.some((block) => block.type === 'text' && block.text.includes('mi-1'))
/* The REAL durable error face from the live evidence (`isError: true`, a guard
 * block): it must classify as error, never as a pass. */
contract.durableIsErrorTrueIsError = durableToolOutcome({ role: 'tool', toolCallId: CALL_ID, isError: true, content: [{ type: 'text', text: 'Error: team tool guard: the Tool Binding' }] }, null) === 'error'
contract.durableMissingIsErrorIsUnknown = durableToolOutcome({ role: 'tool', toolCallId: CALL_ID, content: [] }, null) === 'unknown'
contract.durableUnknownErrorCodeStaysUnknown = durableToolOutcome({ role: 'tool', toolCallId: CALL_ID, content: [] }, { code: 'TOOL_OUTCOME_UNKNOWN' }) === 'unknown'
/* The envelope's own three states: non-200 empty body and a 200 without a
 * `result` are unknown, never readiness-green; `result.ok === false` is error. */
contract.envelopeNonOkStatusIsUnknown = remoteOutcome({ status: 500, body: '' }).state === 'unknown'
contract.envelopeWithoutResultIsUnknown = remoteOutcome({ status: 200, body: { ok: true } }).state === 'unknown'
contract.envelopeResultNotOkIsError = remoteOutcome({ status: 200, body: { result: { ok: false, error: { code: 'X' } } } }).state === 'error'
/* The wire face stays separate and still refuses to read absence as success. */
/* The blueprint-revision law (contracts/ids.ts:161-166): a CLI string is
 * converted, a bad value is refused, nothing is defaulted. */
contract.revisionStringConverted = blueprintRevisionOf('3') === 3 && blueprintRevisionOf(3) === 3
contract.revisionBadValuesRefused = [0, -1, 1.5, 'x', Number.MAX_SAFE_INTEGER + 5].every((bad) => { try { blueprintRevisionOf(bad); return false } catch { return true } })
contract.revisionOmittedStaysOmitted = blueprintRevisionOf(undefined) === undefined && blueprintRevisionOf('') === undefined
contract.createParamsCarryANumberRevision = teamCreateParams({ version: 1, blueprintId: 'b', blueprintRevision: '2', rootSessionId: 'r', initialWork: { prompt: 'p' } }).blueprintRevision === 2
/* REAL Host-written bytes from this repository's own live evidence — used for
 * what they can actually prove. Measured: the export CLIPS long lines
 * (`Unterminated string` at ~1085 chars), so the `assistant/message` line with
 * the `tool-call` block is NOT parseable here and NO pairing claim is made from
 * this file. What it does prove is the durable field law and the real error
 * face, and both are asserted on its own bytes. */
const EVIDENCE = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-team/dev/agent-workflow/evidence/alpha5/v4-flip/runs/live-2026-10-17T23-24-17/a5-member-bash-events.txt'
const evidenceText = readFileSync(EVIDENCE, 'utf8')
const evidenceLines = evidenceText.split('\n').map((raw) => raw.trim()).filter((raw) => raw.length > 0)
const evidenceParsed = []
let evidenceClipped = 0
for (const raw of evidenceLines) {
  const match = /^([^|\s]+)\|\s*(\{.*)$/.exec(raw)
  try { evidenceParsed.push(JSON.parse(match !== null ? match[2] : raw)) } catch { evidenceClipped += 1 }
}
const realResult = evidenceParsed.find((line) => line?.type === 'tool/result' && line?.data?.message?.isError === true)
contract.realBytesConfirmDurableFieldLaw = evidenceText.includes('"type":"tool-call"')
  && evidenceText.includes('"toolCallId"') && evidenceText.includes('"isError":true')
contract.realDurableResultIsErrorNotPass = realResult !== undefined
  && durableToolOutcome(realResult.data.message, realResult.data.error ?? null) === 'error'
  && typeof realResult.data.message.toolCallId === 'string'
contract.evidenceIsClippedSoNoPairingClaimFromIt = evidenceClipped > 0 && evidenceParsed.filter((line) => line?.type === 'assistant/message').length === 0

/* The remaining public Team legs: closed field sets enforced, real answers
 * asserted, and a bad ledger `limit` refused before the wire. */
contract.ensureRootLiveClosedSetAndRealAnswer = (await ensureTeamRootLive({ origin: 'http://127.0.0.1:1', cookie: 'c', teamSessionId: root.rootSessionId })).ok === true
contract.readStateAnswers = (await teamReadState({ origin: 'http://127.0.0.1:1', cookie: 'c', sessionId: root.rootSessionId })).ok === true
contract.ledgerPageAnswers = (await teamLedgerPage({ origin: 'http://127.0.0.1:1', cookie: 'c', teamSessionId: root.rootSessionId })).ok === true
contract.ledgerLimitIsValidated = (await Promise.all([0, -1, 1.5, 'x'].map(async (bad) => {
  try { await teamLedgerPage({ origin: 'http://127.0.0.1:1', cookie: 'c', teamSessionId: 'r', limit: bad }); return false } catch { return true }
}))).every(Boolean)
contract.wireFaceSeparateAndAbsenceUnknown = wireToolPairs([{ role: 'assistant', content: [{ type: 'tool_use', id: 'w1', name: 'team_list_members', input: {} }] }, { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'w1', content: [] }] }], 'team_list_members')[0].outcome === 'unknown'
console.log(JSON.stringify(result, null, 2))
result.contract = contract
console.log(JSON.stringify({ contractTrueCount: Object.values(contract).filter(Boolean).length, contractFalse: Object.entries(contract).filter(([, v]) => !v).map(([k]) => k) }))
process.exitCode = result.frameSegmentedRecoversBoth && Object.values(contract).every(Boolean) ? 0 : 1
