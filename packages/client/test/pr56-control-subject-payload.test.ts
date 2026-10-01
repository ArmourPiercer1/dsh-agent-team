/**
 * PR #56 (client-only fix) — the durable control SUBJECT + reviewPayload
 * adaptation, driven from the wire through the pure adapter and the
 * Events view-model.
 *
 * The break being fixed (verified @ 1385f1ee):
 *  - the write path ONLY ever names `targetInstanceId` for an
 *    `instance` subject (`packages/runtime/control/service.ts` L1490-1492:
 *    `...(subject.kind === INSTANCE ? { targetInstanceId: subject.instanceId } : {})`),
 *  - the canonical `ControlSubject` is the CLOSED union
 *    `instance→instanceId | template→templateId | team→rootSessionId`
 *    (`packages/runtime/control/types.ts` L256-259),
 *  - but `adaptControlRequestDraft` (ledger-adapter L199-235) returned
 *    `undefined` whenever `targetInstanceId` was absent, silently
 *    dropping every `template` / `team` subject request (the S9
 *    `template:worker` production case) and never carried
 *    `reviewPayload` / `reviewPayloadDigest`.
 *
 * Boundaries (coordinator law):
 *  1. subject-aware adaptation: the closed canonical map is read
 *     verbatim; NEVER fabricate `targetInstanceId` for a non-instance;
 *     an UNKNOWN subject gets an explicit `unsupported-subject`
 *     presentation (visible + non-decidable), never a silent drop.
 *  2. requestId / digest / payload carry verbatim (the digest is
 *     WIRE-SOURCED; the client never recomputes authority material).
 *  3. recovery-dispatch/v1 display-side integrity: a v1 request without
 *     a lossless reviewPayload or without a well-formed digest is
 *     `incomplete` (the panel disables Allow).
 *  4. NO second canonicalization / hash implementation ships in the
 *     client product: the cross-package pairing below is a TEST-only
 *     pin against the shared `canonicalJsonStringify` (contracts).
 *
 * Golden source (hand-modeled NON-SENSITIVE payload — the evidence
 * file itself is NOT staged):
 * `dev/agent-workflow/evidence/pre-alpha3-refactor/pr-e/prereq-2026-09-30T03-07-57/scenario-s9-reviewed-payload.json`
 * @ 1385f1ee — the real historical S9 `control-request-recorded` record
 * (template subject, full reviewPayload + recorded wire digest).
 *
 * Shim-constrained spec (run-tests.mjs): matchers toBe / toEqual
 * (+ .not) primitives only.
 */
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { adaptTeamLedger } from '../src/model/ledger-adapter.js'
import { deriveTeamLedgerSection } from '../src/model/team-ledger-model.js'
import { canonicalJsonStringify } from '../../contracts/src/remote-safe.js'
import type { RemoteLedgerEntryValue } from '../../remote/src/index.js'
import type { TeamUiSnapshot } from '../src/model/team-ui-snapshot.js'

function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`missing: ${label}`)
  return value
}

/** One frozen ledger entry (plain object; `overrides` allows broken leaves). */
function entry(
  sequence: number,
  factType: string,
  payload: Record<string, unknown>,
  overrides: Record<string, unknown> = {},
): RemoteLedgerEntryValue {
  return {
    schemaVersion: 2,
    sequence,
    rootSessionId: 'root-1',
    factType,
    payload,
    operationId: null,
    createdAt: '2026-09-30T03:08:10.732Z',
    ...overrides,
  } as unknown as RemoteLedgerEntryValue
}

// ---------------------------------------------------------------------------
// The golden S9 vector (hand-modeled from the historical record @1385f1ee)
// ---------------------------------------------------------------------------

/** The reviewed payload of the real S9 recovery dispatch (non-sensitive). */
const S9_REVIEW_PAYLOAD: Record<string, unknown> = {
  action: 'delegate',
  blockedScopes: ['template:worker'],
  caller: { instanceId: 'inst-leader', kind: 'instance' },
  downedCapabilitySubjects: ['mcp_web'],
  effect:
    'allow: exactly ONE reviewed recovery attempt of this operation on the reduced original authority; ' +
    'deny/abandon: zero durable effect (the operation remains blocked)',
  reducedAuthority: {
    externalHardCeiling: 'absolute (never bypassed)',
    otherwise: 'unchanged (the original permissions apply)',
    policy: 'reduced original authority (plan §E.9)',
    unavailableSubjects: ['mcp_web'],
  },
  requestedOperation: "one recovery attempt of 'delegate' on template 'worker'",
  rootSessionId: 'session-prereq-main-prereq-2026-09-30T03-07-57',
  schema: 'dsh-agent-team/recovery-dispatch/v1',
  templateId: 'worker',
}

