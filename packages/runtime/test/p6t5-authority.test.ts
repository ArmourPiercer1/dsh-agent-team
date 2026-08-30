/**
 * P6-T5 — reporter authority (through the facade) + NO WORKFLOW AUTHORITY
 * (structurally enforced, dedicated negative test — TaskDoc §11.7 item 4).
 *
 * REPORTER RULE (documented, enforced PRE-FACADE, zero side effects): a
 * member may report activity for itself only; the leader (the fixed
 * `inst-leader` identity — resolve.ts) may report for any live instance;
 * a human may not report member activity at all. The facade remains the
 * authority for everything else (target existence, caller liveness,
 * envelope) — its rejections arrive in the TeamRuntimeError family.
 *
 * NO WORKFLOW AUTHORITY: the exported surface is asserted CLOSED here —
 * the `ActivityLedger` port exposes exactly the four telemetry methods,
 * the package exports contain no lifecycle-mutating vocabulary, the
 * projection shapes use only the frozen UI Design field names, and the
 * durable fact vocabulary is the closed activity set + the facade audit
 * fact. The old legacy task rows are a PRESENTATION reference only (see
 * `activity/projection.ts` header) — nothing legacy is imported or
 * emitted.
 */

import { describe, expect, it } from 'vitest'
import * as activityModule from '../activity/index.js'
import {
  parseChildSessionId,
  parseInstanceId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto } from '../../contracts/src/index.js'
import {
  P6T2_SEEDS,
  createP6T5Suite,
  destroyP6T1World,
  expectActivityRejection,
  expectFacadeRejection,
  humanCaller,
  leaderCaller,
  memberCaller,
  p6t5Close,
  p6t5Open,
  p6t5Progress,
  rawLedgerCount,
  teamProjection,
} from './p6t5-helpers.js'

/** A seeded member in the ARCHIVED lifecycle (stale caller). */
const STALE_ID = 'inst-p6t5stale01'
const STALE_MEMBER: Partial<MemberInstanceRecordDto> = {
  instanceId: parseInstanceId(STALE_ID),
  templateId: parseTemplateId('worker'),
  label: 'archived-worker',
  childSessionId: parseChildSessionId('session-child-p6t5-stale'),
  lifecycle: 'ARCHIVED',
}

interface AuthorityResults {
 proxy: {
   code: string
   kind: string
   callerInstanceId: string
   targetInstanceId: string
  }
 human: { readonly code: string; readonly kind: string; readonly humanId: string }
 prePositiveLedgerCount: number
 leaderReport: {
   reportedByInstanceId: string
   status?: string
   summary?: string
  }
 selfReport: { readonly reportedByInstanceId: string }
 ghostSelfReport: { readonly code: string }
 staleSelfReport: { readonly code: string; readonly lifecycle: string }
 finalLedgerCount: number
 ledgerMethodNames: string[]
 exportNames: string[]
 forbiddenHits: string[]
 teamKeys: string[]
 instanceKeys: string[]
 subjectKeys: string[]
 intervalKeys: string[]
 factTypes: string[]
}

const results: AuthorityResults = {
  proxy: { code: '', kind: '', callerInstanceId: '', targetInstanceId: '' },
  human: { code: '', kind: '', humanId: '' },
  prePositiveLedgerCount: 0,
  leaderReport: { reportedByInstanceId: '' },
  selfReport: { reportedByInstanceId: '' },
  ghostSelfReport: { code: '' },
  staleSelfReport: { code: '', lifecycle: '' },
  finalLedgerCount: 0,
  ledgerMethodNames: [],
  exportNames: [],
  forbiddenHits: [],
  teamKeys: [],
  instanceKeys: [],
  subjectKeys: [],
  intervalKeys: [],
  factTypes: [],
}

const worker = P6T2_SEEDS.worker.instanceId
const worker2 = P6T2_SEEDS.worker2.instanceId

