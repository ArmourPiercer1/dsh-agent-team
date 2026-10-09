/**
 * a4w6-corrupt-not-pending.test.ts — A4-W6: a durable `control-request-recorded`
 * row the STRICT READER refuses is never pending in the host fold's
 * `pendingControlCount` — and a real pending request is STILL counted.
 *
 * THE DEFECT (owner-adjudicated 2026-10-09): the projection fold
 * (`src/plugin/projection-source.ts ledgerSummaryOf`) chose its pending
 * CANDIDATES with "payload.requestId is a non-empty string", a classifier
 * WIDER than the control service's strict parse. A row the service files as
 * a corrupt leg — absent from `listOpenApprovalCases`, refused by
 * `resolveControl` with `CONTROL_REQUEST_NOT_FOUND` before any write — was
 * counted here as awaiting adjudication, and the client rendered it with a
 * live decision button pointing at nothing.
 *
 * THE FIX's CANDIDATE RULE is a clause-for-clause transcription of
 * `parseRequestPayload`' rejection rule (`controlRequestRowIsGovernable`);
 * direct reuse is impossible without editing the frozen `control/**`
 * (the parse is module-private; the fold is synchronous inside the frozen
 * P8-T2 four-read order, the classification only reachable through the
 * async, lock-guarded `listControlState`). These legs are what make that
 * transcription an EQUIVALENCE CLAIM, not a new opinion:
 *
 *  1. THE BRIEF'S SCENARIO, minimally: one REAL production request
 *     (written through `ControlService.requestControl`) plus one injected
 *     corrupt row (RULING 5-A shape: damaged plain-object row). The fold
 *     counts exactly 1 — the corrupt row is not pending AND the real
 *     request is never lost (the count is not simply zeroed). A terminal
 *     decision row then closes the real request: the fold reaches 0 (the
 *     governability gate did not break the terminal-mark path).
 *
 *  2. THE DIFFERENTIAL, accept set: one world carrying every probe the
 *     strict parse ACCEPTS (canonical Alpha.4 row, legacy identity, each
 *     subject kind, both requester kinds, review payload + digest, each
 *     closed-table leaf). `listControlState` proves the service accepts
 *     every one; the fold counts exactly that many. Because only accepts
 *     are present, the total pins the mirror's ACCEPTS per probe (a probe
 *     the mirror wrongly rejects moves the total — nothing can cancel it).
 *
 *  3. THE DIFFERENTIAL, refuse set: one world carrying every probe the
 *     strict parse REFUSES (one per rejection clause of
 *     `parseRequestPayload`, including the A2-9 strict leg rule and the
 *     authorityScope clause). `listControlState` proves the service files
 *     every one as a corrupt leg; the fold counts ZERO. A single
 *     wrongly-governable probe shows up as `expected 1 to be 0` — no
 *     cancellation is possible in a world without accepts.
 *
 * The fold is read through the PRODUCTION read port (the same channel
 * `team.getProjection` uses); the service verdicts come from the REAL
 * `listControlState`. SELF-CLEANLINESS: inside the P4-T6 whole-tree
 * scanner's scope; no legacy Team SessionEvent denylist token appears.
 *
 * @module @dsh-agent-team/runtime/test/a4w6-corrupt-not-pending
 */
import { describe, expect, it } from 'vitest'
import {
  CONTROL_EXECUTION_COUPLING_VALUES,
  CONTROL_REQUEST_KINDS,
  CONTROL_REQUEST_KIND_VALUES,
  CONTROL_SUBJECT_KINDS,
} from '../control/index.js'
import { PROPOSAL_AUTHORITY_POSITIONS } from '../governance/proposal-store.js'
import { CAPABILITY_NAME_VALUES } from '../../domain/policy/src/index.js'
import { PERMISSION_OVERLAY_EFFECT_VALUES } from '../../storage/schema/permission-overlay.js'
import { parseRootSessionId } from '../../contracts/src/index.js'
import { createTeamDomainReadPort } from '../src/plugin/projection-source.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import { destroyP6T1World } from './p6t1-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import {
  createP6T4Service,
  createP6T4World,
  memberCaller,
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
} from './p6t4-helpers.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/** The template rows production injects through `readPortDeps` — same
 *  literal `a4p3-intervention-projection.test.ts` uses, so the fold under
 *  test is read exactly as the composition root reads it. */