/** The digest the durable line recorded (evidence: digestOk true). */
const S9_WIRE_DIGEST = 'sha256:6b3a9145e46f1b2a2cfa7b195256536eccc9514b38fbfec21b6f567d02d32d41'

/** The S9 request payload EXACTLY as the historical wire line carries it. */
const S9_REQUEST_PAYLOAD: Record<string, unknown> = {
  actionName: 'delegate',
  correlation: 'recovery:rt-b3a-prereq-2026-09-30T03-07-57:1',
  executionCoupling: 'inline',
  kind: 'user-approval',
  requestId: 'ctrl-1keen2j0xnkvtq019xw7d0d0',
  requester: { instanceId: 'inst-leader', kind: 'instance', role: 'leader' },
  reviewPayload: S9_REVIEW_PAYLOAD,
  reviewPayloadDigest: S9_WIRE_DIGEST,
  subject: { kind: 'template', templateId: 'worker' },
  summary:
    "recovery dispatch: one reviewed attempt of 'delegate' on the blocked scope(s) " +
    '[template:worker] on the reduced original authority',
}

const s9Entry = (sequence = 23): RemoteLedgerEntryValue =>
  entry(sequence, 'control-request-recorded', S9_REQUEST_PAYLOAD)

// ---------------------------------------------------------------------------
// 1. The S9 template subject: the request must become a visible chain
// ---------------------------------------------------------------------------

describe('PR56 (1) — template subject (the real S9 shape, NO targetInstanceId)', () => {
  it('the template-subject request becomes a pending chain (today: silently dropped)', () => {
    const model = adaptTeamLedger([s9Entry()], true)
    expect(model.controls.length).toBe(1)
    const chain = must(model.controls[0], 's9 chain')
    expect(chain.requestId).toBe('ctrl-1keen2j0xnkvtq019xw7d0d0')
    expect(chain.pending).toBe(true)
    // the durable subject verbatim over the closed canonical map.
    expect(chain.subject).toEqual({ kind: 'template', id: 'worker' })
    // NEVER a fabricated targetInstanceId for a non-instance subject.
    expect(chain.targetInstanceId).toBe(undefined)
    expect('targetInstanceId' in chain).toBe(false)
    expect(chain.kind).toBe('user-approval')
    expect(chain.actionName).toBe('delegate')
    expect(chain.requesterId).toBe('inst-leader')
    expect(chain.requesterRefKind).toBe('instance')
    // a template subject badges NO member instance.
    expect(model.pendingControlByInstance).toEqual({})
  })

  it('carries the reviewPayload + the FULL wire digest verbatim', () => {
    const model = adaptTeamLedger([s9Entry()], true)
    const chain = must(model.controls[0], 's9 chain')
    expect(chain.reviewPayload).toEqual(S9_REVIEW_PAYLOAD)
    expect(chain.reviewPayloadDigest).toBe(S9_WIRE_DIGEST)
  })

  it('identifies the recovery-dispatch/v1 request as fully reviewable', () => {
    const model = adaptTeamLedger([s9Entry()], true)
    const chain = must(model.controls[0], 's9 chain')
    expect(chain.renderMode).toBe('recovery-v1')
    expect(chain.reviewIntegrity).toBe('reviewable')
  })
})

// ---------------------------------------------------------------------------
// 2. The golden canonical pairing — TEST-ONLY proof (the client product
//    displays the frozen wire digest and ships NO second hash): the shared
//    contracts canonicalizer + sha256 over the SAME payload reproduces the
//    digest the panel displays.
// ---------------------------------------------------------------------------

