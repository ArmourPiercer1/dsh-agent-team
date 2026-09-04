/**
 * p8t3-round-trip.test.ts — P8-T3 mandatory test 1: ROUND-TRIP (brief §88;
 * design note §8).
 *
 * A representative method per catalog category: request payload in →
 * typed error-or-value envelope out → the value deserializes to the typed
 * shape with provenance intact (G8 criterion 5). The real dispatcher +
 * real category handlers run over the fake ports (mock-first, R28).
 *
 * Covered: catalog.list, intent.probe, team.getProjection (+ the
 * whole-projection generation contract), team.getLedgerPage (the G8
 * sequence-cursor pagination contract), member.create (token echo +
 * effectSequence), override.get (the `null` cell), policyState.get,
 * compatibility.get, handoff.prepare, legacy.inspect.
 *
 * S1-B (G8 gate supplement): a second suite drives member.create once per
 * P6-T2 `RuntimeActionEffect` kind and pins the canonical `effectSequence`
 * provenance rule (sequence-carrying kinds vs read effects vs malformed
 * shapes).
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
  expectSuccess,
  makeDispatcher,
  p8t3SafePolicyEntry,
  p8t3Wire,
  P8T3_BLUEPRINT_ID,
  P8T3_INSTANCE_ID,
  P8T3_REQUEST_TOKEN,
  P8T3_SOURCE_SESSION_ID,
  P8T3_TEAM_SESSION_ID,
  P8T3_TEMPLATE_ID,
} from './p8t3-helpers.js'
import { REMOTE_CONTRACT_VERSION } from '../src/index.js'
import type { RemoteResponse, RemoteSafeJsonValue, RemoteSafeRecord } from '../src/index.js'

/**
 * Structural key-presence check for the error details shape (the allowed
 * matcher set has no toMatchObject; `hasOwnProperty` + toBe is exact).
 */
function expectDetailsHaveKeys(details: Record<string, unknown>, keys: readonly string[]): void {
  for (const key of keys) {
    expect(Object.prototype.hasOwnProperty.call(details, key)).toBe(true)
  }
}

// Module level (top-level await): drive the real dispatcher over the fake
// ports and capture every scenario result for the synchronous assertions.
const RT = await (async () => {
  const catalog = makeDispatcher()
  const catalogList = await catalog.dispatch('catalog.list', p8t3Wire({}))

  const intent = makeDispatcher()
  const intentProbe = await intent.dispatch(
    'intent.probe',
    p8t3Wire({ blueprintId: P8T3_BLUEPRINT_ID, environmentFacts: [] }),
  )
  const intentProbeMissingFacts = await intent.dispatch(
    'intent.probe',
    p8t3Wire({ blueprintId: P8T3_BLUEPRINT_ID }),
  )

  const projection = makeDispatcher()
  const projectionResponse = await projection.dispatch(
    'team.getProjection',
    p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )

  const ledger = makeDispatcher()
  const ledgerPage1 = await ledger.dispatch(
    'team.getLedgerPage',
    p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID, limit: 2 }),
  )
  const ledgerPage2 = await ledger.dispatch(
    'team.getLedgerPage',
    p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID, afterSequence: 2, limit: 2 }),
  )

  const member = makeDispatcher()
  const memberCreate = await member.dispatch(
    'member.create',
    p8t3Wire({
      teamSessionId: P8T3_TEAM_SESSION_ID,
      caller: { kind: 'human', humanId: 'h-1' },
      requestToken: P8T3_REQUEST_TOKEN,
    }),
  )

  const override = makeDispatcher({
    override: {
      get() {
        return null
      },
      set(request) {
        return {
          record: {
            teamSessionId: request.teamSessionId,
            capability: request.capability,
            value: p8t3SafePolicyEntry(request.value),
            actor: { ...request.actor },
          },
        }
      },
      reset() {
        return { removed: false }
      },
    },
  })
  const overrideGet = await override.dispatch(
    'override.get',
    p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID, capability: 'model' }),
  )

  const policyState = makeDispatcher()
  const policyStateGet = await policyState.dispatch(
    'policyState.get',
    p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )

  const compatibility = makeDispatcher()
  const compatibilityGet = await compatibility.dispatch(
    'compatibility.get',
    p8t3Wire({ teamSessionId: P8T3_TEAM_SESSION_ID }),
  )

  const handoff = makeDispatcher()
  const handoffPrepare = await handoff.dispatch(
    'handoff.prepare',
    p8t3Wire({ sourceSessionId: P8T3_SOURCE_SESSION_ID }),
  )

  const legacy = makeDispatcher()
  const legacyInspect = await legacy.dispatch(
    'legacy.inspect',
    p8t3Wire({ dshHome: 'D:/dsh-home' }),
  )

  return {
    catalogList,
    catalogCalls: catalog.ports.calls,
    intentProbe,
    intentProbeMissingFacts,
    projectionResponse,
    ledgerPage1,
    ledgerPage2,
    memberCreate,
    memberAdmissionRequests: member.ports.admissionRequests,
    overrideGet,
    policyStateGet,
    compatibilityGet,
    handoffPrepare,
    handoffCalls: handoff.ports.calls,
    legacyInspect,
  }
})()