const PORT_DEPS = {
  templates: () =>
    [
      { kind: 'leader', templateId: 'leader', displayName: 'leader', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'worker', displayName: 'Worker', contextPolicy: 'persistent' },
    ] as never,
  policyState: () => 'default' as const,
}

/** The frozen pending slice of the production host fold. */
function foldPendingCount(domain: TeamDomain): number {
  const source = createTeamDomainReadPort(domain, PORT_DEPS).readProjectionSource(
    parseRootSessionId(P6T4_ROOT),
  )
  return (source.ledger as unknown as { readonly pendingControlCount: number })
    .pendingControlCount
}

/** One strict-parseable request row (the canonical accept shape); probes
 *  damage exactly ONE clause below. */
function canonicalRow(requestId: string): Record<string, unknown> {
  return {
    requestId,
    kind: CONTROL_REQUEST_KIND_VALUES[0],
    actionName: 'a4w6-action',
    correlation: `a4w6-corr-${requestId}`,
    requester: { kind: 'human', humanId: 'human-a4w6' },
    subject: { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: WORKER_ID },
  }
}

interface Probe {
  readonly name: string
  readonly payload: Record<string, unknown>
}

/** One probe off the canonical row (accept or refuse — the mutator decides). */
function probe(name: string, mutate: (row: Record<string, unknown>) => void = () => {}): Probe {
  const row = canonicalRow(`a4w6-r-${name}`)
  mutate(row)
  return { name, payload: row }
}

/** THE ACCEPT SET — every shape the strict parse must keep governing. */
const ACCEPT_PROBES: readonly Probe[] = [
  probe('explicit-subject'),
  probe('legacy-identity', (row) => {
    delete row['subject']
    row['targetInstanceId'] = WORKER_ID
  }),
  probe('legacy-optionals', (row) => {
    delete row['subject']
    row['targetInstanceId'] = WORKER_ID
    row['toolName'] = 'fs.write'
    row['capabilityDomain'] = CAPABILITY_NAME_VALUES[0]
    row['summary'] = 'a4w6 summary'
    row['operationFingerprint'] = 'a4w6-fp'
  }),
  probe('subject-instance-plus-target', (row) => {
    row['targetInstanceId'] = WORKER_ID
  }),
  probe('subject-template', (row) => {
    row['subject'] = { kind: CONTROL_SUBJECT_KINDS.TEMPLATE, templateId: 'worker' }
  }),
  probe('subject-team', (row) => {
    row['subject'] = { kind: CONTROL_SUBJECT_KINDS.TEAM, rootSessionId: P6T4_ROOT }
  }),
  probe('requester-instance', (row) => {
    row['requester'] = { kind: 'instance', instanceId: WORKER_ID, role: 'member' }
  }),
  probe('review-payload', (row) => {
    row['reviewPayload'] = { files: ['a.txt'], count: 1, flag: true, none: null }
    row['reviewPayloadDigest'] = 'a4w6-digest'
  }),
  probe('execution-coupling', (row) => {
    row['executionCoupling'] = CONTROL_EXECUTION_COUPLING_VALUES[0]
  }),
  probe('alpha4-full', (row) => {
    row['approvalCaseId'] = 'a4w6-case-1'
    row['legOrdinal'] = 2
    row['reviewAuthority'] = PROPOSAL_AUTHORITY_POSITIONS[0]
    row['requiredAuthorityAtCreation'] = PROPOSAL_AUTHORITY_POSITIONS[1]
    row['beneficiaryAuthority'] = PROPOSAL_AUTHORITY_POSITIONS[3]
    row['requestedEffect'] = PERMISSION_OVERLAY_EFFECT_VALUES[0]
    row['previousRequestId'] = 'a4w6-r-explicit-subject'
    row['mutationProposalFingerprint'] = 'a4w6-mpf'
    row['authorityScope'] = {
      operationClass: 'a4w6-class',
      matcher: { kind: 'exact', resource: 'a4w6:resource' },
    }
  }),
]