describe('PR56 — golden pairing (test-only, against the shared contracts canonicalizer)', () => {
  it('sha256(canonicalJsonStringify(S9 payload)) === the displayed wire digest', () => {
    const hex = createHash('sha256').update(canonicalJsonStringify(S9_REVIEW_PAYLOAD), 'utf8').digest('hex')
    expect(`sha256:${hex}`).toBe(S9_WIRE_DIGEST)
  })
})

// ---------------------------------------------------------------------------
// 3. The team subject
// ---------------------------------------------------------------------------

describe('PR56 (2) — team subject', () => {
  it('a team-subject request becomes a chain over rootSessionId', () => {
    const model = adaptTeamLedger([
      entry(4, 'control-request-recorded', {
        requestId: 'r-team',
        kind: 'user-approval',
        actionName: 'team.close',
        correlation: 'c-team',
        subject: { kind: 'team', rootSessionId: 'root-1' },
      }),
    ], true)
    expect(model.controls.length).toBe(1)
    const chain = must(model.controls[0], 'team chain')
    expect(chain.subject).toEqual({ kind: 'team', id: 'root-1' })
    expect(chain.targetInstanceId).toBe(undefined)
    expect(chain.renderMode).toBe('standard')
    expect(model.pendingControlByInstance).toEqual({})
  })
})

// ---------------------------------------------------------------------------
// 4. The ORIGINAL instance behavior stays (both wire generations)
// ---------------------------------------------------------------------------

