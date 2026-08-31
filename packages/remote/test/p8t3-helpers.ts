/**
 * p8t3-helpers.ts — shared fixtures of the P8-T3 Remote contract v1 suite:
 * twelve fake backing ports (call-logged), a dispatcher factory, and the
 * wire-envelope / result assert helpers.
 *
 * The fakes are plain data objects (lossless-JSON-safe records only): the
 * remote layer under test is REAL (contracts + handlers + dispatcher); only
 * the backing ports are simulated (mock-first, ruling R28).
 *
 * Erasable TS only; no `node:` builtins; relative `.js` imports
 * (NodeNext + verbatimModuleSyntax).
 * @module p8t3-helpers
 */

import { expect } from 'vitest'

import {
  createRemoteDispatcher,
  REMOTE_CONTRACT_VERSION,
} from '../src/index.js'
import type {
  RemoteAdmissionPort,
  RemoteAdmissionRequest,
  RemoteCatalogPort,
  RemoteCompatibilityPort,
  RemoteDispatcher,
  RemoteErrorResult,
  RemoteHandlerDeps,
  RemoteHandoffPort,
  RemoteIntentPort,
  RemoteLegacyPort,
  RemoteLifecyclePort,
  RemoteLedgerPort,
  RemoteProjectionPort,
  RemotePolicyEntry,
  RemotePolicyStatePort,
  RemoteResponse,
  RemoteSafeJsonValue,
  RemoteSafeRecord,
  RemoteSuccessResult,
  RemoteTeamCreatePort,
  RemoteOverridePort,
} from '../src/index.js'

// --- stable fixture identifiers (all satisfy the frozen P3 ID rule) --------

/** A valid TeamSessionId (= RootSessionId, invariant 9). */
export const P8T3_TEAM_SESSION_ID = 'root-1'
/** A valid instance id. */
export const P8T3_INSTANCE_ID = 'inst-1'
/** A valid blueprint id. */
export const P8T3_BLUEPRINT_ID = 'bp-1'
/** A valid template id. */
export const P8T3_TEMPLATE_ID = 'tpl-1'
/** A valid source-session id (handoff). */
export const P8T3_SOURCE_SESSION_ID = 'src-1'
/** A valid request token (opaque, 1..255, no control/whitespace). */
export const P8T3_REQUEST_TOKEN = 'tok-1'

// --- fake port data (deterministic lossless records) ------------------------

const P8T3_BLUEPRINTS: readonly RemoteSafeRecord[] = [
  { blueprintId: P8T3_BLUEPRINT_ID, revisions: [1, 2] },
]

const P8T3_BLUEPRINT: RemoteSafeRecord = {
  blueprintId: P8T3_BLUEPRINT_ID,
  revision: 2,
  leaderTemplate: { templateId: P8T3_TEMPLATE_ID },
  memberTemplates: [],
}

const P8T3_COMPATIBILITY: RemoteSafeRecord = {
  status: 'OPEN',
  blueprintId: P8T3_BLUEPRINT_ID,
  fingerprint: 'fp-1',
  requirements: [],
}

const P8T3_PROJECTION: RemoteSafeRecord = {
  schemaVersion: 1,
  teamSessionId: P8T3_TEAM_SESSION_ID,
  blueprint: { blueprintId: P8T3_BLUEPRINT_ID, revision: 2 },
  generation: 7,
  generatedAt: '2026-08-29T00:00:07.000Z',
  root: { rootSessionId: P8T3_TEAM_SESSION_ID },
  templates: [{ templateId: P8T3_TEMPLATE_ID }],
  members: [
    {
      instanceId: P8T3_INSTANCE_ID,
      templateId: P8T3_TEMPLATE_ID,
      childSessionId: 'child-1',
    },
  ],
  ledger: {
    latestSequence: 3,
    totalEntries: 3,
    byCategory: { fact: 3 },
    pendingControlCount: 0,
  },
}

function p8t3LedgerEntry(sequence: number, factType: string): RemoteSafeRecord {
  return {
    schemaVersion: 1,
    sequence,
    rootSessionId: P8T3_TEAM_SESSION_ID,
    factType,
    payload: { factType, sequence },
    operationId: `op-${sequence}`,
    createdAt: `2026-08-29T00:00:0${sequence}.000Z`,
  }
}

const P8T3_LEDGER_ENTRIES: readonly RemoteSafeRecord[] = [
  p8t3LedgerEntry(1, 'team-created'),
  p8t3LedgerEntry(2, 'member-created'),
  p8t3LedgerEntry(3, 'fact'),
]

const P8T3_ADMISSION_OUTCOME: RemoteSafeRecord = {
  accepted: true,
  effect: { kind: 'fact-recorded', factType: 'fact', sequence: 3 },
}

const P8T3_MEMBER_ARCHIVE_RESULT: RemoteSafeRecord = {
  member: { instanceId: P8T3_INSTANCE_ID },
  steps: ['quiesce', 'release'],
  drained: true,
  residencyDropped: true,
}

