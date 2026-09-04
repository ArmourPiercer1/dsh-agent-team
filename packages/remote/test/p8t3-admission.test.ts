/**
 * p8t3-admission.test.ts — P8-T3 mandatory test 3: ADMISSION ERRORS
 * (brief §90; design note §6 invariant 4/5/7).
 *
 * An action the P7 compatibility semantics block (new member work while a
 * BLOCKED_FATAL drift is unacked) throws the backing service's TYPED error
 * (own string `code`, here the frozen P7-T1 value
 * `COMPATIBILITY_NEW_WORK_BLOCKED`). At the remote boundary:
 *
 *  - the typed code + message PASS THROUGH unchanged (invariant 4b);
 *  - the source identity rides under `error.details.cause` (code + message
 *    + the lossless-checked `details`), never the raw exception, never a
 *    stack;
 *  - the provenance fields are folded into `error.details` (G8: the
 *    failure is attributable to method/endpoint/version/token).
 *
 * And an UNTYPED throw from a backing port is swallowed into the
 * last-resort `internal-error` with a generic message (invariant 5), and
 * the dispatcher's promise NEVER rejects (invariant 7 — the P2-T6 500
 * class, designed out).
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous):
 * every async scenario runs at MODULE level (top-level await) and captures
 * its results; the `it` bodies are pure synchronous assertions.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 */

import { describe, expect, it } from 'vitest'

import {
  expectError,
  makeDispatcher,
  p8t3Wire,
  P8T3_REQUEST_TOKEN,
  P8T3_TEAM_SESSION_ID,
} from './p8t3-helpers.js'
import { REMOTE_CONTRACT_VERSION } from '../src/index.js'

/** The frozen P7-T1 compatibility gate code (runtime/compatibility). */
const P7_NEW_WORK_BLOCKED = 'COMPATIBILITY_NEW_WORK_BLOCKED'

// Module level (top-level await): drive the real dispatcher over the
// throwing fake ports and capture every scenario result.
const RT = await (async () => {
  const blocked = Object.assign(
    new Error('new work is blocked: BLOCKED_FATAL drift is unacked'),
    {
      code: P7_NEW_WORK_BLOCKED,
      details: { status: 'BLOCKED_FATAL', fingerprint: 'fp-1' },
    },
  )
  const blockedDispatcher = makeDispatcher({
    admission: {
      performAction() {
        throw blocked
      },
    },
  })
  const blockedCreate = await blockedDispatcher.dispatch(
    'member.create',
    p8t3Wire({
      teamSessionId: P8T3_TEAM_SESSION_ID,
      caller: { kind: 'human', humanId: 'h-1' },
      requestToken: P8T3_REQUEST_TOKEN,
    }),
  )

  // T12-H4: the fixture must use a REAL closed backing code (the synthetic
  // 'MEMBER_BUSY' no longer passes the narrowed invariant 4b allowlist).
  const plain = Object.assign(
    new Error('the work state does not admit the action'),
    { code: 'TEAM_RUNTIME_WORK_STATE_REJECTED' },
  )
  const plainDispatcher = makeDispatcher({
    admission: {
      performAction() {
        throw plain
      },
    },
  })
  const plainSend = await plainDispatcher.dispatch(
    'member.send',
    p8t3Wire({
      teamSessionId: P8T3_TEAM_SESSION_ID,
      caller: { kind: 'human', humanId: 'h-1' },
      recipientInstanceId: 'inst-1',
      body: 'hello',
      requestToken: P8T3_REQUEST_TOKEN,
    }),
  )

  // T12-H4 regression: a plain Node-style failure (code 'ENOENT' + a
  // filesystem path in the message) raised inside a handler. 'ENOENT' is NOT
  // a member of the closed backing vocabulary, so it must degrade to
  // internal-error and the wire must carry neither the code nor the path.
  const enoent = Object.assign(
    new Error('ENOENT: no such file or directory, open /secret/path/legacy.json'),
    { code: 'ENOENT' },
  )
  const enoentDispatcher = makeDispatcher({
    legacy: {
      inspect() {
        throw enoent
      },
    },
  })
  const enoentLegacyInspect = await enoentDispatcher.dispatch(
    'legacy.inspect',
    p8t3Wire({ dshHome: 'D:/home' }),
  )

  const untypedDispatcher = makeDispatcher({
    admission: {
      performAction() {
        throw new Error('secret internal state: {stack:boom}')
      },
    },
  })
  const untypedCreate = await untypedDispatcher.dispatch(
    'member.create',
    p8t3Wire({
      teamSessionId: P8T3_TEAM_SESSION_ID,
      caller: { kind: 'human', humanId: 'h-1' },
      requestToken: P8T3_REQUEST_TOKEN,
    }),
  )

  const bareStringDispatcher = makeDispatcher({
    projection: {
      project() {
        throw 'a bare string failure'
      },
    },
  })
  const bareStringProjection = await bareStringDispatcher.dispatch(
    'team.getProjection',
    p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )

  const unsafeDispatcher = makeDispatcher({
    legacy: {
      inspect() {
        return { status: 'legacy-team', ratio: Number.NaN }
      },
    },
  })
  const unsafeLegacyInspect = await unsafeDispatcher.dispatch(
    'legacy.inspect',
    p8t3Wire({ dshHome: 'D:/home' }),
  )

  return {
    blockedCreate,
    plainSend,
    enoentLegacyInspect,
    untypedCreate,
    bareStringProjection,
    unsafeLegacyInspect,
  }
})()