describe('P8-T3 round-trip: representative method per category', () => {
  it('catalog.list: empty params in, typed value + full provenance out', () => {
    const success = expectSuccess(RT.catalogList)
    expect(success.value.data).toEqual({
      blueprints: [{ blueprintId: P8T3_BLUEPRINT_ID, revisions: [1, 2] }],
    })
    // The canonical provenance block (G8: origin + attribution + echoes).
    expect(success.value.provenance).toEqual({
      origin: 'team-remote',
      method: 'catalog.list',
      endpoint: 'catalog.list',
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
      projectionGeneration: null,
      effectSequence: null,
    })
    expect(RT.catalogCalls).toEqual(['catalog.list'])
  })

  it('intent.probe: required environmentFacts (empty allowed) round-trip', () => {
    const success = expectSuccess(RT.intentProbe)
    expect(success.value.data).toEqual({
      compatibility: {
        status: 'OPEN',
        blueprintId: P8T3_BLUEPRINT_ID,
        fingerprint: 'fp-1',
        requirements: [],
        environmentFactCount: 0,
      },
    })
    expect(success.value.provenance.origin).toBe('team-remote')
    expect(success.value.provenance.method).toBe('intent.probe')
    // A missing environmentFacts is a typed param failure, not a success.
    const error = expectError(RT.intentProbeMissingFacts)
    expect(error.error.code).toBe('malformed-params')
    expectDetailsHaveKeys(error.error.details as unknown as Record<string, unknown>, [
      'field',
      'method',
      'endpoint',
      'contractVersion',
      'requestToken',
    ])
  })

  it('team.getProjection: exact DTO deep equality + generation provenance (G8 stale-overwrite)', () => {
    const success = expectSuccess(RT.projectionResponse)
    // The exact nine-field DTO (frozen P8-T1 shape) — deep equality.
    expect(success.value.data).toEqual({
      projection: {
        schemaVersion: 1,
        teamSessionId: P8T3_TEAM_SESSION_ID,
        blueprint: { blueprintId: P8T3_BLUEPRINT_ID, revision: 2 },
        generation: 7,
        generatedAt: '2026-08-29T00:00:07.000Z',
        root: { rootSessionId: P8T3_TEAM_SESSION_ID },
        templates: [{ templateId: P8T3_TEMPLATE_ID }],
        members: [
          { instanceId: P8T3_INSTANCE_ID, templateId: P8T3_TEMPLATE_ID, childSessionId: 'child-1' },
        ],
        ledger: {
          latestSequence: 3,
          totalEntries: 3,
          byCategory: { fact: 3 },
          pendingControlCount: 0,
        },
      },
    })
    // G8 stale-overwrite: the client-side isStaleTeamProjection check is
    // exercisable from the provenance ALONE (no extra state).
    const generation = (success.value.data as unknown as {
      readonly projection: { readonly generation: number }
    }).projection.generation
    expect(generation).toBe(7)
    expect(success.value.provenance.projectionGeneration).toBe(generation)
    // Monotonicity guard: a stale generation is strictly smaller.
    expect(generation).toBeGreaterThan(generation - 1)
  })

  it('team.getLedgerPage: stable sequence-cursor pagination (G8 ledger pagination)', () => {
    // Page 1: default afterSequence 0, limit 2 → entries 1..2, cursor 2.
    const firstSuccess = expectSuccess(RT.ledgerPage1)
    expect(firstSuccess.value.data).toEqual({
      entries: [
        {
          schemaVersion: 1,
          sequence: 1,
          rootSessionId: P8T3_TEAM_SESSION_ID,
          factType: 'team-created',
          payload: { factType: 'team-created', sequence: 1 },
          operationId: 'op-1',
          createdAt: '2026-08-29T00:00:01.000Z',
        },
        {
          schemaVersion: 1,
          sequence: 2,
          rootSessionId: P8T3_TEAM_SESSION_ID,
          factType: 'member-created',
          payload: { factType: 'member-created', sequence: 2 },
          operationId: 'op-2',
          createdAt: '2026-08-29T00:00:02.000Z',
        },
      ],
      nextAfterSequence: 2,
      total: 3,
    })
    // Page 2: cursor 2 → entry 3, no further cursor.
    const secondSuccess = expectSuccess(RT.ledgerPage2)
    expect(secondSuccess.value.data).toEqual({
      entries: [
        {
          schemaVersion: 1,
          sequence: 3,
          rootSessionId: P8T3_TEAM_SESSION_ID,
          factType: 'fact',
          payload: { factType: 'fact', sequence: 3 },
          operationId: 'op-3',
          createdAt: '2026-08-29T00:00:03.000Z',
        },
      ],
      nextAfterSequence: null,
      total: 3,
    })
    // The cursor advances strictly: page 2 starts after page 1's cursor.
    const cursor = (firstSuccess.value.data as unknown as {
      readonly nextAfterSequence: number | null
    }).nextAfterSequence
    expect(cursor).toBe(2)
    expect(3).toBeGreaterThan(cursor as number)
  })

  it('member.create: human caller + token echo + effectSequence provenance', () => {
    const success = expectSuccess(RT.memberCreate)
    expect(success.value.data).toEqual({
      outcome: { accepted: true, effect: { kind: 'fact-recorded', factType: 'fact', sequence: 3 } },
    })
    // The token echo + the durable effect sequence ride in the provenance.
    expect(success.value.provenance.requestToken).toBe(P8T3_REQUEST_TOKEN)
    expect(success.value.provenance.effectSequence).toBe(3)
    expect(success.value.provenance.projectionGeneration).toBe(null)
    // The port received the exact admission request (action mapping).
    expect(RT.memberAdmissionRequests).toEqual([
      {
        rootSessionId: P8T3_TEAM_SESSION_ID,
        action: 'create-member',
        caller: { kind: 'human', humanId: 'h-1' },
        requestToken: P8T3_REQUEST_TOKEN,
      },
    ])
  })

  it('override.get: a missing cell round-trips as an explicit null', () => {
    const success = expectSuccess(RT.overrideGet)
    expect(success.value.data).toEqual({ override: null })
    expect(success.value.provenance.method).toBe('override.get')
  })

  it('policyState.get: the current policy state view round-trip', () => {
    const success = expectSuccess(RT.policyStateGet)
    expect(success.value.data).toEqual({
      state: { stateId: 'state-1', cells: {}, teamSessionId: P8T3_TEAM_SESSION_ID },
    })
    expect(success.value.provenance.requestToken).toBe(null)
  })

  it('compatibility.get: the current verdict round-trip', () => {
    const success = expectSuccess(RT.compatibilityGet)
    expect(success.value.data).toEqual({
      verdict: {
        status: 'OPEN',
        blueprintId: P8T3_BLUEPRINT_ID,
        fingerprint: 'fp-1',
        requirements: [],
        teamSessionId: P8T3_TEAM_SESSION_ID,
      },
    })
    expect(success.value.provenance.endpoint).toBe('compatibility.get')
  })

  it('handoff.prepare: read-only source summary (no team creation)', () => {
    const success = expectSuccess(RT.handoffPrepare)
    expect(success.value.data).toEqual({
      summary: {
        sourceSessionId: P8T3_SOURCE_SESSION_ID,
        blueprintCandidates: [P8T3_BLUEPRINT_ID],
        memberCount: 1,
      },
      sourceSessionId: P8T3_SOURCE_SESSION_ID,
    })
    // D-6: prepare never creates — only the prepare port was called.
    expect(RT.handoffCalls).toEqual(['handoff.prepare'])
  })

  it('legacy.inspect: the closed inspection union round-trip', () => {
    const success = expectSuccess(RT.legacyInspect)
    expect(success.value.data).toEqual({
      inspection: {
        status: 'legacy-team',
        teamId: 'legacy-1',
        dshHome: 'D:/dsh-home',
      },
    })
    expect(success.value.provenance.origin).toBe('team-remote')
  })
})