const P8T3_MEMBER_RESTORE_RESULT: RemoteSafeRecord = {
  member: { instanceId: P8T3_INSTANCE_ID },
  steps: ['rehydrate', 'rebind'],
}

const P8T3_MEMBER_DISPOSE_RESULT: RemoteSafeRecord = {
  member: { instanceId: P8T3_INSTANCE_ID },
  steps: ['quiesce', 'drop'],
  drained: true,
  residencyDropped: true,
}

const P8T3_OVERRIDE_RECORD: RemoteSafeRecord = {
  mutationId: 'm-1',
  teamSessionId: P8T3_TEAM_SESSION_ID,
  capability: 'model',
  value: { kind: 'allow', items: ['m-1'] },
}

const P8T3_POLICY_STATE_VIEW: RemoteSafeRecord = {
  stateId: 'state-1',
  cells: {},
}

const P8T3_POLICY_STATE_TRANSITION: RemoteSafeRecord = {
  transitionId: 't-1',
  fromStateId: 'state-1',
  toStateId: 'state-2',
  at: '2026-08-29T00:00:09.000Z',
}

const P8T3_HANDOFF_SUMMARY: RemoteSafeRecord = {
  sourceSessionId: P8T3_SOURCE_SESSION_ID,
  blueprintCandidates: [P8T3_BLUEPRINT_ID],
  memberCount: 1,
}

const P8T3_HANDOFF_STATE: RemoteSafeRecord = {
  state: 'replayed',
  operationId: 'op-h-1',
}

const P8T3_LEGACY_INSPECTION: RemoteSafeRecord = {
  status: 'legacy-team',
  teamId: 'legacy-1',
}

// --- the twelve fake ports ---------------------------------------------------

/** The fake port set with its call log (the ports are plain objects). */
export interface P8T3FakePorts extends RemoteHandlerDeps {
  /** Every port invocation, in order, as `<category>.<method>` labels. */
  readonly calls: string[]
  /** Every admission request the member category forwarded. */
  readonly admissionRequests: readonly RemoteAdmissionRequest[]
}

/**
 * Build the twelve fake backing ports.
 * @param overrides - optional port replacements (e.g. a throwing
 *   admission port in the admission-error scenarios).
 */
/**
 * Rebuild a parsed policy entry as a fresh, wire-ready record: the parsed
 * entry is readonly-typed (frozen at the boundary), while port results must
 * be lossless-JSON records with mutable arrays.
 * @param entry - a parsed policy entry.
 * @returns the equivalent fresh record.
 */
export function p8t3SafePolicyEntry(entry: RemotePolicyEntry): RemoteSafeJsonValue {
  return entry.kind === 'allow'
    ? { kind: 'allow', items: [...entry.items] }
    : { kind: 'deny' }
}