describe('PR56 (3) — instance facts byte-stable', () => {
  it('LEGACY wire shape (targetInstanceId only, no subject leaf) keeps today chain shape', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r1', targetInstanceId: 'i1', actionName: 'tool.execute', correlation: 'c1',
      }),
    ], true)
    const chain = must(model.controls[0], 'legacy chain')
    expect(chain.targetInstanceId).toBe('i1')
    expect(chain.pending).toBe(true)
    expect(chain.renderMode).toBe('legacy-compat')
    expect(model.pendingControlByInstance).toEqual({ i1: 1 })
  })

  it('PR-D wire shape (subject instance + targetInstanceId) stays byte-identical + labeled standard', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r1',
        kind: 'tool',
        actionName: 'tool.execute',
        correlation: 'c1',
        subject: { kind: 'instance', instanceId: 'i1' },
        targetInstanceId: 'i1',
      }),
    ], true)
    const chain = must(model.controls[0], 'pr-d chain')
    expect(chain.targetInstanceId).toBe('i1')
    expect(chain.subject).toEqual({ kind: 'instance', id: 'i1' })
    expect(chain.renderMode).toBe('standard')
    expect(model.pendingControlByInstance).toEqual({ i1: 1 })
  })

  it('a subject/target CONTRADICTION fails closed to unsupported (never a trusted pick)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r1',
        actionName: 'a',
        correlation: 'c1',
        subject: { kind: 'instance', instanceId: 'i1' },
        targetInstanceId: 'i2',
      }),
    ], true)
    const chain = must(model.controls[0], 'contradiction chain')
    expect(chain.renderMode).toBe('unsupported-subject')
    expect(chain.targetInstanceId).toBe(undefined)
    expect(model.pendingControlByInstance).toEqual({})
  })

  it('the broken-identity skips stay (no requestId / no actionName → no chain)', () => {
    expect(adaptTeamLedger([entry(1, 'control-request-recorded', { targetInstanceId: 'i1', actionName: 'a' })], true).controls.length).toBe(0)
    expect(adaptTeamLedger([entry(1, 'control-request-recorded', { requestId: 'r1', targetInstanceId: 'i1' })], true).controls.length).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// 5. Decision + abandon facts for non-instance subjects
// ---------------------------------------------------------------------------

describe('PR56 (7) — decision/abandon facts on non-instance subjects', () => {
  it('a decision pairs onto the template request by requestId (pending false)', () => {
    const model = adaptTeamLedger([
      s9Entry(),
      entry(30, 'control-decision-recorded', {
        requestId: 'ctrl-1keen2j0xnkvtq019xw7d0d0',
        decision: 'allow_once',
        scope: {
          rootSessionId: 'root-1',
          subject: { kind: 'template', templateId: 'worker' },
          actionName: 'delegate',
          correlation: 'recovery:rt-b3a-prereq-2026-09-30T03-07-57:1',
        },
        requestSequence: 23,
      }),
    ], true)
    const chain = must(model.controls[0], 's9 chain')
    expect(chain.pending).toBe(false)
    expect(chain.decision?.value).toBe('allow_once')
    expect(model.pendingControlByInstance).toEqual({})
  })

  it('an ORPHAN decision over a template subject scope becomes a resolved chain (no invented instance)', () => {
    const model = adaptTeamLedger([
      entry(9, 'control-decision-recorded', {
        requestId: 'r-orphan-t',
        decision: 'deny',
        scope: {
          rootSessionId: 'root-1',
          subject: { kind: 'template', templateId: 'worker' },
          actionName: 'delegate',
        },
        requestSequence: 5,
      }),
    ], true)
    const orphan = must(model.controls[0], 'template orphan')
    expect(orphan.subject).toEqual({ kind: 'template', id: 'worker' })
    expect(orphan.targetInstanceId).toBe(undefined)
    expect(orphan.pending).toBe(false)
    expect(orphan.decision?.value).toBe('deny')
  })

  it('an abandon fact closes a NON-instance pending chain (no orphaned pending)', () => {
    const model = adaptTeamLedger([
      s9Entry(),
      entry(40, 'control-request-abandoned', {
        requestId: 'ctrl-1keen2j0xnkvtq019xw7d0d0',
        rootSessionId: 'root-1',
        abandonedAt: '2026-09-30T03:09:00.000Z',
        reason: 'inline-abort',
      }),
    ], true)
    const chain = must(model.controls[0], 's9 chain')
    expect(chain.pending).toBe(false)
    expect(chain.abandoned).toBe(true)
    expect(model.pendingControlByInstance).toEqual({})
  })

  it('RULED UNIFORM: an abandon fact closes an INSTANCE-subject chain too (historical defect: stock master keeps it pending)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', { requestId: 'r1', targetInstanceId: 'i1', actionName: 'a', correlation: 'c1' }),
      entry(2, 'control-request-abandoned', { requestId: 'r1', rootSessionId: 'root-1', abandonedAt: '2026-09-30T03:09:00.000Z' }),
    ], true)
    const chain = must(model.controls[0], 'instance chain')
    expect(chain.pending).toBe(false)
    expect(chain.abandoned).toBe(true)
    // a closed chain badges no pending instance.
    expect(model.pendingControlByInstance).toEqual({})
  })

  it('RULED UNIFORM: an abandon fact closes a TEAM-subject chain too', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-team-a', kind: 'user-approval', actionName: 'team.close', correlation: 'c-team',
        subject: { kind: 'team', rootSessionId: 'root-1' },
      }),
      entry(2, 'control-request-abandoned', { requestId: 'r-team-a', rootSessionId: 'root-1', abandonedAt: '2026-09-30T03:09:00.000Z' }),
    ], true)
    const chain = must(model.controls[0], 'team chain')
    expect(chain.pending).toBe(false)
    expect(chain.abandoned).toBe(true)
  })

  it('TERMINAL PRECEDENCE (types.ts L433-440): decision-then-abandon → abandoned wins (both facts are legitimate durable data, never flagged)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', { requestId: 'r1', targetInstanceId: 'i1', actionName: 'a', correlation: 'c1' }),
      entry(2, 'control-decision-recorded', { requestId: 'r1', decision: 'allow_once', scope: { targetInstanceId: 'i1', actionName: 'a' }, requestSequence: 1 }),
      entry(3, 'control-request-abandoned', { requestId: 'r1', rootSessionId: 'root-1', abandonedAt: '2026-09-30T03:09:00.000Z' }),
    ], true)
    const chain = must(model.controls[0], 'decided→abandoned chain')
    expect(chain.pending).toBe(false)
    expect(chain.abandoned).toBe(true)
    // facts are never rewritten: the decision block rides verbatim.
    expect(chain.decision?.value).toBe('allow_once')
  })

  it('TERMINAL PRECEDENCE (types.ts L433-440): abandon-then-decision → still abandoned (order of durable facts does not flip the terminal mark)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', { requestId: 'r1', targetInstanceId: 'i1', actionName: 'a', correlation: 'c1' }),
      entry(2, 'control-request-abandoned', { requestId: 'r1', rootSessionId: 'root-1', abandonedAt: '2026-09-30T03:09:00.000Z' }),
      entry(3, 'control-decision-recorded', { requestId: 'r1', decision: 'allow_once', scope: { targetInstanceId: 'i1', actionName: 'a' }, requestSequence: 1 }),
    ], true)
    const chain = must(model.controls[0], 'abandoned→decided chain')
    expect(chain.pending).toBe(false)
    expect(chain.abandoned).toBe(true)
    expect(chain.decision?.value).toBe('allow_once')
  })

  it('CRITICAL NEGATIVE: NO durable abandon entry → the request stays pending + Allowable (a narrated wait-cancel with NO durable fact changes NOTHING; the projection reacts ONLY to durable factType entries)', () => {
    // Scenario narrative: a wait was cancelled without a durable write
    // (guarded inline-protected / settle kind NOT 'abandoned' —
    // service.ts L370-389: no fact lands). The ledger page carries the
    // request ONLY → the client has nothing to react to, and MUST keep
    // the request pending/Allowable. There is no AbortSignal / wait
    // notion on the client — durable entries are the ONLY input.
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', { requestId: 'r-live', targetInstanceId: 'i1', actionName: 'a', correlation: 'c1', kind: 'user-approval' }),
      entry(2, 'team-coordination-recorded', { action: 'record-note', caller: 'i1', subject: 'wait was cancelled upstream (no durable control fact)' }),
    ], true)
    const chain = must(model.controls[0], 'no-abandon chain')
    expect(chain.pending).toBe(true)
    expect(chain.abandoned).toBe(undefined)
    // still badges the instance (pending), still Allowable downstream.
    expect(model.pendingControlByInstance).toEqual({ i1: 1 })
  })
})