// --- S1-B (G8 gate supplement): the effectSequence provenance follows the
// --- P6-T2 `RuntimeActionEffect` closed union (brief §5;
// --- runtime/admission/types.ts). One member.create per effect kind, over
// --- a dispatcher whose admission port returns that kind's outcome.

/** One admission outcome shape carrying the given P6-T2 effect record. */
function efxOutcome(effect: RemoteSafeJsonValue): RemoteSafeRecord {
  return { accepted: true, effect }
}

/** The effect table: every P6-T2 kind, plus the malformed shapes that must
 *  NOT yield a sequence. `expected` is the wire provenance cell. */
const EFX_TABLE: readonly {
  readonly name: string
  readonly effect: RemoteSafeJsonValue
  readonly expected: number | null
}[] = [
  {
    name: 'fact-recorded',
    effect: { kind: 'fact-recorded', factType: 'fact', sequence: 5 },
    expected: 5,
  },
  {
    name: 'work-admitted',
    effect: {
      kind: 'work-admitted',
      instanceId: P8T3_INSTANCE_ID,
      fromLifecycle: 'CREATED',
      lifecycleCommitted: true,
      sequence: 6,
    },
    expected: 6,
  },
  {
    name: 'lifecycle-changed',
    effect: {
      kind: 'lifecycle-changed',
      instanceId: P8T3_INSTANCE_ID,
      from: 'RUNNING',
      to: 'SETTLED',
      sequence: 7,
    },
    expected: 7,
  },
  {
    name: 'member-activated-carries-ledgerSequence',
    effect: {
      kind: 'member-activated',
      instanceId: P8T3_INSTANCE_ID,
      templateId: P8T3_TEMPLATE_ID,
      childSessionId: 'child-efx',
      operationId: 'op-efx',
      replayed: false,
      ledgerSequence: 8,
    },
    expected: 8,
  },
  {
    name: 'member-activated-without-ledgerSequence',
    effect: {
      kind: 'member-activated',
      instanceId: P8T3_INSTANCE_ID,
      templateId: P8T3_TEMPLATE_ID,
      childSessionId: 'child-efx',
      operationId: 'op-efx',
      replayed: true,
    },
    expected: null,
  },
  { name: 'none', effect: { kind: 'none' }, expected: null },
  {
    name: 'config-inspected',
    effect: { kind: 'config-inspected', effective: {} },
    expected: null,
  },
  { name: 'members-listed', effect: { kind: 'members-listed', members: [] }, expected: null },
  { name: 'templates-listed', effect: { kind: 'templates-listed', templates: [] }, expected: null },
  {
    name: 'unknown-kind',
    effect: { kind: 'not-an-effect-kind', sequence: 9 },
    expected: null,
  },
  { name: 'malformed-effect', effect: 'not-an-object', expected: null },
  {
    name: 'non-integer-sequence',
    effect: { kind: 'fact-recorded', factType: 'fact', sequence: 1.5 },
    expected: null,
  },
]

