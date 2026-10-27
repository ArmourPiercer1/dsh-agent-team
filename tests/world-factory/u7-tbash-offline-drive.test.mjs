import test from 'node:test'
import assert from 'node:assert/strict'
import { extractGovernedSessionId, extractProjectionSessionId, decideResolution, commandHashOf, ledgerControlFromEntries, judgeTbash, governedIdentityRecord, assembleTbashRecord, deriveBindingChain } from './lib/u7-tbash-assembly.mjs'

test('u7-tbash offline drive identity, ledger, resolution and judge use committed wire shapes', async () => {
  const X = 'session-u7tb-team-fake'
  const create = { path: 'fresh-root', durable: { teamSession: { rootSessionId: X } }, bind: { rootSessionId: X } }
  const identity = extractGovernedSessionId(create, { expectedRoot: X, bootRoot: 'session-u7tb-root-fake' })
  assert.equal(identity.ok, true)
  assert.equal(extractGovernedSessionId({ path: 'fresh-root', durable: { teamSession: { rootSessionId: X } }, bind: {} }, { expectedRoot: X }).ok, false)
  assert.equal(extractGovernedSessionId({ path: 'fresh-root', durable: {}, bind: { rootSessionId: X } }, { expectedRoot: X }).ok, false)
  const governed = governedIdentityRecord({ createResponse: { status: 200, body: { result: { ok: true, value: { data: create } } } }, projectionResponse: { status: 200, body: { result: { ok: true, value: { data: { projection: { teamSessionId: X, root: { teamSessionId: X } } } } } } }, expectedRoot: X, bootRoot: 'session-u7tb-root-fake' })
  assert.equal(governed.identityOk, true)
  assert.equal(governed.createBodyExcerpt.length <= 800, true)
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
  const digest = { governed: { ...governed, fromDurable: X, fromBind: X, bindings: { rowToModelCall: [{ requestId: 'r1', ledgerRequestId: 'r1', rootSessionId: X, ledgerMatched: true }] } }, pinned: { commandHash: commandHashOf(A), claims: { appr: 'U7TB_APPR_fake' }, ranEcho: { appr: 'U7TB_APPR_RAN' } }, calls: [{ step: 0, command: A, toolUseId: 'u1', result: { text: 'U7TB_APPR_RAN', isError: false } }, { step: 1, command: A, toolUseId: 'u2', result: { text: 'APPROVAL_DENIED', isError: true } }, { step: 2, command: 'B', toolUseId: 'u3', result: { text: 'APPROVAL_DENIED', isError: true } }, { step: 3, command: 'D', toolUseId: 'u4', result: { text: 'APPROVAL_DENIED', isError: true } }], resolutions: [{ requestId: 'r1', step: 0, decision: 'allow', ok: true }, { requestId: 'r2', step: 1, decision: 'deny', ok: true }, { requestId: 'r3', step: 2, decision: 'deny', ok: true }, { requestId: 'r4', step: 3, decision: 'deny', ok: true }], ledger: { decisions: [{ requestId: 'r1', decision: 'allow' }, { requestId: 'r2', decision: 'deny' }, { requestId: 'r3', decision: 'deny' }, { requestId: 'r4', decision: 'deny' }], consumptions: [{ requestId: 'r1' }] }, seamReAllow: { requestId: 'r1', ok: false }, effects: { appr: 'U7TB_APPR_fake\n', other: null, deny: null }, leak: { inCorpus: false, inHostLog: false, bytesUnchanged: true } }
  digest.governedSessionId = X
  digest.hostForensic = ['confined-shell ran realm=x exit=0 timedOut=false cancelled=false']
  digest.ledger.requests = [
    { requestId: 'r1', rootSessionId: X, toolName: 'bash', summary: 'run', status: 'settled' },
    { requestId: 'r2', rootSessionId: X, toolName: 'bash', summary: 'replay', status: 'settled' },
    { requestId: 'r3', rootSessionId: X, toolName: 'bash', summary: 'other', status: 'settled' },
    { requestId: 'r4', rootSessionId: X, toolName: 'bash', summary: 'deny', status: 'settled' },
  ]
  digest.governed.bindings = deriveBindingChain({ ledger: digest.ledger, calls: digest.calls, resolutions: digest.resolutions, governedSessionId: X })
  const assembled = assembleTbashRecord({ digest, governed, ledger, calls: digest.calls, resolutions: digest.resolutions })
  assert.equal(assembled.governedSession.bindings.rowToModelCall[0].toolUseId, 'u1')
  const verdicts = judgeTbash(digest, true)
  assert.equal(verdicts.length, 5)
  assert.equal(verdicts.every(([, verdict]) => verdict === 'PASS'), true)
  const forged = { ...digest, governed: { ...digest.governed, identityOk: false } }
  assert.equal(judgeTbash(forged, true).every(([, verdict]) => verdict === 'PASS'), false)
  const mismatched = { ...digest, governed: { ...digest.governed, bindings: { rowToModelCall: [{ requestId: 'r1', ledgerRequestId: 'missing', rootSessionId: X, ledgerMatched: false }] } } }
  assert.equal(judgeTbash(mismatched, true).every(([, verdict]) => verdict === 'PASS'), false)
  const seen = []
  const io = { fetchJson: async (...args) => { seen.push(args); return { status: 200, body: {} } }, readHostLog: () => 'confined-shell ran realm=x exit=0', readEffect: () => 'fixture', mockTranscript: () => ({}) }
  await io.fetchJson('fixture://dry-run')
  assert.equal(seen.length, 1)
})
