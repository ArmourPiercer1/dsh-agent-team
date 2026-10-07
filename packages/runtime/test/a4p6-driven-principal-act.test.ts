/**
 * a4p6-driven-principal-act.test.ts — A4-PR6 review round 1 (fix 5/6):
 * the caller that reaches the governance planes through `intervention.act`
 * is DRIVEN through the REAL derivation, never a stub standing in for it.
 *
 * The v8 contract lane keeps its wire-typing negative (a
 * `CONTROL_RESOLVER_NOT_AUTHORIZED` typed refusal survives the wire), and
 * the aggregation suite drives the real planes — but both installed a
 * PRINCIPAL STUB (`() => Promise.resolve(humanCaller(...))`), so nothing
 * in the branch ever drove `intervention.act` through the actual
 * `createServerPrincipalDerivation`. A reviewer asking "what does the
 * derivation actually decide here?" found no test that could answer.
 * This file answers it through the production dispatcher:
 *
 * - the caller reaching the warning plane's `acknowledge` is the DERIVED
 *   human operator of the ADDRESSED root — invariant 9: the team's human
 *   identity IS its root session id. No wire field participates (the v8
 *   body is closed and rejects identity claims before derivation runs);
 * - a transport context that stops carrying the connection-gate basis
 *   AFTER installation (a swapped/forged token) is a typed
 *   `TEAM_REMOTE_PRINCIPAL_INVALID` on the derivation path itself —
 *   T12-B4's PER-CALL re-verification, zero plane calls;
 * - a `teamSessionId` this host does not own is `TEAM_REMOTE_FOREIGN_TEAM`
 *   before any plane call;
 * - an identity-smuggling field (`asRole`) is refused by the closed param
 *   set before derivation, before planes;
 * - fix 6/6: a plane receipt whose outcome is outside the closed v8 set
 *   is the `internal-error` / `port-contract` refusal the generic lane
 *   already returns for the same fault — the s6 lane no longer forwards
 *   an unvalidated wire value.
 *
 * Runner: plain-node shim — module-level driving, synchronous `it`
 * assertions.
 *
 * @module @dsh-agent-team/runtime/test/a4p6-driven-principal-act
 */

import { describe, expect, it } from 'vitest'

import { createS6RemoteDispatcher, createS6RemotePorts } from '../src/plugin/s6-remote.js'
import type { S6RemoteOptions } from '../src/plugin/s6-remote.js'
import {
  S6_PRINCIPAL_ERROR_CODES,
  SERVER_PRINCIPAL_TRANSPORTS,
  createServerPrincipalDerivation,
} from '../src/plugin/s6-principal.js'
import type { ServerPrincipalContext } from '../src/plugin/s6-principal.js'
import { REMOTE_CONTRACT_VERSION_V8 } from '../../remote/src/index.js'
import type { RemoteResponse } from '../../remote/src/index.js'

const ROOT = 's'.repeat(24)
const FOREIGN = 'f'.repeat(24)
const WARN_ID = `int-warn-${'0'.repeat(32)}`

function errorOf(response: RemoteResponse): Record<string, unknown> {
  if (response.ok) throw new Error(`expected a typed failure, got ${JSON.stringify(response.value)}`)
  return response.error as unknown as Record<string, unknown>
}

/**
 * The harness: the REAL `createServerPrincipalDerivation` as the
 * dispatcher's principal, over a `governanceWarning` LANE WRAPPER (the
 * wrapper is a recording seam around the real service's call shape, not a
 * stand-in for the derivation — the derivation is what this file drives).
 */
function harness(options: {
  readonly principalContext?: ServerPrincipalContext
  /** What the warning lane ANSWERS the acknowledge (the fix-6 leg answers
   *  an out-of-vocabulary receipt; the default is the legal ack receipt). */
  readonly ackAnswer?: { readonly kind: string; readonly reason?: string }
} = {}) {
  const acks: Record<string, unknown>[] = []
  const warningLane = {
    listWarnings: async () => [],
    acknowledge: async (args: Record<string, unknown>) => {
      acks.push(args)
      return options.ackAnswer ?? { kind: 'acknowledged' }
    },
  }
  const ports = createS6RemotePorts({
    rootSessionId: ROOT,
    repositories: { teamSessions: { get: () => ({}) } } as never,
    governanceWarning: warningLane,
    leaderInstanceId: 'inst-team-leader',
  } as unknown as S6RemoteOptions)
  const principal = createServerPrincipalDerivation({
    rootSessionId: ROOT,
    repositories: { teamSessions: { list: () => [] }, memberInstances: { list: () => [] } } as never,
    leaderInstanceId: 'inst-team-leader',
    ...(options.principalContext === undefined ? {} : { principalContext: options.principalContext }),
  })
  const dispatch = createS6RemoteDispatcher(ports, principal)
  const act = (params: Record<string, unknown>): Promise<RemoteResponse> =>
    dispatch('intervention.act', { version: REMOTE_CONTRACT_VERSION_V8, params } as never)
  return { acks, act }
}

// --- module-level driving (plain-node shim) -------------------------------------------

const ACKNOWLEDGED = await (async () => {
  const h = harness()
  const response = await h.act({
    teamSessionId: ROOT,
    interventionId: WARN_ID,
    action: 'acknowledge',
    note: 'reviewed',
  })
  return { response, acks: h.acks }
})()

