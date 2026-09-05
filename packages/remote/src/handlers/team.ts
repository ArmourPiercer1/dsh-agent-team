/**
 * The `team` category handler (design note §3): TeamSession creation,
 * whole-projection observation, and ledger pages. Backed by five ports:
 * {@link RemoteTeamCreatePort} (root binding, P5-T5),
 * {@link RemoteTeamCreateV2Port} (the v2 workspace-aware creation
 * variant, TCM vNext §15.6), {@link RemoteTeamAdmitInitialWorkPort}
 * (the v2-only creation-time initial work command, TCM vNext §15.6),
 * {@link RemoteProjectionPort} (ProjectionService, P8-T2), and
 * {@link RemoteLedgerPort} (storage ledger behind a slicing adapter,
 * D-5).
 *
 * The projection is validated at the TOP LEVEL only (D-4): the nine frozen
 * `TeamProjectionDto` fields must be present with the right structural
 * kinds; the nested values pass through. The whole-projection `generation`
 * rides in the reply's provenance (G8 staleness detection).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/team
 */

import { remoteContractError, type RemoteContractError } from '../contracts/errors.js'
import type {
  RemoteLosslessRecord,
  RemoteTeamAdmitInitialWorkParams,
  RemoteTeamCreateParams,
  RemoteTeamCreateParamsV2,
  RemoteTeamGetLedgerPageParams,
  RemoteTeamGetProjectionParams,
  RemoteMethodParams,
} from '../contracts/params.js'
import {
  REMOTE_LEDGER_ENTRY_FIELDS,
  REMOTE_PROJECTION_FIELDS,
  type RemoteLedgerEntryValue,
} from '../contracts/types.js'
import type { RemoteSafeRecord } from '../contracts/remote-safe.js'
import type {
  RemoteHandlerOutcome,
  RemoteLedgerPort,
  RemoteProjectionPort,
  RemoteTeamAdmitInitialWorkPort,
  RemoteTeamCreatePort,
  RemoteTeamCreateV2Port,
} from './ports.js'

/** The ports the team category needs (v1 trio + the two v2 ports). */
export interface RemoteTeamHandlerPorts {
  readonly teamCreate: RemoteTeamCreatePort
  /** TCM vNext §15.6: the v2 workspace-aware creation variant. */
  readonly teamCreateV2: RemoteTeamCreateV2Port
  /** TCM vNext §15.6: the v2-only creation-time initial work command. */
  readonly teamAdmitInitialWork: RemoteTeamAdmitInitialWorkPort
  readonly projection: RemoteProjectionPort
  readonly ledger: RemoteLedgerPort
}

/**
 * The `team.create` port as this handler consumes it (BC-03 / R1-A): the
 * frozen {@link RemoteTeamCreatePort} plus the optional `initialWork`
 * parameter. A frozen 3-argument implementation is assignable here (the
 * extra argument is ignored by arity), so pre-existing fakes keep
 * byte-identical behavior; the production runtime (s6-remote) declares the
 * fourth parameter and admits the work through the existing
 * work-admission path.
 */
interface TeamCreatePortWithInitialWork {
  create(
    rootSessionId: string,
    blueprintId: string,
    blueprintRevision: number | undefined,
    initialWork: RemoteLosslessRecord | undefined,
  ): RemoteSafeRecord
}

/** Is `value` a plain (non-array) object? */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

/** A port returned a structurally wrong value: a boundary failure. */
function portContractError(field: string, problem: string): RemoteContractError {
  return remoteContractError(
    'internal-error',
    `remote backing port returned a malformed value at '${field}': ${problem}`,
    { field, reason: 'port-contract' },
  )
}

/** Normalize one projection to the closed top-level shape (D-4). */
function normalizeProjection(raw: unknown): RemoteMethodProjection {
  if (!isPlainRecord(raw)) {
    throw portContractError('projection', `expected an object, got ${String(raw)}`)
  }
  for (const field of REMOTE_PROJECTION_FIELDS) {
    if (!(field in raw)) {
      throw portContractError(`projection.${field}`, 'missing field')
    }
  }
  const schemaVersion = raw['schemaVersion']
  const generation = raw['generation']
  if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion)) {
    throw portContractError('projection.schemaVersion', 'must be a safe integer')
  }
  if (typeof generation !== 'number' || !Number.isSafeInteger(generation) || generation < 1) {
    throw portContractError('projection.generation', 'must be a safe integer >= 1')
  }
  return raw as unknown as RemoteMethodProjection
}

/** The team.getProjection port value (nine top-level fields, D-4). */
interface RemoteMethodProjection {
  readonly schemaVersion: number
  readonly generation: number
  readonly [field: string]: unknown
}

