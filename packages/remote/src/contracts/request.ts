/**
 * The Remote contract v1 request envelope.
 *
 * Every request the client sends through the seam (`POST
 * /<channel>/<endpoint>`, body `{ type: 'client-request', rpcId, method,
 * payload }` — P2-T6 characterization) carries, in `payload`, exactly:
 *
 * ```
 * { "version": <positive integer in SUPPORTED_REMOTE_CONTRACT_VERSIONS>,
 *   "params":  { ...the method's closed param object... } }
 * ```
 *
 * The envelope is CLOSED: unknown top-level fields are rejected
 * (`malformed-request`). Per-method `params` validation lives in
 * `params.ts` (each method has its own closed field set).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment assumptions.
 * @module @dsh-agent-team/remote/contracts/request
 */

import { remoteContractError } from './errors.js'
import { assertRemoteSafeJsonValue, type RemoteSafeRecord } from './remote-safe.js'
import { parseRemoteContractVersion } from './version.js'

/** The closed top-level fields of a remote request envelope. */
export const REMOTE_REQUEST_FIELDS = ['params', 'version'] as const

/** A parsed remote request envelope (version + closed params object). */
export interface RemoteRequest {
  /** The remote contract version the client declared (supported). */
  readonly version: number
  /** The method's param object (per-method validation is separate). */
  readonly params: RemoteSafeRecord
}

/** Is `value` a plain (non-array) object? */
function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const proto = Object.getPrototypeOf(value)
  return proto === null || proto === Object.prototype
}

/**
 * Parse the `payload` of one remote request into the typed envelope.
 * @param payload - the raw seam payload (the client's `payload` field).
 * @returns the parsed envelope (lossless-JSON-safe by construction).
 * @throws {RemoteContractError} `malformed-request` when the payload is not
 *   a lossless-JSON-safe closed record, when `version` is missing or not a
 *   positive integer, when `params` is missing or not an object, or when an
 *   unknown top-level field is present; `contract-version-unsupported` when
 *   `version` is a positive integer outside the supported set.
 */
export function parseRemoteRequest(payload: unknown): RemoteRequest {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    throw remoteContractError(
      'malformed-request',
      `request payload must be an object, got ${payload === null ? 'null' : typeof payload}`,
    )
  }
  assertRemoteSafeJsonValue(payload, '$')
  const record = payload as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (key !== 'version' && key !== 'params') {
      throw remoteContractError(
        'malformed-request',
        `request envelope has unknown field '${key}' (closed fields: ${REMOTE_REQUEST_FIELDS.join(', ')})`,
        { field: key },
      )
    }
  }
  if (!('version' in record)) {
    throw remoteContractError(
      'malformed-request',
      "request envelope is missing required field 'version'",
      { field: 'version' },
    )
  }
  const version = parseRemoteContractVersion(record['version'])
  if (!('params' in record)) {
    throw remoteContractError(
      'malformed-request',
      "request envelope is missing required field 'params'",
      { field: 'params' },
    )
  }
  const params = record['params']
  if (!isPlainRecord(params)) {
    throw remoteContractError(
      'malformed-request',
      `request 'params' must be an object, got ${params === null ? 'null' : typeof params}`,
      { field: 'params' },
    )
  }
  const safeParams = assertRemoteSafeJsonValue(params, 'params')
  return { version, params: safeParams as RemoteSafeRecord }
}