// ---------------------------------------------------------------------------
// 6. Unknown subject → explicit unsupported presentation (NOT silent drop)
// ---------------------------------------------------------------------------

describe('PR56 (5) — unknown / malformed subject stays visible, non-decidable', () => {
  it('an unknown subject.kind becomes an unsupported-subject chain (never dropped)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-q',
        kind: 'user-approval',
        actionName: 'a',
        correlation: 'c1',
        subject: { kind: 'quantum', qId: 'x' },
      }),
    ], true)
    const chain = must(model.controls[0], 'unknown-subject chain')
    expect(chain.renderMode).toBe('unsupported-subject')
    expect(chain.subjectKindRaw).toBe('quantum')
    expect(chain.subject).toBe(undefined)
    expect(chain.targetInstanceId).toBe(undefined)
    expect(model.pendingControlByInstance).toEqual({})
  })

  it('a MISSING subject (no targetInstanceId either) is unsupported too (visible, nothing invented)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', { requestId: 'r-m', actionName: 'a', correlation: 'c1' }),
    ], true)
    const chain = must(model.controls[0], 'no-subject chain')
    expect(chain.renderMode).toBe('unsupported-subject')
    expect(chain.subject).toBe(undefined)
  })

  it('a template subject with the wrong id leaf fails closed to unsupported', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-w', actionName: 'a', correlation: 'c1',
        subject: { kind: 'template', instanceId: 'i1' },
      }),
    ], true)
    expect(must(model.controls[0], 'wired chain').renderMode).toBe('unsupported-subject')
  })
})

// ---------------------------------------------------------------------------
// 7. recovery-dispatch/v1 display-side payload integrity
// ---------------------------------------------------------------------------

const VALID_SHA = `sha256:${'0'.repeat(64)}`

function v1Payload(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    requestId: 'r-v1',
    kind: 'user-approval',
    actionName: 'delegate',
    correlation: 'recovery:rt-x:1',
    subject: { kind: 'template', templateId: 'worker' },
    ...extra,
  }
}

