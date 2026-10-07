/**
 * The `intervention` category handler (A4-PR6 §6.B, contract v8).
 *
 * The generic dispatcher's mirror of the runtime production lane: three
 * read/verb methods of the intervention plane plus the
 * `override.getPermissionAdministration` strip. The handler
 *
 * - validates every port value against the CLOSED wire shape (the same
 *   defense the v6 read-state lane runs: a projection regression must
 *   surface as a typed `internal-error` (`port-contract`), never as a
 *   malformed wire object the client half-renders);
 * - projects the administration read DOWN to the closed field set —
 *   the server-side STRIP is this handler's law, not the caller's
 *   politeness: whatever extra cells the backing record carries
 *   (grants, ceilings, ranks, reviewer identities, open request ids) are
 *   dropped HERE, so a round-trippable authority field cannot reach a
 *   client even if the port regresses;
 * - adds nothing: the act response is a closed receipt (the next list/get
 *   re-derives state), and legal actions exist only on items, computed
 *   server-side by the runtime lane (spec §17.3).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/intervention
 */

import { remoteContractError } from '../contracts/errors.js'
import {
  REMOTE_INTERVENTION_ACT_OUTCOMES,
  REMOTE_INTERVENTION_AUTHORITY_POSITIONS,
  REMOTE_INTERVENTION_ITEM_FIELDS,
  REMOTE_INTERVENTION_SOURCE_FIELDS,
  REMOTE_PERMISSION_ADMINISTRATION_FIELDS,
} from '../contracts/types.js'
import type { RemoteSafeRecord } from '../contracts/remote-safe.js'
import type {
  RemoteInterventionActParams,
  RemoteInterventionGetParams,
  RemoteInterventionListParams,
  RemoteMethodParams,
  RemoteOverrideGetPermissionAdministrationParams,
} from '../contracts/params.js'
import type { RemoteInterventionPort } from './ports.js'

function portContract(field: string, problem: string): Error {
  return remoteContractError(
    'internal-error',
    `remote backing port returned a malformed value at '${field}': ${problem}`,
    { field, reason: 'port-contract' },
  )
}

function asRecord(value: unknown, field: string): RemoteSafeRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw portContract(field, 'expected an object')
  }
  return value as RemoteSafeRecord
}

function requiredString(item: Record<string, unknown>, field: string, label: string): string {
  const value = item[field]
  if (typeof value !== 'string' || value.length === 0) {
    throw portContract(label, `'${field}' must be a non-empty string`)
  }
  return value
}

/**
 * Validate one item against the closed wire shape; return it unchanged.
 *
 * A4-PR6 §6.B: EXPORTED so the production s6 dispatcher validates through
 * the SAME law the generic dispatcher runs — the closed-shape check must not
 * have two copies that can drift (the s6 lane imports this module by path).
 */
export function validateItem(raw: unknown, label: string): RemoteSafeRecord {
  const item = asRecord(raw, label)
  for (const key of Object.keys(item)) {
    if (!(REMOTE_INTERVENTION_ITEM_FIELDS as readonly string[]).includes(key)) {
      throw portContract(label, `unknown item field '${key}'`)
    }
  }
  requiredString(item, 'interventionId', label)
  const kind = requiredString(item, 'kind', label)
  if (!['approval', 'warning', 'error'].includes(kind)) {
    throw portContract(label, `unknown kind '${kind}'`)
  }
  const responseBehavior = requiredString(item, 'responseBehavior', label)
  if (!['informational', 'wait-for-response'].includes(responseBehavior)) {
    throw portContract(label, `unknown responseBehavior '${responseBehavior}'`)
  }
  if (!('blockScope' in item)) {
    throw portContract(label, 'blockScope must be present (null when nothing is held)')
  }
  if (item['blockScope'] !== null) asRecord(item['blockScope'], `${label}.blockScope`)
  const source = asRecord(item['source'], `${label}.source`)
  for (const key of Object.keys(source)) {
    if (!(REMOTE_INTERVENTION_SOURCE_FIELDS as readonly string[]).includes(key)) {
      throw portContract(`${label}.source`, `unknown field '${key}'`)
    }
  }
  requiredString(source, 'kind', `${label}.source`)
  requiredString(source, 'id', `${label}.source`)
  const status = requiredString(item, 'status', label)
  if (
    !['open', 'acknowledged', 'resolved', 'authority-unavailable', 'stale'].includes(status)
  ) {
    throw portContract(label, `unknown status '${status}'`)
  }
  for (const cell of ['requiredAuthority', 'currentReviewAuthority'] as const) {
    const value = item[cell]
    if (value !== undefined && !REMOTE_INTERVENTION_AUTHORITY_POSITIONS.includes(String(value))) {
      throw portContract(label, `'${cell}' must be a closed authority position`)
    }
  }
  const legalActions = item['legalActions']
  if (!Array.isArray(legalActions) || legalActions.some((a) => typeof a !== 'string')) {
    throw portContract(label, 'legalActions must be an array of strings')
  }
  // The wire NEVER carries a legality the planes do not know: every legal
  // action cell is inside the union of the plane vocabularies (a fourth
  // global action would be a contract violation even from our own port).
  for (const action of legalActions as readonly string[]) {
    if (!['allow', 'deny', 'escalate', 'acknowledge'].includes(action)) {
      throw portContract(label, `legalActions carries the unknown action '${action}'`)
    }
  }
  if (!Array.isArray(item['derivationReasons'])) {
    throw portContract(label, 'derivationReasons must be an array')
  }
  requiredString(item, 'createdAt', label)
  return item
}

