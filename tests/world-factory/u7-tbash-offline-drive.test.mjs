import test from 'node:test'
import assert from 'node:assert/strict'
import { extractGovernedSessionId, extractProjectionSessionId, decideResolution, commandHashOf, ledgerControlFromEntries, judgeTbash } from './lib/u7-tbash-assembly.mjs'

test('u7-tbash offline drive identity, ledger, resolution and judge use committed wire shapes', () => {
  const X = 'session-u7tb-team-fake'
  const create = { path: 'fresh-root', durable: { teamSession: { rootSessionId: X } }, bind: { rootSessionId: X } }
  const identity = extractGovernedSessionId(create, { expectedRoot: X, bootRoot: 'session-u7tb-root-fake' })
  assert.equal(identity.ok, true)
  const projection = extractProjectionSessionId({ projection: { teamSessionId: X, root: { teamSessionId: X } } })
  assert.equal(projection, X)
  const A = "printf 'U7TB_APPR_fake\\n' >> '/w/a' && echo U7TB_APPR_RAN"
  const ledger = ledgerControlFromEntries([
    { rootSessionId: 'foreign', factType: 'control-request-recorded', payload: { requestId: 'foreign' } },
    { rootSessionId: X, factType: 'control-request-recorded', payload: { requestId: 'r1', toolName: 'bash', summary: 'run', reviewPayload: { parametersFingerprint: commandHashOf(A) } } },
    { rootSessionId: X, factType: 'control-decision-recorded', payload: { requestId: 'r1', decision: 'allow' } },
    { rootSessionId: X, factType: 'control-allow-consumed', payload: { requestId: 'r1' } },
  ], { teamSessionId: X, pinnedCommandHash: commandHashOf(A) })
  assert.equal(ledger.ledgerForeignEntries, 1)
  assert.equal(ledger.requests[0].status, 'settled')
  assert.equal(decideResolution({ row: { requestId: 'r1', toolName: 'bash', rootSessionId: X }, outstanding: { step: 0, command: A }, pinnedCommandHash: commandHashOf(A), allowsGiven: 0, governedSessionId: X }).decision, 'allow')
  const digest = { pinned: { commandHash: commandHashOf(A), claims: { appr: 'U7TB_APPR_fake' }, ranEcho: { appr: 'U7TB_APPR_RAN' } }, calls: [{ step: 0, command: A, result: { text: 'U7TB_APPR_RAN', isError: false } }, { step: 1, command: A, result: { text: 'APPROVAL_DENIED', isError: true } }, { step: 2, command: 'B', result: { text: 'APPROVAL_DENIED', isError: true } }, { step: 3, command: 'D', result: { text: 'APPROVAL_DENIED', isError: true } }], resolutions: [{ requestId: 'r1', step: 0, decision: 'allow', ok: true }, { requestId: 'r2', step: 1, decision: 'deny', ok: true }, { requestId: 'r3', step: 2, decision: 'deny', ok: true }, { requestId: 'r4', step: 3, decision: 'deny', ok: true }], ledger: { decisions: [{ requestId: 'r1', decision: 'allow' }, { requestId: 'r2', decision: 'deny' }, { requestId: 'r3', decision: 'deny' }, { requestId: 'r4', decision: 'deny' }], consumptions: [{ requestId: 'r1' }] }, seamReAllow: { requestId: 'r1', ok: false }, effects: { appr: 'U7TB_APPR_fake\n', other: null, deny: null }, leak: { inCorpus: false, inHostLog: false, bytesUnchanged: true } }
  const verdicts = judgeTbash(digest, true)
  assert.equal(verdicts.length, 5)
  assert.equal(verdicts.every(([, verdict]) => verdict === 'PASS'), true)
})