describe('PR56 (3) — recovery-dispatch/v1 integrity (display side)', () => {
  it('v1 by payload.schema + valid digest → reviewable', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', v1Payload({
        reviewPayload: { schema: 'dsh-agent-team/recovery-dispatch/v1', arguments: {} },
        reviewPayloadDigest: VALID_SHA,
      })),
    ], true)
    const chain = must(model.controls[0], 'v1 chain')
    expect(chain.renderMode).toBe('recovery-v1')
    expect(chain.reviewIntegrity).toBe('reviewable')
  })

  it('v1 with an ABSENT digest → incomplete', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', v1Payload({
        reviewPayload: { schema: 'dsh-agent-team/recovery-dispatch/v1' },
      })),
    ], true)
    expect(must(model.controls[0], 'v1 chain').reviewIntegrity).toBe('incomplete')
  })

  it('v1 with a MALFORMED digest → incomplete', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', v1Payload({
        reviewPayload: { schema: 'dsh-agent-team/recovery-dispatch/v1' },
        reviewPayloadDigest: 'sha256:XYZ',
      })),
    ], true)
    expect(must(model.controls[0], 'v1 chain').reviewIntegrity).toBe('incomplete')
  })

  it('NON-recovery correlation + NO schema leaf is NEVER classified v1 (no false Allow-disable)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-nr', kind: 'user-approval', actionName: 'write_file', correlation: 'c-nr',
        subject: { kind: 'instance', instanceId: 'i1' }, targetInstanceId: 'i1',
        reviewPayload: { note: 'ask-lane, no schema' },
      }),
    ], true)
    const chain = must(model.controls[0], 'non-recovery chain')
    expect(chain.renderMode).toBe('standard')
    expect(chain.reviewIntegrity).toBe(undefined)
  })

  it('SHIPPED CLASSIFIER (positive ID only): an UNKNOWN subject does not block the v1 classification when the schema id is present', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-u1', actionName: 'delegate', correlation: 'c-u1',
        subject: { kind: 'quantum', qId: 'x' },
        reviewPayload: { schema: 'dsh-agent-team/recovery-dispatch/v1' },
      }),
    ], true)
    const chain = must(model.controls[0], 'unknown+v1 chain')
    // unsupported-subject keeps precedence for the label, Allow stays
    // disabled anyway (both gates disable it) — no v1 integrity claim.
    expect(chain.renderMode).toBe('unsupported-subject')
  })

  // ACCEPTED LIMITATION — USER OPTION A (locked): payload+digest-absent
  // rows are not protocol-identifiable; the row keeps its plain subject
  // mode, disclosed. Option B (protocol marker + integrity re-check) is
  // DEFERRED to Alpha3 — nothing B-shaped ships here.
  it('ACCEPTED LIMITATION — USER OPTION A (pinned): payload-absent recovery-correlation row → standard mode, NO integrity gate, Allow unchanged (never classified recovery-v1)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', v1Payload()),
    ], true)
    const chain = must(model.controls[0], 'payload-absent chain')
    expect(chain.renderMode).toBe('standard')
    expect(chain.reviewIntegrity).toBe(undefined)
    expect(chain.reviewPayload).toBe(undefined)
  })

  it('a CORRUPTED (non-lossless) reviewPayload is OMITTED + the request is incomplete', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', v1Payload({
        reviewPayload: { schema: 'dsh-agent-team/recovery-dispatch/v1', bad: Number.NaN },
        reviewPayloadDigest: VALID_SHA,
      })),
    ], true)
    const chain = must(model.controls[0], 'v1 chain')
    expect(chain.reviewPayload).toBe(undefined)
    expect(chain.reviewIntegrity).toBe('incomplete')
  })

  it('NON-recovery defined requests keep compatibility (no integrity gate applies)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-plain', kind: 'user-approval', actionName: 'write_file', correlation: 'c-plain',
        subject: { kind: 'instance', instanceId: 'i1' }, targetInstanceId: 'i1',
      }),
    ], true)
    const chain = must(model.controls[0], 'plain chain')
    expect(chain.renderMode).toBe('standard')
    expect(chain.reviewIntegrity).toBe(undefined)
  })

  it('a legacy no-payload fact renders in the labeled compat mode (no integrity gate)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', { requestId: 'r-legacy', actionName: 'a', correlation: 'c1', targetInstanceId: 'i1' }),
    ], true)
    const chain = must(model.controls[0], 'legacy chain')
    expect(chain.renderMode).toBe('legacy-compat')
    expect(chain.reviewIntegrity).toBe(undefined)
  })

  it('DEFENSE-IN-DEPTH: digest present + payload ABSENT on a NON-v1 line → incomplete (cannot fully review; current backend cannot produce this shape — write path rejects service.ts L1369-1374, read path drops L654-656 — classification stays neutral)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-dwp', kind: 'user-approval', actionName: 'write_file', correlation: 'c-dwp',
        subject: { kind: 'instance', instanceId: 'i1' }, targetInstanceId: 'i1',
        reviewPayloadDigest: VALID_SHA,
      }),
    ], true)
    const chain = must(model.controls[0], 'digest-without-payload chain')
    // NO recovery classification — the guard claims only "cannot fully
    // review" (the panel disables Allow; deny stays available).
    expect(chain.renderMode).toBe('standard')
    expect(chain.reviewIntegrity).toBe('incomplete')
    expect(chain.reviewPayload).toBe(undefined)
    expect(chain.reviewPayloadDigest).toBe(VALID_SHA)
  })
})

