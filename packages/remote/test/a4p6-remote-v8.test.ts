/**
 * A4-PR6 §6.B: the Remote contract v8 surface (the closed intervention
 * plane + the permission-administration read).
 *
 * This file owns the contract-layer laws of the v8 bump (the named home of
 * the A1-2 enumeration negative, per plan Task 6 §6.B):
 *
 * - v8 ADDS a version: v1–v7 method behavior is preserved byte-for-byte
 *   (spot-checked, never re-frozen here — the v1–v7 suites own that);
 * - the four v8-only methods live in the closed catalog with a CLOSED
 *   param field set each, so a future `asRole` / `impersonate` field
 *   CANNOT appear on the wire without a version bump — every smuggling
 *   field is rejected with `unknown-field` BEFORE any port runs;
 * - `intervention.act`'s action slot is the closed four
 *   (`allow | deny | escalate | acknowledge`): the reviewer vocabulary
 *   plus the warning plane's single verb — never a fifth global value;
 * - the wire responses carry the closed field set the client may render
 *   (presence pinned — the s6 response whitelist has silently dropped
 *   fields before, and the generic dispatcher projects nothing extra);
 * - `override.getPermissionAdministration` is a STRIP-PROJECTION server-side:
 *   a rich port record reaches the wire only through the closed
 *   administration shape, so authority-bearing and round-trippable
 *   decision fields can never ride it (the client must never receive a
 *   field it could send back to gain standing);
 * - ADR A1-2 enumeration: every governance-WRITING catalog method is
 *   explicitly principal-routed in `s6-principal.ts` — scanned as source
 *   text against the catalog's own `REMOTE_GOVERNANCE_WRITING_METHODS`
 *   classification, so a method "nobody thought to name" fails this test
 *   rather than falling into the host-operator default;
 * - the runtime member negative (a member caller CANNOT obtain human-user
 *   decision authority) is the `CONTROL_RESOLVER_NOT_AUTHORIZED` typed
 *   wire path pinned here end-to-end through the dispatcher: the refusal
 *   is a wire CODE the client must render, asserted at the wire, not a
 *   filtered UI. The behavioral runtime sibling lives in
 *   `packages/runtime/test/a4p6-governance-warning.test.ts`.
 */

import { describe, expect, it } from 'vitest'
import {
  REMOTE_CONTRACT_VERSION_V8,
  SUPPORTED_REMOTE_CONTRACT_VERSIONS,
  parseRemoteContractVersion,
} from '../src/contracts/version.js'
import {
  REMOTE_CATEGORIES,
  REMOTE_CATEGORY_VALUES,
  REMOTE_GOVERNANCE_WRITING_METHODS,
  REMOTE_METHOD_NAMES,
  REMOTE_V8_ONLY_METHODS,
  isRemoteMethodAvailableInVersion,
} from '../src/contracts/catalog.js'
import { parseRemoteMethodParams } from '../src/contracts/params.js'
import { createRemoteDispatcher } from '../src/handlers/dispatch.js'
import type {
  RemoteInterventionPort,
  RemoteInterventionWireAdministration,
  RemoteInterventionWireItem,
} from '../src/handlers/ports.js'
import { makeDispatcher } from './p8t3-helpers.js'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const V8 = REMOTE_CONTRACT_VERSION_V8
const SID = 's'.repeat(24)

function v8Wire(params: Record<string, unknown>): Record<string, unknown> {
  return { version: V8, params }
}

function expectError(response: Awaited<ReturnType<ReturnType<typeof createRemoteDispatcher>>>) {
  if (response.ok) throw new Error(`expected a typed failure, got success: ${JSON.stringify(response.value)}`)
  return response.error
}

