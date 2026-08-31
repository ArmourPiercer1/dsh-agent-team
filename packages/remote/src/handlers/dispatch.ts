/**
 * The throw-proof dispatcher of the Remote contract v1 (design note §6).
 *
 * The dispatcher is the single entry point the seam invokes per request:
 * `(endpoint, payload) => Promise<RemoteResponse>`. It enforces the seven
 * dispatcher invariants (design note §6, all unit-tested):
 *
 * 1. unknown endpoint → `unknown-method` error result (never a throw) —
 *    checked BEFORE the envelope, so an unknown endpoint always reports
 *    `unknown-method` even with a garbage payload;
 * 2. envelope parse failure → `malformed-request` /
 *    `contract-version-unsupported`;
 * 3. param validation failure → `malformed-params` (with `field` in
 *    details) or the mirrored frozen P3 ID codes (deviation D-1/D-3);
 * 4. typed domain error (own string `code`) → pass-through code + message,
 *    source identity under `details.cause` (never the raw exception);
 * 5. untyped throw from a port → `internal-error`, generic message, no
 *    leak;
 * 6. the success value passes a lossless-JSON check before the reply is
 *    built (otherwise `internal-error`);
 * 7. the returned promise never rejects — the outermost try/catch turns
 *    every failure path into an error result, so the seam never sees a
 *    handler throw (the P2-T6 500 class, designed out).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/dispatch
 */

import {
  REMOTE_CATEGORIES,
  isRemoteMethod,
  remoteCategoryOf,
  type RemoteCategory,
} from '../contracts/catalog.js'
import {
  REMOTE_CONTRACT_ERROR_CODES,
  isRemoteContractError,
  remoteContractError,
} from '../contracts/errors.js'
import { parseRemoteMethodParams, type RemoteMethodParams } from '../contracts/params.js'
import { parseRemoteRequest } from '../contracts/request.js'
import {
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteErrorResult,
  type RemoteProvenanceContext,
  type RemoteResponse,
} from '../contracts/response.js'
import { REMOTE_CONTRACT_VERSION } from '../contracts/version.js'
import { createRemoteCatalogHandler } from './catalog.js'
import { createRemoteCompatibilityHandler } from './compatibility.js'
import { createRemoteHandoffHandler } from './handoff.js'
import { createRemoteIntentHandler } from './intent.js'
import { createRemoteLegacyHandler } from './legacy.js'
import { createRemoteMemberHandler } from './member.js'
import { createRemoteOverrideHandler } from './override.js'
import { createRemotePolicyStateHandler } from './policy-state.js'
import { createRemoteTeamHandler } from './team.js'
import type { RemoteHandlerDeps, RemoteHandlerOutcome } from './ports.js'

/** One request of the public seam: endpoint + raw payload. */
export type RemoteDispatcher = (endpoint: string, payload: unknown) => Promise<RemoteResponse>

/** One category handler as wired by the dispatcher. */
type CategoryHandler = (method: string, params: RemoteMethodParams) => RemoteHandlerOutcome

/** Wire the twelve ports into the nine category handlers. */
function buildCategoryHandlers(deps: RemoteHandlerDeps): Readonly<Record<RemoteCategory, CategoryHandler>> {
  return {
    [REMOTE_CATEGORIES.CATALOG]: createRemoteCatalogHandler(deps.catalog),
    [REMOTE_CATEGORIES.INTENT]: createRemoteIntentHandler(deps.intent),
    [REMOTE_CATEGORIES.TEAM]: createRemoteTeamHandler({
      teamCreate: deps.teamCreate,
      projection: deps.projection,
      ledger: deps.ledger,
    }),
    [REMOTE_CATEGORIES.MEMBER]: createRemoteMemberHandler({
      admission: deps.admission,
      lifecycle: deps.lifecycle,
    }),
    [REMOTE_CATEGORIES.OVERRIDE]: createRemoteOverrideHandler(deps.override),
    [REMOTE_CATEGORIES.POLICY_STATE]: createRemotePolicyStateHandler(deps.policyState),
    [REMOTE_CATEGORIES.COMPATIBILITY]: createRemoteCompatibilityHandler(deps.compatibility),
    [REMOTE_CATEGORIES.HANDOFF]: createRemoteHandoffHandler(deps.handoff),
    [REMOTE_CATEGORIES.LEGACY]: createRemoteLegacyHandler(deps.legacy),
  }
}