/** THE REFUSE SET — one probe per rejection clause of `parseRequestPayload`. */
const REFUSE_PROBES: readonly Probe[] = [
  probe('requestid-missing', (row) => {
    delete row['requestId']
  }),
  probe('requestid-empty', (row) => {
    row['requestId'] = ''
  }),
  probe('requestid-number', (row) => {
    row['requestId'] = 42
  }),
  probe('kind-missing', (row) => {
    delete row['kind']
  }),
  probe('kind-unknown', (row) => {
    row['kind'] = 'not-a-request-kind'
  }),
  probe('kind-number', (row) => {
    row['kind'] = 7
  }),
  probe('actionname-missing', (row) => {
    delete row['actionName']
  }),
  probe('actionname-empty', (row) => {
    row['actionName'] = ''
  }),
  probe('correlation-missing', (row) => {
    delete row['correlation']
  }),
  probe('correlation-empty', (row) => {
    row['correlation'] = ''
  }),
  probe('requester-missing', (row) => {
    delete row['requester']
  }),
  probe('requester-scalar', (row) => {
    row['requester'] = 'human-a4w6'
  }),
  probe('requester-unknown-kind', (row) => {
    row['requester'] = { kind: 'robot', humanId: 'human-a4w6' }
  }),
  probe('requester-human-empty', (row) => {
    row['requester'] = { kind: 'human', humanId: '' }
  }),
  probe('requester-instance-no-role', (row) => {
    row['requester'] = { kind: 'instance', instanceId: WORKER_ID }
  }),
  probe('requester-instance-empty-id', (row) => {
    row['requester'] = { kind: 'instance', instanceId: '', role: 'member' }
  }),
  probe('requester-instance-bad-role', (row) => {
    row['requester'] = { kind: 'instance', instanceId: WORKER_ID, role: 'admin' }
  }),
  probe('subject-unknown-kind', (row) => {
    row['subject'] = { kind: 'galaxy', instanceId: WORKER_ID }
  }),
  probe('subject-two-id-leaves', (row) => {
    row['subject'] = {
      kind: CONTROL_SUBJECT_KINDS.INSTANCE,
      instanceId: WORKER_ID,
      templateId: 'worker',
    }
  }),
  probe('subject-instance-empty', (row) => {
    row['subject'] = { kind: CONTROL_SUBJECT_KINDS.INSTANCE, instanceId: '' }
  }),
  probe('subject-disagrees-with-target', (row) => {
    row['targetInstanceId'] = 'a4w6-other-instance'
  }),
  probe('identity-none', (row) => {
    delete row['subject']
  }),
  probe('target-empty-legacy', (row) => {
    delete row['subject']
    row['targetInstanceId'] = ''
  }),
  probe('toolname-number', (row) => {
    row['toolName'] = 1
  }),
  probe('capability-unknown', (row) => {
    row['capabilityDomain'] = 'not-a-capability'
  }),
  probe('summary-number', (row) => {
    row['summary'] = 5
  }),
  probe('fingerprint-empty', (row) => {
    row['operationFingerprint'] = ''
  }),
  probe('digest-without-payload', (row) => {
    row['reviewPayloadDigest'] = 'a4w6-digest'
  }),
  probe('digest-empty', (row) => {
    row['reviewPayload'] = { a: 1 }
    row['reviewPayloadDigest'] = ''
  }),
  probe('coupling-unknown', (row) => {
    row['executionCoupling'] = 'coupled-harder'
  }),
  probe('case-id-empty', (row) => {
    row['approvalCaseId'] = ''
  }),
  probe('leg-ordinal-zero', (row) => {
    row['approvalCaseId'] = 'a4w6-case-x'
    row['legOrdinal'] = 0
    row['reviewAuthority'] = PROPOSAL_AUTHORITY_POSITIONS[0]
  }),
  probe('leg-ordinal-fraction', (row) => {
    row['approvalCaseId'] = 'a4w6-case-x'
    row['legOrdinal'] = 1.5
    row['reviewAuthority'] = PROPOSAL_AUTHORITY_POSITIONS[0]
  }),
  probe('leg-ordinal-string', (row) => {
    row['approvalCaseId'] = 'a4w6-case-x'
    row['legOrdinal'] = '2'
    row['reviewAuthority'] = PROPOSAL_AUTHORITY_POSITIONS[0]
  }),
  probe('review-authority-unknown', (row) => {
    row['reviewAuthority'] = 'supreme'
  }),
  probe('required-authority-unknown', (row) => {
    row['requiredAuthorityAtCreation'] = 'supreme'
  }),
  probe('beneficiary-authority-unknown', (row) => {
    row['beneficiaryAuthority'] = 'supreme'
  }),
  probe('effect-unknown', (row) => {
    row['requestedEffect'] = 'maybe'
  }),
  probe('previous-request-empty', (row) => {
    row['previousRequestId'] = ''
  }),
  probe('mutation-fingerprint-empty', (row) => {
    row['mutationProposalFingerprint'] = ''
  }),
  probe('authority-scope-no-matcher', (row) => {
    row['authorityScope'] = { operationClass: 'a4w6-class' }
  }),
  probe('authority-scope-empty-class', (row) => {
    row['authorityScope'] = {
      operationClass: '',
      matcher: { kind: 'exact', resource: 'a4w6:resource' },
    }
  }),
  probe('authority-scope-matcher-kind', (row) => {
    row['authorityScope'] = {
      operationClass: 'a4w6-class',
      matcher: { kind: 'regex', resource: 'a4w6:resource' },
    }
  }),
  probe('authority-scope-matcher-empty-resource', (row) => {
    row['authorityScope'] = {
      operationClass: 'a4w6-class',
      matcher: { kind: 'exact', resource: '' },
    }
  }),
  // A2-9 STRICT LEG RULE — the last clause of the parse.
  probe('a29-leg-without-ordinal', (row) => {
    row['approvalCaseId'] = 'a4w6-case-a29'
    row['reviewAuthority'] = PROPOSAL_AUTHORITY_POSITIONS[0]
  }),
  probe('a29-leg-without-authority', (row) => {
    row['approvalCaseId'] = 'a4w6-case-a29'
    row['legOrdinal'] = 1
  }),
]

