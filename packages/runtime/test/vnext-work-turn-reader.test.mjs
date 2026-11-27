/**
 * vnext-work-turn-reader.test.mjs — the delivery read law, on its own.
 *
 * These arms exist because the reader was extracted from a 5,300-line composition: the only way it was
 * ever exercised before was through a delivery in a live world, which meant its defensive branches
 * (no log seam, no delivered message, an aborted turn, a crashed turn) were proven by whatever path
 * happened to hit them. Each arm here pins one branch directly.
 *
 * Run: node --test packages/runtime/test/vnext-work-turn-reader.test.mjs
 */
import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  WORK_RESULT_CODE_NO_BODY,
  WORK_RESULT_CODE_TURN_ABORTED,
  WORK_RESULT_CODE_TURN_BLOCKED,
  WORK_RESULT_CODE_TURN_ERROR,
  WORK_RESULT_CODE_TURN_INTERRUPTED,
  WORK_RESULT_CODE_TURN_MAX_TOKENS,
  WORK_RESULT_CODE_TURN_UNREADABLE,
  readDeliveredWorkTurn,
  workMessageText,
} from '../src/plugin/vnext/work-turn-reader.mjs'

const text = (value) => ({ type: 'text', text: value })
const userMessage = (value) => ({ type: 'user/message', data: { content: [text(value)] } })
const assistantMessage = (value, turn) => ({
  type: 'assistant/message',
  // The host's event shape: the MESSAGE lives at data.message, and the turn at data.turn (the reader
  // filters by both; a fixture that puts the content at data.content proves nothing).
  data: { ...(turn === undefined ? {} : { turn }), message: { content: [text(value)] } },
})
const turnStart = (turn) => ({ type: 'turn/start', data: { turn } })
const turnEnd = (turn, reason) => ({ type: 'turn/end', data: { turn, reason } })
const sessionWith = (events) => ({ ownEvents: () => events })
const TOKEN = 'token-1'
const DELIVERY = `[team-work requestToken=${TOKEN}] do the thing`

test('READER-1 — a delivered turn with assistant text is succeeded, and the text is the body', () => {
  const result = readDeliveredWorkTurn(sessionWith([
    turnStart('t1'),
    userMessage(DELIVERY),
    assistantMessage('the answer', 't1'),
    turnEnd('t1', { kind: 'completed' }),
  ]), TOKEN)
  assert.equal(result.requestToken, TOKEN)
  assert.equal(result.status, 'succeeded')
  assert.equal(result.body, 'the answer')
})

test('READER-2 — the LAST delivery wins when the token was delivered twice (a resume)', () => {
  const result = readDeliveredWorkTurn(sessionWith([
    turnStart('t1'), userMessage(DELIVERY), assistantMessage('stale', 't1'), turnEnd('t1', { kind: 'completed' }),
    turnStart('t2'), userMessage(DELIVERY), assistantMessage('fresh', 't2'), turnEnd('t2', { kind: 'completed' }),
  ]), TOKEN)
  assert.equal(result.status, 'succeeded')
  assert.equal(result.body, 'fresh', 'a resume must read the delivery this call observes, not the first one')
})

test('READER-3 — a turn with no assistant body is explicit, never an empty success', () => {
  // The reader's own documented law: a completed turn without a non-empty body is `unavailable`, not
  // `succeeded` and not `failed` - the turn did complete, we simply have nothing to deliver.
  for (const events of [
    [turnStart('t1'), userMessage(DELIVERY), assistantMessage('', 't1'), turnEnd('t1', { kind: 'completed' })],
    [turnStart('t1'), userMessage(DELIVERY), turnEnd('t1', { kind: 'completed' })],
  ]) {
    const result = readDeliveredWorkTurn(sessionWith(events), TOKEN)
    assert.equal(result.status, 'unavailable')
    assert.equal(result.error.code, WORK_RESULT_CODE_NO_BODY)
  }
})

test('READER-4 — the turn/end reason decides the outcome, one code and one STATUS per reason', () => {
  const cases = [
    [{ kind: 'aborted' }, 'failed', WORK_RESULT_CODE_TURN_ABORTED],
    [{ kind: 'max-tokens' }, 'failed', WORK_RESULT_CODE_TURN_MAX_TOKENS],
    [{ kind: 'blocked' }, 'failed', WORK_RESULT_CODE_TURN_BLOCKED],
    [{ kind: 'error' }, 'failed', WORK_RESULT_CODE_TURN_ERROR],
    // A crash-closed turn has no live outcome: `unavailable`, never `failed` (the work did not fail,
    // it was never observed) and never `succeeded`.
    [{ kind: 'interrupted' }, 'unavailable', WORK_RESULT_CODE_TURN_INTERRUPTED],
    [{ kind: 'something-new' }, 'unavailable', WORK_RESULT_CODE_TURN_UNREADABLE],
  ]
  for (const [reason, status, code] of cases) {
    const result = readDeliveredWorkTurn(sessionWith([turnStart('t1'), userMessage(DELIVERY), turnEnd('t1', reason)]), TOKEN)
    assert.equal(result.status, status, `${reason.kind} must read as ${status}`)
    assert.equal(result.error.code, code, `${reason.kind} must map to ${code}`)
  }
})

test('READER-5 — a session with no log seam is unavailable, not a throw and not a success', () => {
  const result = readDeliveredWorkTurn({}, TOKEN)
  assert.equal(result.status, 'unavailable')
  assert.equal(result.error.code, WORK_RESULT_CODE_TURN_UNREADABLE)
})

test('READER-6 — a delivery that never appears is unavailable and NAMES the token', () => {
  const result = readDeliveredWorkTurn(sessionWith([turnStart('t1'), assistantMessage('unrelated'), turnEnd('t1', { kind: 'completed' })]), TOKEN)
  assert.equal(result.status, 'unavailable')
  assert.equal(result.error.code, WORK_RESULT_CODE_TURN_UNREADABLE)
  assert.match(result.error.message, /token-1/u)
})

test('READER-7 — text blocks join in order and non-text blocks contribute nothing', () => {
  assert.equal(workMessageText({ content: [text('a'), { type: 'image' }, text('b')] }), 'ab')
  assert.equal(workMessageText({ content: [] }), '')
  assert.equal(workMessageText(undefined), '')
  assert.equal(workMessageText({ content: 'not-an-array' }), '')
})