/** A warning-plane item, exactly the shape the 6.A projection publishes. */
function warningItem(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    interventionId: 'int-warn-0123456789abcdef0123456789abcdef',
    kind: 'warning',
    responseBehavior: 'informational',
    blockScope: null,
    source: { kind: 'governance-warning', id: 'warn-0123456789abcdef0123456789abcdef' },
    status: 'open',
    legalActions: ['acknowledge'],
    derivationReasons: ['warning-observed'],
    createdAt: '2026-10-21T00:00:00.000Z',
    lastObservedAt: '2026-10-21T00:00:00.000Z',
    observationCount: 1,
    ...overrides,
  }
}

/** A fake intervention port with recorded calls (the seam the runtime fills). */
function fakeInterventionPort(overrides: Partial<RemoteInterventionPort> = {}): RemoteInterventionPort & {
  calls: string[]
} {
  const calls: string[] = []
  const defaults: RemoteInterventionPort = {
    list(request) {
      calls.push(`list:${request.teamSessionId}`)
      return { items: [warningItem() as unknown as RemoteInterventionWireItem] }
    },
    get(request) {
      calls.push(`get:${request.interventionId}`)
      const item = warningItem()
      if (String(request.interventionId) !== String(item['interventionId'])) {
        throw Object.assign(new Error('no such intervention'), { code: 'INTERVENTION_NOT_FOUND' })
      }
      return { item: item as unknown as RemoteInterventionWireItem }
    },
    act(request) {
      calls.push(`act:${request.action}`)
      return {
        outcome:
          request.action === 'acknowledge'
            ? ('acknowledged' as const)
            : ('decided' as const),
      }
    },
    permissionAdministration(request) {
      calls.push(`admin:${request.memberInstanceId ?? '-'}`)
      // Deliberately OVER-rich: the handler must project it down (server-side
      // strip), so authority-bearing fields must not reach the wire.
      return {
        administration: {
          teamSessionId: request.teamSessionId,
          memberInstanceId: request.memberInstanceId ?? null,
          generation: 7,
          source: 'overlay',
          effective: {
            rules: [
              { operationClass: 'file.write', matcherKind: 'subtree', matcherKey: 'src/', effect: 'ask' },
            ],
          },
          diagnostics: ['overlay-generation-7'],
          // fields the strip must eat:
          requiredAuthority: 'human-admin',
          reviewerRank: 3,
          grantCeiling: { rules: [] },
          openCaseRequestIds: ['req-1'],
        } as unknown as RemoteInterventionWireAdministration,
      }
    },
  }
  const port: RemoteInterventionPort = {
    list: overrides.list ?? defaults.list,
    get: overrides.get ?? defaults.get,
    act: overrides.act ?? defaults.act,
    permissionAdministration: overrides.permissionAdministration ?? defaults.permissionAdministration,
  }
  return Object.assign(port, { calls })
}