/** Inject one row into the durable ledger (the a4w1 recipe). */
async function putRow(world: P6T1World, payload: unknown): Promise<number> {
  const ledger = world.domain.repositories.ledger
  const sequence = await ledger.allocateSequence()
  await ledger.put({
    schemaVersion: 2,
    sequence,
    rootSessionId: P6T4_ROOT,
    factType: 'control-request-recorded',
    payload,
    createdAt: P6T4_NOW,
  })
  return sequence
}

// ---------------------------------------------------------------------------
// LEG 1 — the brief's scenario: corrupt row NOT pending, real request STILL
// counted, terminal mark still closes.
// ---------------------------------------------------------------------------

const leg1 = await (async (): Promise<{
  readonly before: number
  readonly afterReal: number
  readonly afterCorrupt: number
  readonly afterDecision: number
  readonly requestIds: readonly string[]
  readonly corruptSequences: readonly number[]
  readonly corruptSequence: number
}> => {
  const world = await createP6T4World('a4w6-not-pending')
  const control = createP6T4Service(world)
  try {
    const before = foldPendingCount(world.domain)
    await control.requestControl({
      rootSessionId: P6T4_ROOT,
      caller: memberCaller(WORKER_ID),
      kind: CONTROL_REQUEST_KINDS.LEADER_APPROVAL,
      targetInstanceId: WORKER_ID,
      actionName: 'a4w6-live',
      correlation: 'a4w6-live-corr',
    })
    const afterReal = foldPendingCount(world.domain)
    // The RULING 5-A corrupt shape: a damaged PLAIN-OBJECT row (a readable
    // requestId, one clause broken) — exactly the class the pre-fix fold
    // counted.
    const corruptRow = canonicalRow('a4w6-s1-corrupt')
    delete corruptRow['correlation']
    const corruptSequence = await putRow(world, corruptRow)
    const state = await control.listControlState(P6T4_ROOT)
    const afterCorrupt = foldPendingCount(world.domain)
    // The terminal-mark path still works through the new gate: a decision
    // row closes the real (governable) request.
    const requestId = state.requests[0]?.requestId
    if (requestId === undefined) throw new Error('a4w6 leg1: the real request never landed')
    const ledger = world.domain.repositories.ledger
    await ledger.put({
      schemaVersion: 2,
      sequence: await ledger.allocateSequence(),
      rootSessionId: P6T4_ROOT,
      factType: 'control-decision-recorded',
      payload: { requestId, decision: 'allow', note: 'a4w6 terminal mark' },
      createdAt: P6T4_NOW,
    })
    const afterDecision = foldPendingCount(world.domain)
    return {
      before,
      afterReal,
      afterCorrupt,
      afterDecision,
      requestIds: state.requests.map((request) => request.requestId),
      corruptSequences: state.corruptLegs.map((leg) => leg.sequence),
      corruptSequence,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('A4-W6 leg 1 — one corrupt row is not pending; the real request still is', () => {
  it('the fold counts the real production request as pending', () => {
    expect(leg1.before).toBe(0)
    expect(leg1.afterReal).toBe(1)
  })

  it('the injected corrupt row is NOT pending — and the real request survives (the count is 1, not 2 and not 0)', () => {
    expect(leg1.requestIds).toHaveLength(1)
    expect(leg1.corruptSequences).toEqual([leg1.corruptSequence])
    // Pre-fix this read 2: the corrupt row was counted by the wider
    // "requestId is a string" candidacy. Post-fix, and NOT by zeroing:
    expect(leg1.afterCorrupt).toBe(1)
  })

  it('the terminal decision still closes the governable request (the new gate did not break decided/abandoned)', () => {
    expect(leg1.afterDecision).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// LEG 2 — differential, ACCEPT set: fold count == the service's own accepts.
// ---------------------------------------------------------------------------

const leg2 = await (async (): Promise<{
  readonly fold: number
  readonly serviceAccepted: number
  readonly missingFromService: readonly string[]
  readonly fileCorruptAnyway: readonly string[]
}> => {
  const world = await createP6T4World('a4w6-accept-set')
  const control = createP6T4Service(world)
  try {
    for (const entry of ACCEPT_PROBES) {
      await putRow(world, entry.payload)
    }
    const fold = foldPendingCount(world.domain)
    const state = await control.listControlState(P6T4_ROOT)
    const known = new Set(state.requests.map((request) => request.requestId))
    const corrupt = new Set(state.corruptLegs.map((leg) => leg.requestId ?? ''))
    return {
      fold,
      serviceAccepted: state.requests.length,
      missingFromService: ACCEPT_PROBES.filter(
        (entry) => !known.has(String(entry.payload['requestId'])),
      ).map((entry) => entry.name),
      fileCorruptAnyway: ACCEPT_PROBES.filter((entry) =>
        corrupt.has(String(entry.payload['requestId'])),
      ).map((entry) => entry.name),
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('A4-W6 leg 2 — differential accept set: the fold governs what the service governs', () => {
  it('the service itself accepts every accept probe (none filed corrupt)', () => {
    expect(leg2.missingFromService).toEqual([])
    expect(leg2.fileCorruptAnyway).toEqual([])
    expect(leg2.serviceAccepted).toBe(ACCEPT_PROBES.length)
  })

  it('the fold counts exactly the accepted set (only accepts present: a per-probe miss moves the total)', () => {
    expect(leg2.fold).toBe(ACCEPT_PROBES.length)
  })
})

// ---------------------------------------------------------------------------
// LEG 3 — differential, REFUSE set: the fold counts none of them.
// ---------------------------------------------------------------------------

const leg3 = await (async (): Promise<{
  readonly fold: number
  readonly serviceAcceptedNames: readonly string[]
  readonly idBearingNotFiledCorrupt: readonly string[]
  readonly corruptCount: number
  readonly refuseCount: number
  readonly nonObjectWritten: boolean
}> => {
  const world = await createP6T4World('a4w6-refuse-set')
  const control = createP6T4Service(world)
  try {
    for (const entry of REFUSE_PROBES) {
      await putRow(world, entry.payload)
    }
    // A payload that is not a plain object at all: the ledger parser is the
    // first line; whether it admits the row or refuses it, the fold must
    // never count it (the fold's own typeof guard is defense in depth).
    let nonObjectWritten = false
    try {
      await putRow(world, 'a4w6-scalar-payload')
      nonObjectWritten = true
    } catch {
      nonObjectWritten = false
    }
    const fold = foldPendingCount(world.domain)
    const state = await control.listControlState(P6T4_ROOT)
    const acceptedIds = new Set(state.requests.map((request) => request.requestId))
    const corruptIds = new Set(
      state.corruptLegs.map((leg) => leg.requestId).filter((id) => id !== undefined),
    )
    return {
      fold,
      serviceAcceptedNames: REFUSE_PROBES.filter((entry) => {
        const requestId = entry.payload['requestId']
        return typeof requestId === 'string' && acceptedIds.has(requestId)
      }).map((entry) => entry.name),
      // RULING 5-A: filing depends on damage alone. Probes whose requestId
      // itself SURVIVED the damage must appear in the corrupt set by id; a
      // damaged id (missing, empty, or non-string) is filed WITHOUT one and
      // is covered by the exact filing count below.
      idBearingNotFiledCorrupt: REFUSE_PROBES.filter((entry) => {
        const requestId = entry.payload['requestId']
        return (
          typeof requestId === 'string' &&
          requestId.length > 0 &&
          !corruptIds.has(requestId)
        )
      }).map((entry) => entry.name),
      corruptCount: state.corruptLegs.length,
      refuseCount: REFUSE_PROBES.length,
      nonObjectWritten,
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

describe('A4-W6 leg 3 — differential refuse set: not one refused row is ever pending', () => {
  it('the service refuses every refuse probe (none is governable)', () => {
    expect(leg3.serviceAcceptedNames).toEqual([])
  })

  it('the service files exactly the damaged rows as corrupt legs (RULING 5-A holds for the whole corpus)', () => {
    expect(leg3.idBearingNotFiledCorrupt).toEqual([])
    // The scalar probe above is NOT a plain object: the service files
    // corrupt legs from damaged plain objects only, so the filing count is
    // EXACTLY the plain-object corpus size whether or not the ledger
    // admitted the scalar row.
    expect(leg3.corruptCount).toBe(leg3.refuseCount)
  })

  it('the fold counts ZERO — no refusal is ever pending (a wrongly-governable probe cannot cancel anything here)', () => {
    // Pre-fix this read the corpus size, not 0.
    expect(leg3.fold).toBe(0)
  })

  it('a non-object payload is never counted as pending either (defense in depth)', () => {
    expect(leg3.fold).toBe(0)
    // The exact ledger-parser behaviour is recorded, not assumed (either
    // branch keeps the fold at 0 — asserted above).
    expect(typeof leg3.nonObjectWritten).toBe('boolean')
  })
})