// ---------------------------------------------------------------------------
// 7b. FROZEN BATCH item 1 (external client-contract review, MAIN-verified
// @11bce13f): the classifier guard `typeof rawReviewPayload === 'object'`
// passes for NULL (`typeof null === 'object'`), and null is a LEGAL
// RemoteSafeJsonValue (isLosslessJsonValue accepts it) — so the schemaId
// read indexed into null → TypeError → the whole TeamView crashed on a
// legal non-recovery row. Null must be guarded; scalars/arrays must keep
// rendering verbatim with NO classification.
// ---------------------------------------------------------------------------

describe('PR56 batch#1 — legal null/scalar/array reviewPayload: NO crash, no v1 classification, no gate', () => {
  it('reviewPayload NULL (legal RemoteSafeJsonValue — the crash shape) → row survives, standard mode, no gate, no v1 claim', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-null', kind: 'user-approval', actionName: 'write_file', correlation: 'c-null',
        subject: { kind: 'instance', instanceId: 'i1' }, targetInstanceId: 'i1',
        reviewPayload: null,
      }),
    ], true)
    const chain = must(model.controls[0], 'null-payload chain')
    expect(chain.renderMode).toBe('standard')
    expect(chain.reviewIntegrity).toBe(undefined)
    expect(chain.pending).toBe(true)
  })

  for (const [label, value] of [
    ['number', 42],
    ['boolean', true],
    ['string', 'a plain string payload'],
    ['array', ['alpha', 1, null]],
  ] as const) {
    it(`reviewPayload ${label} → verbatim carry, standard/legacy mode, never recovery-v1, no gate`, () => {
      const model = adaptTeamLedger([
        entry(1, 'control-request-recorded', {
          requestId: `r-sc-${label}`, kind: 'user-approval', actionName: 'write_file', correlation: `c-sc-${label}`,
          targetInstanceId: 'i1',
          reviewPayload: value,
        }),
      ], true)
      const chain = must(model.controls[0], `${label}-payload chain`)
      expect(chain.renderMode).toBe('legacy-compat')
      expect(chain.reviewIntegrity).toBe(undefined)
      expect(chain.reviewPayload).toEqual(value)
      expect(chain.pending).toBe(true)
    })
  }
})

// ---------------------------------------------------------------------------
// 7c. FROZEN BATCH item 2 (external client-contract review, MAIN-verified
// @11bce13f): the malformed-input fail-closed promise this PR made is not
// fully ENFORCED yet. The backend is strict — parseSubject demands
// EXACTLY ONE id leaf for the declared kind (service.ts L436-462), and a
// targetInstanceId disagreeing with / absent from an instance subject is
// rejected (service.ts L610-616). The client must mirror the fail-closed
// shape: contradictory input is NEVER a trusted pick. These shapes are
// rejected at WRITE time server-side — this is display-side defense, NOT
// an authorization bypass, and NO protocol field changes.
// ---------------------------------------------------------------------------