/**
 * THE STRIP + closed-cell validation for the administration read (see the
 * module header). Exported for the same single-law reason as
 * {@link validateItem}: the production lane strips through this function.
 */
export function validateAdministration(raw: unknown, label: string): RemoteSafeRecord {
  const rich = asRecord(raw, label)
  // THE STRIP: pick exactly the closed fields; drop everything else —
  // authority-bearing and round-trippable decision cells included. The
  // closed-cell checks then run on what SURVIVES (a port that omitted a
  // required cell is a port-contract violation; one that ADDED a cell is
  // silently, deliberately, stripped).
  const administration: Record<string, unknown> = {}
  for (const field of REMOTE_PERMISSION_ADMINISTRATION_FIELDS) {
    if (field in rich) administration[field] = rich[field]
  }
  for (const field of REMOTE_PERMISSION_ADMINISTRATION_FIELDS) {
    if (!(field in administration)) {
      throw portContract(label, `missing closed field '${field}'`)
    }
  }
  requiredString(administration, 'teamSessionId', label)
  const memberInstanceId = administration['memberInstanceId']
  if (memberInstanceId !== null && typeof memberInstanceId !== 'string') {
    throw portContract(label, 'memberInstanceId must be a string or null')
  }
  const generation = administration['generation']
  if (generation !== null && (typeof generation !== 'number' || !Number.isSafeInteger(generation))) {
    throw portContract(label, 'generation must be a safe integer or null')
  }
  const source = administration['source']
  if (source !== 'overlay' && source !== 'blueprint-default') {
    throw portContract(label, "source must be 'overlay' or 'blueprint-default'")
  }
  asRecord(administration['effective'], `${label}.effective`)
  if (!Array.isArray(administration['diagnostics'])) {
    throw portContract(label, 'diagnostics must be an array')
  }
  return administration as unknown as RemoteSafeRecord
}

/** The intervention category handler (v8: `intervention.list|get|act`). */
export function createRemoteInterventionHandler(deps: RemoteInterventionPort) {
  return (method: string, params: RemoteMethodParams) => {
    switch (method) {
      case 'intervention.list': {
        const listParams = params as RemoteInterventionListParams
        const { items } = deps.list({ teamSessionId: listParams.teamSessionId })
        return {
          data: { items: items.map((item, index) => validateItem(item, `items[${index}]`)) },
        }
      }
      case 'intervention.get': {
        const getParams = params as RemoteInterventionGetParams
        const { item } = deps.get({
          teamSessionId: getParams.teamSessionId,
          interventionId: getParams.interventionId,
        })
        return { data: { item: validateItem(item, 'item') } }
      }
      case 'intervention.act': {
        const actParams = params as RemoteInterventionActParams
        const { outcome } = deps.act({
          teamSessionId: actParams.teamSessionId,
          interventionId: actParams.interventionId,
          action: actParams.action,
          ...(actParams.note !== undefined ? { note: actParams.note } : {}),
        })
        if (!REMOTE_INTERVENTION_ACT_OUTCOMES.includes(outcome)) {
          throw portContract('outcome', `unknown act outcome '${outcome}'`)
        }
        // The receipt carries the outcome and NOTHING else.
        return { data: { outcome } }
      }
      default:
        throw new Error(`intervention handler routed an unknown method: ${method}`)
    }
  }
}

/**
 * The `override.getPermissionAdministration` lane: the read lives in the
 * OVERRIDE category (it reads the override plane's documents) but its
 * PORT lives on the intervention seam (one governance read/verb seam for
 * the whole v8 surface). The STRIP is enforced by the shared
 * `validateAdministration` below.
 */
export function permissionAdministrationVia(
  deps: RemoteInterventionPort | undefined,
  params: RemoteMethodParams,
): { readonly data: { administration: RemoteSafeRecord } } {
  if (deps === undefined) {
    throw remoteContractError(
      'internal-error',
      'override.getPermissionAdministration: the v8 governance read seam is unwired on this surface — zero read',
      { reason: 'port-unwired' },
    )
  }
  const readParams = params as RemoteOverrideGetPermissionAdministrationParams
  const { administration } = deps.permissionAdministration({
    teamSessionId: readParams.teamSessionId,
    ...(readParams.memberInstanceId !== undefined
      ? { memberInstanceId: readParams.memberInstanceId }
      : {}),
  })
  return { data: { administration: validateAdministration(administration, 'administration') } }
}