{
  const suite = await createP6T5Suite('p6t5x-authority', ['leader', 'worker', 'worker2'], {
    seedMembers: [STALE_MEMBER],
  })
  try {
    const { world, ledger } = suite

    // --- the reporter rule (pre-facade, zero side effects) --------------------
    const proxy = await expectActivityRejection(
      ledger.recordProgress(
        p6t5Progress({
          caller: memberCaller(worker2),
          instanceId: worker,
          subject: 'proxy',
          sequence: 1,
          requestToken: 'tok-p6t5-auth-1',
        }),
      ),
      'ACTIVITY_UNAUTHORIZED_REPORTER',
    )
    results.proxy = {
      code: proxy.code,
      kind: String(proxy.details?.['kind']),
      callerInstanceId: String(proxy.details?.['callerInstanceId']),
      targetInstanceId: String(proxy.details?.['targetInstanceId']),
    }

    const human = await expectActivityRejection(
      ledger.recordProgress(
        p6t5Progress({
          caller: humanCaller(),
          instanceId: worker,
          subject: 'human',
          sequence: 1,
          requestToken: 'tok-p6t5-auth-2',
        }),
      ),
      'ACTIVITY_UNAUTHORIZED_REPORTER',
    )
    results.human = {
      code: human.code,
      kind: String(human.details?.['kind']),
      humanId: String(human.details?.['humanId']),
    }

    // both rejections are pre-facade: NOTHING durable happened
    results.prePositiveLedgerCount = rawLedgerCount(world)

    // --- the allowed reporters --------------------------------------------------
    const leaderRow = await ledger.recordProgress(
      p6t5Progress({
        caller: leaderCaller(),
        instanceId: worker,
        subject: 'lead-supervision',
        sequence: 1,
        progress: 'in-progress',
        summary: 'leader check-in',
        lastAction: 'reviewing the worker plan',
        correlation: 'corr-lead',
        requestToken: 'tok-p6t5-auth-3',
      }),
    )
    const lane = teamProjection(ledger, world).instances.find((entry) => entry.instanceId === worker)
    const supervised = lane?.subjects.find((entry) => entry.subject === 'lead-supervision')
    results.leaderReport = {
      reportedByInstanceId: leaderRow.reportedByInstanceId,
      status: supervised?.status,
      summary: supervised?.summary,
    }

    const selfRow = await ledger.recordProgress(
      p6t5Progress({
        subject: 'self',
        sequence: 1,
        requestToken: 'tok-p6t5-auth-4',
      }),
    )
    results.selfReport = { reportedByInstanceId: selfRow.reportedByInstanceId }

    // an interval pair with both optional labels (exercises every frozen
    // interval key in the production read path)
    await ledger.openInterval(
      p6t5Open({
        subject: 'ops',
        sequence: 1,
        correlation: 'corr-1',
        note: 'ops started',
        requestToken: 'tok-p6t5-auth-7',
      }),
    )
    await ledger.closeInterval(
      p6t5Close({
        subject: 'ops',
        sequence: 2,
        correlation: 'corr-1',
        closeNote: 'ops done',
        requestToken: 'tok-p6t5-auth-8',
      }),
    )

    // --- the facade authority (TeamRuntimeError family) -------------------------
    // an unknown instance self-reporting: the facade resolves the target
    // first (instanceId-first) → INSTANCE_NOT_FOUND
    const ghost = await expectFacadeRejection(
      ledger.recordProgress(
        p6t5Progress({
          caller: memberCaller('inst-p6t5ghost00'),
          instanceId: 'inst-p6t5ghost00',
          subject: 'ghost',
          sequence: 1,
          requestToken: 'tok-p6t5-auth-5',
        }),
      ),
      'TEAM_RUNTIME_INSTANCE_NOT_FOUND',
    )
    results.ghostSelfReport = { code: ghost.code }

    // a stale (ARCHIVED) member self-reporting: the facade resolves the
    // caller identity + role from the durable TeamDomain → CALLER_ROLE_STALE
    const stale = await expectFacadeRejection(
      ledger.recordProgress(
        p6t5Progress({
          caller: memberCaller(STALE_ID),
          instanceId: STALE_ID,
          subject: 'stale',
          sequence: 1,
          requestToken: 'tok-p6t5-auth-6',
        }),
      ),
      'TEAM_RUNTIME_CALLER_ROLE_STALE',
    )
    results.staleSelfReport = {
      code: stale.code,
      lifecycle: String(stale.details?.['lifecycle']),
    }

    results.finalLedgerCount = rawLedgerCount(world)

    // --- NO WORKFLOW AUTHORITY: the closed surface (structural) -----------------
    results.ledgerMethodNames = Object.keys(ledger).sort()
    results.exportNames = Object.keys(activityModule).sort()
    const FORBIDDEN = [
      'lifecycle',
      'transition',
      'archive',
      'restore',
      'dispose',
      'workflow',
      'completion',
      'settle',
      'dag',
    ]
    results.forbiddenHits = results.exportNames.filter((name) =>
      FORBIDDEN.some((word) => name.toLowerCase().includes(word)),
    )

    // the projection key sets (every key that may be emitted)
    const proj = teamProjection(ledger, world)
    results.teamKeys = Object.keys(proj).sort()
    const instanceKeys = new Set<string>()
    const subjectKeys = new Set<string>()
    const intervalKeys = new Set<string>()
    for (const instance of proj.instances) {
      for (const key of Object.keys(instance)) instanceKeys.add(key)
      for (const subject of instance.subjects) {
        for (const key of Object.keys(subject)) subjectKeys.add(key)
        for (const interval of [...subject.openIntervals, ...subject.closedIntervals]) {
          for (const key of Object.keys(interval)) intervalKeys.add(key)
        }
      }
    }
    results.instanceKeys = [...instanceKeys].sort()
    results.subjectKeys = [...subjectKeys].sort()
    results.intervalKeys = [...intervalKeys].sort()

    // the durable fact vocabulary of the team ledger
    results.factTypes = [...new Set(world.domain.repositories.ledger.list().map((entry) => entry.factType))].sort()
  } finally {
    await destroyP6T1World(suite.world)
  }
}