describe('PR56 batch#2 — strict subject leaves: contradictory input fails CLOSED to unsupported', () => {
  it('template subject with an EXTRA instanceId leaf → unsupported (parseSubject-mirror: exactly one id leaf)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-b2a', kind: 'user-approval', actionName: 'delegate', correlation: 'c-b2a',
        subject: { kind: 'template', templateId: 'worker', instanceId: 'ghost' },
      }),
    ], true)
    const chain = must(model.controls[0], 'contradictory template chain')
    expect(chain.renderMode).toBe('unsupported-subject')
    expect(chain.subject).toBe(undefined)
    expect(chain.targetInstanceId).toBe(undefined)
  })

  it('instance subject with an EXTRA rootSessionId leaf → unsupported', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-b2b', kind: 'user-approval', actionName: 'write_file', correlation: 'c-b2b',
        subject: { kind: 'instance', instanceId: 'i1', rootSessionId: 'root-x' },
      }),
    ], true)
    const chain = must(model.controls[0], 'contradictory instance chain')
    expect(chain.renderMode).toBe('unsupported-subject')
  })

  it('team subject carrying the legacy targetInstanceId leaf → unsupported (backend rejects: service.ts L610-616)', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-b2c', kind: 'user-approval', actionName: 'team.close', correlation: 'c-b2c',
        subject: { kind: 'team', rootSessionId: 'root-1' }, targetInstanceId: 'i1',
      }),
    ], true)
    const chain = must(model.controls[0], 'team+target chain')
    expect(chain.renderMode).toBe('unsupported-subject')
    expect(chain.targetInstanceId).toBe(undefined)
  })

  it('REGRESSION GUARD (byte-stable): team subject WITHOUT the targetInstanceId leaf stays defined/standard', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-request-recorded', {
        requestId: 'r-b2d', kind: 'user-approval', actionName: 'team.close', correlation: 'c-b2d',
        subject: { kind: 'team', rootSessionId: 'root-1' },
      }),
    ], true)
    expect(must(model.controls[0], 'clean team chain').renderMode).toBe('standard')
  })

  it('ORPHAN decision with an EXPLICIT malformed scope.subject → unsupported chain, NO legacy targetInstanceId fallback', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-decision-recorded', {
        requestId: 'r-b2e', decision: 'allow_once', requestSequence: 7,
        scope: {
          targetInstanceId: 'i1', actionName: 'write_file',
          subject: { kind: 'quantum', qId: 'x' },
        },
      }),
    ], true)
    const chain = must(model.controls[0], 'malformed-subject orphan')
    expect(chain.renderMode).toBe('unsupported-subject')
    expect(chain.subject).toBe(undefined)
    expect(chain.subjectKindRaw).toBe('quantum')
    // the legacy leaf is NOT trusted on a row that carries an explicit
    // (malformed) subject: no instance identity is invented.
    expect(chain.targetInstanceId).toBe(undefined)
    expect(chain.pending).toBe(false)
    expect(chain.decision?.value).toBe('allow_once')
  })

  it('REGRESSION GUARD (byte-stable): orphan with ABSENT scope.subject + targetInstanceId → the legacy compat chain stays', () => {
    const model = adaptTeamLedger([
      entry(1, 'control-decision-recorded', {
        requestId: 'r-b2f', decision: 'deny', requestSequence: 8,
        scope: { targetInstanceId: 'i1', actionName: 'write_file' },
      }),
    ], true)
    const chain = must(model.controls[0], 'legacy orphan')
    expect(chain.renderMode).toBe('legacy-compat')
    expect(chain.targetInstanceId).toBe('i1')
    expect(chain.subject).toEqual({ kind: 'instance', id: 'i1' })
  })
})

// ---------------------------------------------------------------------------
// 8. The view-model layer: the S9 row reaches the Events surface pending
// ---------------------------------------------------------------------------

describe('PR56 (view-model) — the S9 control row reaches the Events section', () => {
  const snapshot = {
    teamSessionId: 'root-1',
    generation: 1,
    templates: [],
    members: [],
  } as unknown as TeamUiSnapshot

  it('deriveTeamLedgerSection shows the template-subject control-request row, pending, with its requestId', () => {
    const ledger = adaptTeamLedger([s9Entry()], true)
    const section = deriveTeamLedgerSection({
      ledger,
      snapshot,
      loadedCount: 10,
      filter: { category: 'all', instanceId: null },
      total: 1,
      completeThrough: 23,
    })
    const row = section.rows.find(item => item.kind === 'control-request')
    if (row === undefined) throw new Error('the control-request row is missing from the Events section')
    expect(row.requestId).toBe('ctrl-1keen2j0xnkvtq019xw7d0d0')
    expect(row.pending).toBe(true)
  })
})