// Module level (top-level await): one member.create per table row.
const EFX = await (async () => {
  const rows: { readonly name: string; readonly response: RemoteResponse }[] = []
  for (const row of EFX_TABLE) {
    const dispatcher = makeDispatcher({
      admission: {
        performAction() {
          return efxOutcome(row.effect)
        },
      },
    })
    const response = await dispatcher.dispatch(
      'member.create',
      p8t3Wire({
        teamSessionId: P8T3_TEAM_SESSION_ID,
        caller: { kind: 'human', humanId: 'h-1' },
        requestToken: P8T3_REQUEST_TOKEN,
      }),
    )
    rows.push({ name: row.name, response })
  }
  return rows
})()

function efxRow(name: string): RemoteResponse {
  const row = EFX.find((entry) => entry.name === name)
  if (row === undefined) throw new Error(`missing effect row: ${name}`)
  return row.response
}

describe('P8-T3 S1-B: effectSequence provenance follows the P6-T2 effect vocabulary', () => {
  it('sequence-carrying kinds: the durable sequence rides in the provenance', () => {
    expect(expectSuccess(efxRow('fact-recorded')).value.provenance.effectSequence).toBe(5)
    expect(expectSuccess(efxRow('work-admitted')).value.provenance.effectSequence).toBe(6)
    expect(expectSuccess(efxRow('lifecycle-changed')).value.provenance.effectSequence).toBe(7)
    expect(
      expectSuccess(efxRow('member-activated-carries-ledgerSequence')).value.provenance
        .effectSequence,
    ).toBe(8)
  })

  it('read effects + the absent member-activated ledgerSequence: the wire cell is null', () => {
    for (const name of [
      'member-activated-without-ledgerSequence',
      'none',
      'config-inspected',
      'members-listed',
      'templates-listed',
    ]) {
      expect(expectSuccess(efxRow(name)).value.provenance.effectSequence).toBe(null)
    }
  })

  it('malformed shapes: unknown kind, non-object effect, non-integer sequence', () => {
    expect(expectSuccess(efxRow('unknown-kind')).value.provenance.effectSequence).toBe(null)
    expect(expectSuccess(efxRow('malformed-effect')).value.provenance.effectSequence).toBe(null)
    expect(expectSuccess(efxRow('non-integer-sequence')).value.provenance.effectSequence).toBe(
      null,
    )
  })

  it('the outcome passes through unchanged (only the provenance is derived)', () => {
    const success = expectSuccess(efxRow('member-activated-carries-ledgerSequence'))
    expect(success.value.data).toEqual({
      outcome: efxOutcome(
        {
          kind: 'member-activated',
          instanceId: P8T3_INSTANCE_ID,
          templateId: P8T3_TEMPLATE_ID,
          childSessionId: 'child-efx',
          operationId: 'op-efx',
          replayed: false,
          ledgerSequence: 8,
        },
      ),
    })
    expect(success.value.provenance.projectionGeneration).toBe(null)
    expect(success.value.provenance.requestToken).toBe(P8T3_REQUEST_TOKEN)
  })
})