describe('P8-T3 admission errors at the remote boundary', () => {
  it('a compatibility-blocked action → the typed P7 code passes through, with provenance', () => {
    // Invariant 7: the promise RESOLVED (it never rejects) — the captured
    // value is the resolved envelope, not a rejection.
    const error = expectError(RT.blockedCreate)
    // Invariant 4b: the backing-service code + message pass through.
    expect(error.error.code).toBe(P7_NEW_WORK_BLOCKED)
    expect(error.error.message).toBe(
      'new work is blocked: BLOCKED_FATAL drift is unacked',
    )
    // G8: provenance folded into details (attributable failure).
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['method']).toBe('member.create')
    expect(details['endpoint']).toBe('member.create')
    expect(details['contractVersion']).toBe(REMOTE_CONTRACT_VERSION)
    expect(details['requestToken']).toBe(P8T3_REQUEST_TOKEN)
    expect(details['reason']).toBe('domain-error')
    // The source identity under cause (never the raw exception object).
    const cause = details['cause'] as Record<string, unknown>
    expect(cause).toEqual({
      code: P7_NEW_WORK_BLOCKED,
      message: 'new work is blocked: BLOCKED_FATAL drift is unacked',
      details: { status: 'BLOCKED_FATAL', fingerprint: 'fp-1' },
    })
    // No stack, no internal identifiers leak on the wire.
    expect(JSON.stringify(error.error).includes('stack')).toBe(false)
  })

  it('a typed domain error WITHOUT details → cause without a details key', () => {
    const error = expectError(RT.plainSend)
    expect(error.error.code).toBe('TEAM_RUNTIME_WORK_STATE_REJECTED')
    const cause = (error.error.details as unknown as Record<string, unknown>)['cause'] as Record<
      string,
      unknown
    >
    expect(cause).toEqual({
      code: 'TEAM_RUNTIME_WORK_STATE_REJECTED',
      message: 'the work state does not admit the action',
    })
    expect(Object.prototype.hasOwnProperty.call(cause, 'details')).toBe(false)
  })

  it('T12-H4: a plain Error with code ENOENT + a path in the message → internal-error, and the wire carries neither the code nor the path', () => {
    // The assertion runs on the ACTUAL wire envelope produced by the real
    // dispatcher (invariant 7: it resolved; the envelope IS the wire reply).
    const error = expectError(RT.enoentLegacyInspect)
    // Invariant 5 (the narrowed 4b gate): not a typed domain error.
    expect(error.error.code).toBe('internal-error')
    expect(error.error.message).toBe('internal error in remote handler')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['reason']).toBe('untyped-error')
    // No leak of the Node code or the filesystem path — anywhere in the
    // client-facing envelope.
    const wire = JSON.stringify(error)
    expect(wire.includes('ENOENT')).toBe(false)
    expect(wire.includes('/secret/path')).toBe(false)
    expect(wire.includes('legacy.json')).toBe(false)
  })

  it('an untyped throw → internal-error with a generic message (no leak, no reject)', () => {
    const error = expectError(RT.untypedCreate)
    expect(error.error.code).toBe('internal-error')
    expect(error.error.message).toBe('internal error in remote handler')
    const details = error.error.details as unknown as Record<string, unknown>
    expect(details['reason']).toBe('untyped-error')
    // Provenance still attributable.
    expect(details['method']).toBe('member.create')
    expect(details['requestToken']).toBe(P8T3_REQUEST_TOKEN)
    // No leak of the thrown message (which carries a fake secret).
    expect(JSON.stringify(error.error).includes('secret internal state')).toBe(false)
    expect(JSON.stringify(error.error).includes('stack:boom')).toBe(false)
  })

  it('an untyped NON-Error throw (a string) → still internal-error, never a reject', () => {
    const error = expectError(RT.bareStringProjection)
    expect(error.error.code).toBe('internal-error')
    expect(error.error.message).toBe('internal error in remote handler')
    expect(JSON.stringify(error.error).includes('bare string failure')).toBe(false)
  })

  it('a lossless-unsafe success value from a port → internal-error (invariant 6)', () => {
    // A backing port must return lossless-JSON-safe records; if one
    // returns a NaN leaf, the success check rejects it before the reply.
    const error = expectError(RT.unsafeLegacyInspect)
    expect(error.error.code).toBe('internal-error')
    // The wire stays lossless: NaN never serializes.
    expect(JSON.stringify(error.error).includes('NaN')).toBe(false)
    // The message length is a positive bound (generic, no internals).
    expect(error.error.message.length).toBeGreaterThan(0)
  })
})