/**
 * Map any failure value to a typed error result (invariants 4/5).
 * @param error - the thrown value (boundary error, typed domain error, or
 *   anything else).
 * @param ctx - the per-request provenance context (method/endpoint/version/
 *   token echo as far as parsing got).
 */
function toRemoteErrorResult(error: unknown, ctx: RemoteProvenanceContext): RemoteErrorResult {
  // Invariant 4a: the remote layer's own typed errors keep their code —
  // boundary codes and the mirrored frozen P3 ID codes (deviations D-1/D-3).
  if (isRemoteContractError(error)) {
    const details = error.details
    const field =
      details !== undefined && typeof details['field'] === 'string' ? details['field'] : undefined
    const reason =
      details !== undefined && typeof details['reason'] === 'string'
        ? details['reason']
        : undefined
    return buildRemoteError(error.code, error.message, ctx, { field, reason })
  }
  // Invariant 4b: a backing-service typed error (own non-empty string
  // `code`) passes through unchanged in code + message; the source
  // identity rides under details.cause (never its stack, never a live
  // object — lossless-checked under cause.details).
  if (error instanceof Error) {
    const typed = error as Error & { readonly code?: unknown; readonly details?: unknown }
    if (typeof typed.code === 'string' && typed.code.length > 0) {
      return buildRemoteError(typed.code, typed.message, ctx, {
        reason: 'domain-error',
        cause: { code: typed.code, message: typed.message },
        sourceDetails: typed.details,
      })
    }
  }
  // Invariant 5: an untyped throw — generic message, no leak.
  return buildRemoteError(
    REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR,
    'internal error in remote handler',
    ctx,
    { reason: 'untyped-error' },
  )
}

/**
 * Create the throw-proof dispatcher for one deps object.
 * @param deps - the twelve backing ports (injected; no global state).
 * @returns the seam entry point: `(endpoint, payload) => Promise<RemoteResponse>`.
 */
export function createRemoteDispatcher(deps: RemoteHandlerDeps): RemoteDispatcher {
  const handlers = buildCategoryHandlers(deps)
  return (endpoint: string, payload: unknown): Promise<RemoteResponse> => {
    let ctx: RemoteProvenanceContext = {
      method: endpoint,
      endpoint,
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
    }
    let response: RemoteResponse
    try {
      // Invariant 1: unknown endpoint (checked before the envelope).
      if (!isRemoteMethod(endpoint)) {
        throw remoteContractError(
          REMOTE_CONTRACT_ERROR_CODES.UNKNOWN_METHOD,
          `endpoint '${endpoint}' is not a method of the closed Remote contract v1 catalog`,
          { reason: 'unknown-endpoint' },
        )
      }
      // Invariant 2: the request envelope (closed: version + params).
      const request = parseRemoteRequest(payload)
      ctx = { ...ctx, contractVersion: request.version }
      // Invariant 3: the method's closed param schema.
      const parsed = parseRemoteMethodParams(endpoint, request.params)
      ctx = { ...ctx, requestToken: parsed.requestToken }
      // Invariants 4/5: the category handler (the backing port call).
      const outcome = handlers[remoteCategoryOf(endpoint)](endpoint, parsed.params)
      // Invariant 6: lossless check + provenance on the success value.
      response = buildRemoteSuccess(outcome.data, {
        ...ctx,
        projectionGeneration: outcome.projectionGeneration ?? null,
        effectSequence: outcome.effectSequence ?? null,
      })
    } catch (error) {
      response = toRemoteErrorResult(error, ctx)
    }
    // Invariant 7: the promise never rejects.
    return Promise.resolve(response)
  }
}