export function makeFakePorts(overrides: Partial<RemoteHandlerDeps> = {}): P8T3FakePorts {
  const calls: string[] = []
  const admissionRequests: RemoteAdmissionRequest[] = []

  const catalog: RemoteCatalogPort = {
    list() {
      calls.push('catalog.list')
      return P8T3_BLUEPRINTS
    },
    get(blueprintId, blueprintRevision) {
      calls.push('catalog.get')
      return {
        ...P8T3_BLUEPRINT,
        blueprintId,
        ...(blueprintRevision !== undefined ? { revision: blueprintRevision } : {}),
      }
    },
  }

  const intent: RemoteIntentPort = {
    probe(blueprintId, blueprintRevision, environmentFacts) {
      calls.push('intent.probe')
      return {
        ...P8T3_COMPATIBILITY,
        blueprintId,
        ...(blueprintRevision !== undefined ? { blueprintRevision } : {}),
        environmentFactCount: environmentFacts.length,
      }
    },
  }

  const teamCreate: RemoteTeamCreatePort = {
    create(rootSessionId, blueprintId, blueprintRevision) {
      calls.push('team.create')
      return {
        path: 'fresh-root',
        durable: { rootSessionId, blueprintId },
        bind: {
          rootSessionId,
          blueprintId,
          ...(blueprintRevision !== undefined ? { blueprintRevision } : {}),
        },
      }
    },
  }

  const projection: RemoteProjectionPort = {
    project(teamSessionId) {
      calls.push('team.getProjection')
      return { ...P8T3_PROJECTION, teamSessionId }
    },
  }

  const ledger: RemoteLedgerPort = {
    listEntries(teamSessionId) {
      calls.push('team.getLedgerPage.list')
      void teamSessionId
      return P8T3_LEDGER_ENTRIES
    },
    countEntries(teamSessionId) {
      calls.push('team.getLedgerPage.count')
      void teamSessionId
      return P8T3_LEDGER_ENTRIES.length
    },
  }

  const admission: RemoteAdmissionPort = {
    performAction(request) {
      calls.push(`member.admission:${request.action}`)
      admissionRequests.push(request)
      return P8T3_ADMISSION_OUTCOME
    },
  }

  const lifecycle: RemoteLifecyclePort = {
    archive(teamSessionId, instanceId) {
      calls.push('member.archive')
      return { ...P8T3_MEMBER_ARCHIVE_RESULT, member: { teamSessionId, instanceId } }
    },
    restore(teamSessionId, instanceId) {
      calls.push('member.restore')
      return { ...P8T3_MEMBER_RESTORE_RESULT, member: { teamSessionId, instanceId } }
    },
    dispose(teamSessionId, instanceId) {
      calls.push('member.dispose')
      return { ...P8T3_MEMBER_DISPOSE_RESULT, member: { teamSessionId, instanceId } }
    },
  }

  const override: RemoteOverridePort = {
    get(teamSessionId, capability, scope, targetInstanceId) {
      calls.push('override.get')
      return {
        ...P8T3_OVERRIDE_RECORD,
        teamSessionId,
        capability,
        ...(scope !== undefined ? { scope } : {}),
        ...(targetInstanceId !== undefined ? { targetInstanceId } : {}),
      }
    },
    set(request) {
      calls.push('override.set')
      return { ...P8T3_OVERRIDE_RECORD, value: p8t3SafePolicyEntry(request.value), actor: { ...request.actor } }
    },
    reset(request) {
      calls.push('override.reset')
      void request
      return { removed: true }
    },
  }

  const policyState: RemotePolicyStatePort = {
    read(teamSessionId) {
      calls.push('policyState.get')
      return { ...P8T3_POLICY_STATE_VIEW, teamSessionId }
    },
    switchState(request) {
      calls.push('policyState.set')
      return {
        ...P8T3_POLICY_STATE_TRANSITION,
        toStateId: request.target.stateId,
        actor: request.actor,
      }
    },
  }

  const compatibility: RemoteCompatibilityPort = {
    current(teamSessionId) {
      calls.push('compatibility.get')
      return { ...P8T3_COMPATIBILITY, teamSessionId }
    },
    acknowledge(teamSessionId, requirementId, acknowledgedBy, note) {
      calls.push('compatibility.ack')
      return {
        ...P8T3_COMPATIBILITY,
        teamSessionId,
        status: 'DEGRADED_ACKNOWLEDGED',
        acknowledged: [
          {
            requirementId,
            acknowledgedBy,
            ...(note !== undefined ? { note } : {}),
          },
        ],
      }
    },
    probe(teamSessionId, trigger) {
      calls.push('compatibility.reprobe')
      return {
        verdict: { ...P8T3_COMPATIBILITY, teamSessionId },
        trigger,
      }
    },
  }

  const handoff: RemoteHandoffPort = {
    prepareSource(sourceSessionId) {
      calls.push('handoff.prepare')
      return { ...P8T3_HANDOFF_SUMMARY, sourceSessionId }
    },
    start(sourceSessionId, requestToken, staged) {
      calls.push('handoff.create')
      return {
        ...P8T3_HANDOFF_STATE,
        sourceSessionId,
        requestToken,
        ...(staged !== undefined ? { staged } : {}),
      }
    },
  }

  const legacy: RemoteLegacyPort = {
    inspect(dshHome, workspaceCwd, projectDir) {
      calls.push('legacy.inspect')
      return {
        ...P8T3_LEGACY_INSPECTION,
        dshHome,
        ...(workspaceCwd !== undefined ? { workspaceCwd } : {}),
        ...(projectDir !== undefined ? { projectDir } : {}),
      }
    },
  }

  const ports: P8T3FakePorts = {
    catalog,
    intent,
    teamCreate,
    projection,
    ledger,
    admission,
    lifecycle,
    override,
    policyState,
    compatibility,
    handoff,
    legacy,
    calls,
    admissionRequests,
  }
  return {
    ...ports,
    ...overrides,
    calls,
    admissionRequests,
  }
}

// --- dispatcher + envelope helpers -------------------------------------------

/** A dispatcher wired to a fresh fake port set (plus optional overrides). */
export interface P8T3Dispatcher {
  readonly dispatch: RemoteDispatcher
  readonly ports: P8T3FakePorts
}

/** Create the real dispatcher over the fake ports. */
export function makeDispatcher(overrides: Partial<RemoteHandlerDeps> = {}): P8T3Dispatcher {
  const ports = makeFakePorts(overrides)
  return { dispatch: createRemoteDispatcher(ports), ports }
}

/** One wire request envelope of contract v1. */
export function p8t3Wire(params: Record<string, unknown>): Record<string, unknown> {
  return { version: REMOTE_CONTRACT_VERSION, params }
}

/** Assert a success result and return it (narrows the union). */
export function expectSuccess(response: RemoteResponse): RemoteSuccessResult {
  expect(response.ok).toBe(true)
  if (!response.ok) throw new Error('expected a success result')
  return response
}

/** Assert an error result and return it (narrows the union). */
export function expectError(response: RemoteResponse): RemoteErrorResult {
  expect(response.ok).toBe(false)
  if (response.ok) throw new Error('expected an error result')
  return response
}