const BROKEN_CONTEXT = await (async () => {
  // A context object that PASSES the construction fail-fast and then
  // stops carrying the basis — exactly the swapped/forged-token case the
  // T12-B4 per-call re-verification exists for. (Production's
  // `createServerPrincipalContext` freezes its token; the cast stands in
  // for the transport swapping the installed basis in memory.)
  const forged = {
    transport: SERVER_PRINCIPAL_TRANSPORTS.CONNECTION_GATE,
    operatorClass: 'operator',
  } as ServerPrincipalContext
  const h = harness({ principalContext: forged })
  ;(forged as unknown as { transport: string }).transport = 'forged-transport'
  const response = await h.act({
    teamSessionId: ROOT,
    interventionId: WARN_ID,
    action: 'acknowledge',
  })
  return { response, acks: h.acks }
})()

const FOREIGN_TEAM = await (async () => {
  const h = harness()
  const response = await h.act({
    teamSessionId: FOREIGN,
    interventionId: WARN_ID,
    action: 'acknowledge',
  })
  return { response, acks: h.acks }
})()

const SMUGGLED_ROLE = await (async () => {
  const h = harness()
  const response = await h.act({
    teamSessionId: ROOT,
    interventionId: WARN_ID,
    action: 'acknowledge',
    asRole: 'human-user',
  })
  return { response, acks: h.acks }
})()

const BAD_RECEIPT = await (async () => {
  // A plane answering an OUT-OF-VOCABULARY receipt. The warning-arm port
  // transforms only `not-found` / `not-acknowledgeable` and passes
  // everything else straight through — pre-fix, the s6 handler forwarded
  // `outcome: "approved"` onto the wire, minting a value the v8 contract
  // never closed (the generic lane refuses the same fault). The wrapper
  // is the plane here: nothing durable is written.
  const h = harness({ ackAnswer: { kind: 'approved' } })
  const response = await h.act({
    teamSessionId: ROOT,
    interventionId: WARN_ID,
    action: 'acknowledge',
  })
  return { response, acks: h.acks }
})()

// --- assertions ------------------------------------------------------------------------

describe('A4-PR6 review round 1 (fix 5/6) — the act caller is DRIVEN through the real derivation', () => {
  it('the warning plane receives the DERIVED human operator: invariant-9 channel, the addressed root itself', () => {
    if (!ACKNOWLEDGED.response.ok) throw new Error(JSON.stringify(ACKNOWLEDGED.response.error))
    expect(ACKNOWLEDGED.response.value.data).toEqual({ outcome: 'acknowledged' })
    expect(ACKNOWLEDGED.acks).toHaveLength(1)
    const ack = ACKNOWLEDGED.acks[0] as Record<string, unknown>
    // The derived `ActionCaller` is `{kind:'human', humanId: <addressed
    // root>}` and the lane folds it to `callerPrincipalId` — the SAME id
    // the team owns as its human identity. A stub could return anything;
    // this came through `deriveControlCaller` + the plane fold.
    expect(ack['callerPrincipalId']).toBe(ROOT)
    expect(ack['teamSessionId']).toBe(ROOT)
  })

  it('a context swapped AFTER installation is typed on the derivation path itself — zero plane calls', () => {
    // The wire carries the frozen code (no new code, T12-B4); the
    // `principal-context-broken` reason rides the error DETAIL, which the
    // provenance-safe wire mapping keeps off the wire — the message names
    // the broken basis, the plane never ran.
    expect(errorOf(BROKEN_CONTEXT.response)['code']).toBe(S6_PRINCIPAL_ERROR_CODES.PRINCIPAL_INVALID)
    expect(String(errorOf(BROKEN_CONTEXT.response)['message'])).toContain('connection-gate authority basis')
    expect(BROKEN_CONTEXT.acks).toHaveLength(0)
  })

  it('a teamSessionId this host does not own never reaches the plane', () => {
    expect(errorOf(FOREIGN_TEAM.response)['code']).toBe(S6_PRINCIPAL_ERROR_CODES.FOREIGN_TEAM)
    expect(FOREIGN_TEAM.acks).toHaveLength(0)
  })

  it('identity cannot ride the wire: `asRole` dies at the closed v8 param set, before derivation', () => {
    expect(errorOf(SMUGGLED_ROLE.response)['code']).toBe('malformed-params')
    expect(JSON.stringify(SMUGGLED_ROLE.response)).toContain('unknown-field')
    expect(SMUGGLED_ROLE.acks).toHaveLength(0)
  })
})

describe('A4-PR6 review round 1 (fix 6/6) — the s6 act lane validates the receipt like the generic lane', () => {
  it('a non-vocabulary plane receipt is internal-error/port-contract, never a minted wire outcome', () => {
    const error = errorOf(BAD_RECEIPT.response)
    expect(error['code']).toBe('internal-error')
    expect(JSON.stringify(error)).toContain('port-contract')
    expect(BAD_RECEIPT.acks).toHaveLength(1) // the plane ran; the WIRE was guarded
  })

  it('a legal receipt still forwards the closed outcome untouched', () => {
    if (!ACKNOWLEDGED.response.ok) throw new Error('see above')
    expect(Object.keys(ACKNOWLEDGED.response.value.data as Record<string, unknown>)).toEqual(['outcome'])
  })
})