describe('P6-T5 reporter authority (the reporter rule + the facade)', () => {
  it('rejects a member proxying another member (typed, pre-facade)', () => {
    expect(results.proxy.code).toBe('ACTIVITY_UNAUTHORIZED_REPORTER')
    expect(results.proxy.kind).toBe('member-proxy-report')
    expect(results.proxy.callerInstanceId).toBe(worker2)
    expect(results.proxy.targetInstanceId).toBe(worker)
  })

  it('rejects a human reporter (typed, pre-facade)', () => {
    expect(results.human.code).toBe('ACTIVITY_UNAUTHORIZED_REPORTER')
    expect(results.human.kind).toBe('human-reporter')
    expect(results.human.humanId).toBe('human-p6t2-owner')
  })

  it('leaves ZERO side effects on reporter-rule rejections (pre-facade)', () => {
    expect(results.prePositiveLedgerCount).toBe(0)
  })

  it('allows the leader to report for a member (reportedByInstanceId = the leader)', () => {
    expect(results.leaderReport.reportedByInstanceId).toBe('inst-leader')
    expect(results.leaderReport.status).toBe('in-progress')
    expect(results.leaderReport.summary).toBe('leader check-in')
  })

  it('allows a member self-report (the baseline positive)', () => {
    expect(results.selfReport.reportedByInstanceId).toBe(worker)
  })

  it('defers an unknown-instance self-report to the facade (INSTANCE_NOT_FOUND)', () => {
    // the reporter rule passes (self-report); the facade resolves the
    // instanceId-first target and finds no member record
    expect(results.ghostSelfReport.code).toBe('TEAM_RUNTIME_INSTANCE_NOT_FOUND')
  })

  it('defers a stale (ARCHIVED) member self-report to the facade (CALLER_ROLE_STALE)', () => {
    expect(results.staleSelfReport.code).toBe('TEAM_RUNTIME_CALLER_ROLE_STALE')
    expect(results.staleSelfReport.lifecycle).toBe('ARCHIVED')
  })

  it('keeps the ledger count for the allowed reports only (row + audit each)', () => {
    // 4 allowed writes (leader progress, self progress, ops open, ops close)
    // × (1 activity row + 1 facade audit fact); the 4 rejections wrote nothing
    expect(results.finalLedgerCount).toBe(8)
  })
})

describe('P6-T5 NO WORKFLOW AUTHORITY (the closed telemetry surface)', () => {
  it('exposes exactly the four telemetry methods on the ActivityLedger port', () => {
    expect(results.ledgerMethodNames).toEqual([
      'closeInterval',
      'listActivityFacts',
      'openInterval',
      'recordProgress',
    ])
  })

  it('exports no lifecycle-mutating vocabulary (dedicated negative test)', () => {
    // every exported name is free of workflow-authority words: nothing
    // here can start/stop/archive/restore a member or decide completion
    expect(results.forbiddenHits).toEqual([])
    // and the surface is exactly the documented closed set
    expect(results.exportNames).toEqual([
      'ACTIVITY_CORRELATION_MAX_LENGTH',
      'ACTIVITY_ERROR_CODES',
      'ACTIVITY_FACT_TYPES',
      'ACTIVITY_LAST_ACTION_MAX_LENGTH',
      'ACTIVITY_NOTE_MAX_LENGTH',
      'ACTIVITY_OPS',
      'ACTIVITY_REQUEST_TOKEN_MAX_LENGTH',
      'ACTIVITY_SUBJECT_MAX_LENGTH',
      'ACTIVITY_SUMMARY_MAX_LENGTH',
      'ActivityError',
      'FACT_TYPE_TO_OP',
      'OP_TO_FACT_TYPE',
      'PROGRESS_VALUES',
      'createActivityLedger',
      'isActivityError',
      'isActivityFactType',
      'parseActivityFact',
      'projectSubjectFromRows',
      'projectTeamFromRows',
    ])
  })

  it('emits only the frozen UI Design field names in the projection shapes', () => {
    // the closed key sets (the frozen UI Design field names — nothing more)
    expect(results.teamKeys).toEqual(['instances', 'rootSessionId'])
    expect(results.instanceKeys).toEqual(['instanceId', 'label', 'subjects', 'templateId'])
    expect(results.subjectKeys).toEqual([
      'closedIntervals',
      'correlation',
      'instanceId',
      'lastAction',
      'lastFactAt',
      'lastProgressAt',
      'openIntervals',
      'sequence',
      'status',
      'subject',
      'summary',
    ])
    expect(results.intervalKeys).toEqual([
      'closeNote',
      'closedAt',
      'closedSequence',
      'correlation',
      'note',
      'open',
      'startedAt',
      'startedSequence',
    ])
  })

  it('keeps the durable fact vocabulary closed (activity facts + the facade audit fact)', () => {
    expect(results.factTypes).toEqual([
      'activity-interval-closed',
      'activity-interval-opened',
      'activity-progress-recorded',
      'team-coordination-recorded',
    ])
  })
})