/** Normalize one ledger entry to the closed wire shape. */
function normalizeLedgerEntry(raw: unknown): RemoteLedgerEntryValue {
  if (!isPlainRecord(raw)) {
    throw portContractError('ledger entry', `expected an object, got ${String(raw)}`)
  }
  for (const field of REMOTE_LEDGER_ENTRY_FIELDS) {
    if (field === 'operationId') continue // optional on the storage row
    if (!(field in raw)) {
      throw portContractError(`ledger entry.${field}`, 'missing field')
    }
  }
  const schemaVersion = raw['schemaVersion']
  if (typeof schemaVersion !== 'number' || !Number.isSafeInteger(schemaVersion)) {
    throw portContractError('ledger entry.schemaVersion', 'must be a safe integer')
  }
  const sequence = raw['sequence']
  if (typeof sequence !== 'number' || !Number.isSafeInteger(sequence) || sequence < 1) {
    throw portContractError('ledger entry.sequence', 'must be a safe integer >= 1')
  }
  const rootSessionId = raw['rootSessionId']
  if (typeof rootSessionId !== 'string' || rootSessionId.length === 0) {
    throw portContractError('ledger entry.rootSessionId', 'must be a non-empty string')
  }
  const factType = raw['factType']
  if (typeof factType !== 'string' || factType.length === 0) {
    throw portContractError('ledger entry.factType', 'must be a non-empty string')
  }
  const payload = raw['payload']
  if (!isPlainRecord(payload)) {
    throw portContractError('ledger entry.payload', 'must be an object')
  }
  const createdAt = raw['createdAt']
  if (typeof createdAt !== 'string' || createdAt.length === 0) {
    throw portContractError('ledger entry.createdAt', 'must be a non-empty string')
  }
  const operationId = raw['operationId']
  if (operationId !== undefined && typeof operationId !== 'string') {
    throw portContractError('ledger entry.operationId', 'must be a string when present')
  }
  return {
    schemaVersion,
    sequence,
    rootSessionId,
    factType,
    // The port contract guarantees a lossless-JSON-safe record; the plain
    // record check above is the structural half of that guarantee.
    payload: payload as unknown as RemoteSafeRecord,
    operationId: operationId === undefined ? null : operationId,
    createdAt,
  }
}

/**
 * Validate a `team.create` port return value (v1 and v2 share the exact
 * wire shape: `{ path: 'fresh-root' | 'cold-root', durable, bind }`).
 */
function normalizeTeamCreateValue(portName: string, created: unknown): RemoteHandlerOutcome {
  if (!isPlainRecord(created)) {
    throw portContractError(portName, `expected an object, got ${String(created)}`)
  }
  const path = created['path']
  if (path !== 'fresh-root' && path !== 'cold-root') {
    throw portContractError(
      `${portName}.path`,
      `must be 'fresh-root' or 'cold-root', got ${String(path)}`,
    )
  }
  const durable = created['durable']
  if (
    durable !== undefined &&
    durable !== null &&
    (typeof durable !== 'object' || Array.isArray(durable))
  ) {
    throw portContractError(`${portName}.durable`, 'must be an object or null')
  }
  const bind = created['bind']
  if (!isPlainRecord(bind)) {
    throw portContractError(`${portName}.bind`, 'must be an object')
  }
  return {
    data: {
      path,
      durable: durable === undefined ? null : durable,
      bind,
    },
  }
}

/**
 * The team category handler (`team.create` [v1 + v2],
 * `team.admitInitialWork` [v2-only], `team.getProjection`,
 * `team.getLedgerPage`).
 *
 * Version-aware (TCM vNext §15.3): the dispatcher passes the request's
 * contract version; `team.create` routes to the v1 port (closed v1 field
 * set, `initialWork` allowed) or the v2 port (closed v2 field set,
 * `workspace` allowed, CREATE-ONLY) — the version-specific parsed param
 * object is already the matching typed shape.
 */
export function createRemoteTeamHandler(ports: RemoteTeamHandlerPorts) {
  return (method: string, params: RemoteMethodParams, version: number) => {
    switch (method) {
      case 'team.create': {
        if (version === 2) {
          const createParams = params as RemoteTeamCreateParamsV2
          const created = ports.teamCreateV2.create(
            createParams.rootSessionId,
            createParams.blueprintId,
            createParams.blueprintRevision,
            createParams.workspace,
          )
          return normalizeTeamCreateValue('teamCreateV2', created)
        }
        const createParams = params as RemoteTeamCreateParams
        const teamCreate: TeamCreatePortWithInitialWork = ports.teamCreate
        const created = teamCreate.create(
          createParams.rootSessionId,
          createParams.blueprintId,
          createParams.blueprintRevision,
          createParams.initialWork,
        )
        return normalizeTeamCreateValue('teamCreate', created)
      }
      case 'team.admitInitialWork': {
        // v2-only: the version-aware param parser guarantees the request
        // version is 2 (a v1 request is typed-rejected before dispatch).
        const admitParams = params as RemoteTeamAdmitInitialWorkParams
        const admitted = ports.teamAdmitInitialWork.admit(
          admitParams.rootSessionId,
          admitParams.requestToken,
          admitParams.prompt,
          admitParams.attachedContext,
        )
        if (!isPlainRecord(admitted)) {
          throw portContractError(
            'teamAdmitInitialWork',
            `expected an object, got ${String(admitted)}`,
          )
        }
        return { data: admitted }
      }
      case 'team.getProjection': {
        const projectionParams = params as RemoteTeamGetProjectionParams
        const raw = ports.projection.project(projectionParams.teamSessionId)
        const projection = normalizeProjection(raw)
        return {
          data: { projection },
          projectionGeneration: projection.generation,
        }
      }
      case 'team.getLedgerPage': {
        const pageParams = params as RemoteTeamGetLedgerPageParams
        const allEntries = ports.ledger.listEntries(pageParams.teamSessionId)
        const entriesAfter: RemoteLedgerEntryValue[] = []
        for (const rawEntry of allEntries) {
          const entry = normalizeLedgerEntry(rawEntry)
          if (entry.sequence > pageParams.afterSequence) entriesAfter.push(entry)
        }
        const page = entriesAfter.slice(0, pageParams.limit)
        let nextAfterSequence: number | null = null
        if (entriesAfter.length > pageParams.limit) {
          const last = page[page.length - 1]
          if (last === undefined) {
            throw portContractError('ledger page', 'internal slicing error')
          }
          nextAfterSequence = last.sequence
        }
        return {
          data: {
            entries: page,
            nextAfterSequence,
            total: ports.ledger.countEntries(pageParams.teamSessionId),
          },
        }
      }
      default:
        throw new Error(`team handler routed an unknown method: ${method}`)
    }
  }
}