describe('A4-PR6 §6.B: the Remote contract v8 surface', () => {
  it('v8 is a supported version that ADDS to the ladder (v1–v7 stay members)', () => {
    expect(V8).toBe(8)
    expect([...SUPPORTED_REMOTE_CONTRACT_VERSIONS]).toEqual([1, 2, 3, 4, 5, 6, 7, 8])
    expect(parseRemoteContractVersion(8)).toBe(8)
    expect(parseRemoteContractVersion(1)).toBe(1)
  })

  it('the catalog gains exactly the INTERVENTION category and the four v8-only methods', () => {
    expect(REMOTE_CATEGORIES.INTERVENTION).toBe('intervention')
    expect([...REMOTE_V8_ONLY_METHODS].sort()).toEqual([
      'intervention.act',
      'intervention.get',
      'intervention.list',
      'override.getPermissionAdministration',
    ])
    // 31 v7 methods + the four v8-only methods = 35, and the category set
    // is the nine frozen categories plus `intervention`.
    expect(REMOTE_METHOD_NAMES.length).toBe(35)
    expect([...REMOTE_CATEGORY_VALUES]).toEqual([
      'catalog',
      'intent',
      'team',
      'member',
      'override',
      'policyState',
      'compatibility',
      'handoff',
      'legacy',
      'intervention',
    ])
  })

  it('availability: v1–v7 refuse every v8-only method; v8 admits everything', () => {
    for (const version of [1, 2, 3, 4, 5, 6, 7]) {
      for (const method of REMOTE_V8_ONLY_METHODS) {
        expect(isRemoteMethodAvailableInVersion(method, version), `${method}@v${version}`).toBe(false)
        const error = (() => {
          try {
            parseRemoteMethodParams(version, method, { teamSessionId: SID })
            return null
          } catch (e) {
            return e as { code?: string }
          }
        })()
        expect(error?.code, `${method}@v${version} parse`).toBe('method-version-unsupported')
      }
    }
    for (const method of REMOTE_V8_ONLY_METHODS) {
      expect(isRemoteMethodAvailableInVersion(method, 8), `${method}@v8`).toBe(true)
    }
    // and an old method is still admitted at v8 (v8 ADDS, never removes)
    expect(isRemoteMethodAvailableInVersion('team.create', 8)).toBe(true)
    expect(isRemoteMethodAvailableInVersion('override.mutatePermission', 8)).toBe(true)
  })

  it('every v8 method param set is CLOSED: an identity or authority smuggle is unknown-field before any port runs', async () => {
    const port = fakeInterventionPort()
    const { dispatch } = makeDispatcher({ intervention: port })
    const smuckles = [
      { asRole: 'human-admin' },
      { impersonate: 'someone' },
      { actor: { kind: 'human', humanId: SID } },
      { role: 'human-user' },
      { legalActions: ['allow'] },
      { requiredAuthority: 'human-admin' },
    ]
    const targets: Array<[string, Record<string, unknown>]> = [
      ['intervention.list', { teamSessionId: SID }],
      ['intervention.get', { teamSessionId: SID, interventionId: 'int-x' }],
      ['intervention.act', { teamSessionId: SID, interventionId: 'int-x', action: 'allow' }],
      ['override.getPermissionAdministration', { teamSessionId: SID }],
    ]
    for (const [method, base] of targets) {
      for (const smuggle of smuckles) {
        const error = expectError(await dispatch(method, v8Wire({ ...base, ...smuggle })))
        // The frozen closed-field law on the wire: `malformed-params` with
        // the `unknown-field` REASON (the reason is the identity of the
        // rejection; the code is the frozen envelope code).
        expect(error.code, `${method} + ${JSON.stringify(smuggle)}`).toBe('malformed-params')
        expect((error.details as unknown as Record<string, unknown>)['reason'], method).toBe('unknown-field')
      }
      expect(port.calls.length, 'a rejected request never reaches the port').toBe(0)
    }
  })

  it('intervention.act action is the closed four; any other value is malformed-params', async () => {
    const { dispatch } = makeDispatcher({ intervention: fakeInterventionPort() })
    for (const action of ['allow', 'deny', 'escalate', 'acknowledge']) {
      const response = await dispatch(
        'intervention.act',
        v8Wire({ teamSessionId: SID, interventionId: 'int-x', action }),
      )
      expect(response.ok, action).toBe(true)
    }
    for (const action of ['approve', 'force-allow', 'ACK', 'abandon', '', 1]) {
      const error = expectError(
        await dispatch('intervention.act', v8Wire({ teamSessionId: SID, interventionId: 'int-x', action })),
      )
      expect(error.code, JSON.stringify(action)).toBe('malformed-params')
    }
  })

  it('intervention.list carries the CLOSED item shape field-for-field at v8 (presence pinned on the wire)', async () => {
    const port = fakeInterventionPort()
    const { dispatch } = makeDispatcher({ intervention: port })
    const response = await dispatch('intervention.list', v8Wire({ teamSessionId: SID }))
    if (!response.ok) throw new Error('expected success')
    expect(response.value.provenance.contractVersion).toBe(8)
    const data = response.value.data as { items: Record<string, unknown>[] }
    expect(port.calls).toEqual([`list:${SID}`])
    const item = data.items[0] as Record<string, unknown>
    // every frozen InterventionItem field the 6.A projection publishes is
    // present — a dropped wire cell is a client-visible defect.
    for (const field of [
      'interventionId',
      'kind',
      'responseBehavior',
      'blockScope',
      'source',
      'status',
      'legalActions',
      'derivationReasons',
      'createdAt',
      'lastObservedAt',
      'observationCount',
    ]) {
      expect(item, `wire item carries '${field}'`).toHaveProperty(field)
    }
    expect(item['responseBehavior']).toBe('informational')
    expect(item['legalActions']).toEqual(['acknowledge'])
  })

  it('intervention.act answers with the closed outcome ONLY — no authority or decision field rides back', async () => {
    const { dispatch } = makeDispatcher({ intervention: fakeInterventionPort() })
    const response = await dispatch(
      'intervention.act',
      v8Wire({ teamSessionId: SID, interventionId: 'int-x', action: 'acknowledge', note: 'reviewed' }),
    )
    if (!response.ok) throw new Error('expected success')
    const data = response.value.data as Record<string, unknown>
    expect(data).toEqual({ outcome: 'acknowledged' })
  })

  it('getPermissionAdministration is a server-side STRIP: authority-bearing and round-trippable fields never reach the wire', async () => {
    const { dispatch } = makeDispatcher({ intervention: fakeInterventionPort() })
    const response = await dispatch('override.getPermissionAdministration', v8Wire({ teamSessionId: SID }))
    if (!response.ok) throw new Error('expected success')
    const admin = (response.value.data as { administration: Record<string, unknown> }).administration
    expect(Object.keys(admin).sort()).toEqual([
      'diagnostics',
      'effective',
      'generation',
      'memberInstanceId',
      'source',
      'teamSessionId',
    ])
    for (const banned of ['requiredAuthority', 'reviewerRank', 'grantCeiling', 'openCaseRequestIds']) {
      expect(admin, `stripped '${banned}'`).not.toHaveProperty(banned)
    }
  })

  it('typed refusals survive the wire: INTERVENTION_NOT_FOUND passes, CONTROL_RESOLVER_NOT_AUTHORIZED passes, out-of-vocabulary degrades', async () => {
    const refusal = (code: string) =>
      makeDispatcher({
        intervention: fakeInterventionPort({
          act() {
            throw Object.assign(new Error('refused'), { code })
          },
        }),
      }).dispatch('intervention.act', v8Wire({ teamSessionId: SID, interventionId: 'int-x', action: 'allow' }))
    // the not-found lane (closed v8 backing code)
    expect((await refusal('INTERVENTION_NOT_FOUND')).ok).toBe(false)
    expect(expectError(await refusal('INTERVENTION_NOT_FOUND')).code).toBe('INTERVENTION_NOT_FOUND')
    // the member negative: the runtime control plane refuses a caller
    // without the leg's authority with THIS code — on the wire it stays
    // typed (the client renders the refusal; the UI filters nothing).
    expect(expectError(await refusal('CONTROL_RESOLVER_NOT_AUTHORIZED')).code).toBe(
      'CONTROL_RESOLVER_NOT_AUTHORIZED',
    )
    // out-of-vocabulary: closed-set discipline degrades to internal-error
    expect(expectError(await refusal('NOT_A_CONTRACT_CODE')).code).toBe('internal-error')
  })

  it('an unwired intervention seam is a typed refusal, never a partial success', async () => {
    const { dispatch } = makeDispatcher()
    const error = expectError(await dispatch('intervention.list', v8Wire({ teamSessionId: SID })))
    expect(error.code).toBe('internal-error')
    expect(await dispatch('team.getProjection', v8Wire({ teamSessionId: SID })).then((r) => r.ok)).toBe(true)
  })

  it('ADR A1-2 enumeration: every governance-writing catalog method is EXPLICITLY principal-routed in s6-principal.ts (source law)', () => {
    // A1-2: no governance-writing method may fall into a default or
    // operator branch. The classification is the CATALOG's (the frozen
    // surface), the routing is `s6-principal.ts`'s; the enumeration is
    // complete BY CLASSIFICATION, so a method nobody thought to name
    // still has to appear in an explicit route.
    expect([...REMOTE_GOVERNANCE_WRITING_METHODS].sort()).toEqual([
      'compatibility.ack',
      'intervention.act',
      'override.mutatePermission',
      'override.reset',
      'override.set',
      'policyState.set',
      'team.resolveControl',
    ])
    const here = fileURLToPath(new URL('.', import.meta.url))
    const principalSource = readFileSync(
      // packages/remote/test -> repo root -> runtime package (TEXT law:
      // the remote package stays dependency-pure; this is a scan, the
      // same class of law `p8t3-negative-scan` runs).
      `${here}../../runtime/src/plugin/s6-principal.ts`,
      'utf8',
    )
    for (const method of REMOTE_GOVERNANCE_WRITING_METHODS) {
      // Each name must appear inside an explicit routing construct: a
      // set literal member or an `if (method === …)` branch.
      const routed =
        principalSource.includes(`'${method}',`) || principalSource.includes(`=== '${method}'`)
      expect(routed, `s6-principal.ts routes '${method}' explicitly`).toBe(true)
    }
    // A4-PR6 review round 1 (fix 5/6) — the REVERSE direction was the
    // hole: `team.resolveControl` (durable control DECISIONS) and
    // `compatibility.ack` (the governance-warning ACKNOWLEDGMENT write)
    // are governance-writing by effect and are explicitly routed to
    // governance decider derivations, yet the enumeration omitted them —
    // "complete BY CLASSIFICATION" is worthless if the classification
    // itself under-enumerates. Law: EVERY method explicitly routed to a
    // decider derivation (`deriveMutationActor` / `deriveAckCaller` /
    // `deriveControlCaller`) must be a member of the catalog
    // classification. Admission routes (`deriveAdmissionCaller`, the
    // member.create/send/followup set) stay excluded by the A1-2
    // classification: they admit WORK, they write no governance state.
    const writeRoutes = new Set<string>()
    for (const match of principalSource.matchAll(
      /if \(method === '([^']+)'\) return (deriveMutationActor|deriveAckCaller|deriveControlCaller)\b/g,
    )) {
      const name = match[1]
      if (name !== undefined) writeRoutes.add(name)
    }
    const mutationSet = /const MUTATION_METHODS = new Set\(\[([\s\S]*?)\]\)/.exec(principalSource)
    for (const match of (mutationSet?.[1] ?? '').matchAll(/'([^']+)'/g)) {
      const name = match[1]
      if (name !== undefined) writeRoutes.add(name)
    }
    // The scan itself must see the three decider routes (a parser that
    // matched nothing would make the law vacuously green).
    expect([...writeRoutes].sort()).toContain('intervention.act')
    expect([...writeRoutes].sort()).toContain('compatibility.ack')
    expect([...writeRoutes].sort()).toContain('team.resolveControl')
    for (const route of writeRoutes) {
      expect(
        REMOTE_GOVERNANCE_WRITING_METHODS,
        `governance-writing method '${route}' is routed but NOT enumerated`,
      ).toContain(route)
    }
  })

  it('v1–v7 behavior is preserved at the shared seams: the v7 guard field stays v7+ only at override.set', async () => {
    const { dispatch } = makeDispatcher({ intervention: fakeInterventionPort() })
    const v1 = await dispatch(
      'override.set',
      { version: 1, params: { teamSessionId: SID, capability: 'browser', value: {}, actor: { kind: 'operator' } } },
    )
    expect(expectError(v1).code).not.toBe('unknown-field')
    const withGuardV1 = await dispatch(
      'override.set',
      {
        version: 1,
        params: { teamSessionId: SID, capability: 'browser', value: {}, actor: { kind: 'operator' }, expectedGeneration: 1 },
      },
    )
    expect(expectError(withGuardV1).code).toBe('malformed-params')
    expect((expectError(withGuardV1).details as unknown as Record<string, unknown>)['reason']).toBe(
      'unknown-field',
    )
  })
})
