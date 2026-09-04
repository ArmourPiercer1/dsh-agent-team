/**
 * P8-S4B M6 — unit tests for the durable MCP FACET consumption (DevPlan
 * P8-S §18.2: the capability must-close — "allowed -> durable tighten/deny
 * -> next actual operation blocked/absent (never silently allowed);
 * restart remains effective").
 *
 * Every fixture flows through the REAL frozen stack (durable records via
 * the storage parser, resolution via `resolveActivationPolicy`):
 *
 *  - F1 fail-closed baseline: no Team allow -> NO mount (the baseline
 *     agent gets no MCP tool, the deny is surfaced, never silent);
 *  - F2 an explicit allow naming the server -> mount allowed;
 *  - F3 allow-list discipline: a different server name / the wildcard;
 *  - F4 an explicit deny (human re-issue at the higher generation, or an
 *     instance-layer autonomy deny on its own) -> no mount, with the
 *     denying layer's provenance;
 *  - F5 invariant 34: the human override layer wins over the autonomy
 *     layers (an instance autonomy deny cannot strip a human grant, and a
 *     human re-grant beats an autonomy deny);
 *  - F6 the external capability absence wins with unavailable provenance;
 *  - F7 the full boundary re-resolution re-reads the durable truth (the
 *     restart-effective edge).
 *
 * v1 envelope ruling (frozen resolver + `resolveActivationPolicy`): the
 * v1 activation context resolves with EMPTY blueprint/template envelopes,
 * so an autonomy-overlay GRANT is out-of-envelope and fails closed —
 * only DENYs (and human overrides, which invariant 34 exempts from the
 * envelope) can grant a cell. The grant fixtures below use
 * `human-override` accordingly.
 *
 * @module @dsh-agent-team/runtime/test/p8s4b-mcp-facet
 */

import { describe, expect, it } from 'vitest'
import { resolveActivationPolicy } from '../activation/index.js'
import { MCP_FACET_WILDCARD, mcpFacetView, resolveDurableMcpFacet } from '../agent-setup/capability/index.js'
import { parseGovernanceOverride, type GovernanceOverrideRecord } from '../../storage/schema/index.js'

const ROOT = 'session-p8s4btest'
const INSTANCE = 'inst-p8s4btest1'
const SERVER = 'p8s4bmini'
const EMPTY_EXTERNAL = { hard: {}, capabilityExists: {} }

function override(
  recordId: string,
  values: Record<string, unknown>,
  extra?: {
    kind?: 'autonomy-overlay' | 'human-override'
    scope?: 'team' | 'instance'
    instanceId?: string
    origin?: 'leader' | 'member'
    generation?: number
  },
): GovernanceOverrideRecord {
  const kind = extra?.kind ?? 'autonomy-overlay'
  const base: Record<string, unknown> = {
    schemaVersion: 1,
    kind,
    recordId,
    scope: extra?.scope ?? 'team',
    rootSessionId: ROOT,
    values,
    generation: extra?.generation ?? 1,
    updatedAt: '2026-08-31T00:00:00.000Z',
  }
  if (extra?.instanceId !== undefined) base['instanceId'] = extra.instanceId
  if (kind === 'autonomy-overlay') base['origin'] = extra?.origin ?? 'leader'
  return parseGovernanceOverride(base)
}

const mcpAllow = { mcp: { kind: 'allow', items: [SERVER] } }
const mcpDeny = { mcp: { kind: 'deny' } }

const fBaseline = mcpFacetView(
  resolveActivationPolicy({ rootSessionId: ROOT, instanceId: INSTANCE, overrides: [], external: EMPTY_EXTERNAL }),
  SERVER,
)

const rAllow = override('p8s4b-mcp-allow', mcpAllow, { kind: 'human-override' })
const fAllow = mcpFacetView(
  resolveActivationPolicy({ rootSessionId: ROOT, instanceId: INSTANCE, overrides: [rAllow], external: EMPTY_EXTERNAL }),
  SERVER,
)

const fOtherServer = mcpFacetView(
  resolveActivationPolicy({ rootSessionId: ROOT, instanceId: INSTANCE, overrides: [rAllow], external: EMPTY_EXTERNAL }),
  'some-other-server',
)

const rWildcard = override('p8s4b-mcp-wild', { mcp: { kind: 'allow', items: [MCP_FACET_WILDCARD] } }, { kind: 'human-override' })
const fWildcard = mcpFacetView(
  resolveActivationPolicy({ rootSessionId: ROOT, instanceId: INSTANCE, overrides: [rWildcard], external: EMPTY_EXTERNAL }),
  'whatever-server',
)

const rDeny = override('p8s4b-mcp-deny', mcpDeny, { kind: 'human-override', generation: 2 })
const fDeny = mcpFacetView(
  resolveActivationPolicy({
    rootSessionId: ROOT,
    instanceId: INSTANCE,
    overrides: [rAllow, rDeny],
    external: EMPTY_EXTERNAL,
  }),
  SERVER,
)

const rInstanceDeny = override('p8s4b-mcp-iy', mcpDeny, { scope: 'instance', instanceId: INSTANCE, origin: 'member' })
const fInstanceDeny = mcpFacetView(
  resolveActivationPolicy({
    rootSessionId: ROOT,
    instanceId: INSTANCE,
    overrides: [rInstanceDeny],
    external: EMPTY_EXTERNAL,
  }),
  SERVER,
)
const fHumanBeatsInstanceDeny = mcpFacetView(
  resolveActivationPolicy({
    rootSessionId: ROOT,
    instanceId: INSTANCE,
    overrides: [rAllow, rInstanceDeny],
    external: EMPTY_EXTERNAL,
  }),
  SERVER,
)

const rAutDeny = override('p8s4b-mcp-autdeny', mcpDeny)
const rHumanAllow = override('p8s4b-mcp-ho', mcpAllow, { kind: 'human-override' })
const fHumanAllow = mcpFacetView(
  resolveActivationPolicy({
    rootSessionId: ROOT,
    instanceId: INSTANCE,
    overrides: [rAutDeny, rHumanAllow],
    external: EMPTY_EXTERNAL,
  }),
  SERVER,
)

const fCapabilityMissing = mcpFacetView(
  resolveActivationPolicy({
    rootSessionId: ROOT,
    instanceId: INSTANCE,
    overrides: [rAllow],
    external: { hard: {}, capabilityExists: { mcp: false } },
  }),
  SERVER,
)

const fullBoundaryAllow = resolveDurableMcpFacet({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [rAllow, rDeny],
  external: EMPTY_EXTERNAL,
  serverName: SERVER,
})
const fullBoundaryReAllow = resolveDurableMcpFacet({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [rAllow, rDeny, override('p8s4b-mcp-again', mcpAllow, { kind: 'human-override', generation: 3 })],
  external: EMPTY_EXTERNAL,
  serverName: SERVER,
})

describe('P8-S4B M6 durable MCP facet consumption', () => {
  it('F1 the baseline (no Team allow) is fail-closed: no mount, deny surfaced', () => {
    expect(fBaseline.allowed).toBe(false)
    expect(fBaseline.source.layer).toBe('unspecified')
    expect(fBaseline.deniedBy).toEqual({ by: 'team', reason: 'unspecifiedFailClosed' })
  })

  it('F2 an explicit allow naming the server permits the mount', () => {
    expect(fAllow.allowed).toBe(true)
    expect(fAllow.source).toEqual({ layer: 'humanOverride', origin: 'human', recordId: 'p8s4b-mcp-allow' })
    expect(fAllow.deniedBy).toBe(undefined)
  })

  it('F3 an allow-list that does not name the server does not grant it', () => {
    expect(fOtherServer.allowed).toBe(false)
    expect(fOtherServer.source.recordId).toBe('p8s4b-mcp-allow')
  })

  it('F3 the wildcard grants every server', () => {
    expect(fWildcard.allowed).toBe(true)
  })

  it('F4 a later generation deny re-issue beats the earlier allow', () => {
    expect(fDeny.allowed).toBe(false)
    expect(fDeny.deniedBy).toEqual({
      by: 'team',
      reason: 'teamDeny',
      layer: 'humanOverride',
      origin: 'human',
      recordId: 'p8s4b-mcp-deny',
    })
  })

  it('F4 a standalone instance-layer deny denies with instance provenance', () => {
    expect(fInstanceDeny.allowed).toBe(false)
    expect(fInstanceDeny.source.layer).toBe('instanceOverlay')
    expect(fInstanceDeny.deniedBy?.['reason']).toBe('teamDeny')
  })

  it('F5 invariant 34: a human grant survives an instance autonomy deny', () => {
    expect(fHumanBeatsInstanceDeny.allowed).toBe(true)
    expect(fHumanBeatsInstanceDeny.source.layer).toBe('humanOverride')
  })

  it('F5 a human re-grant beats an autonomy deny', () => {
    expect(fHumanAllow.allowed).toBe(true)
    expect(fHumanAllow.source.layer).toBe('humanOverride')
  })

  it('F6 an absent capability denies with unavailable provenance', () => {
    expect(fCapabilityMissing.allowed).toBe(false)
    expect(fCapabilityMissing.unavailable).toBe(true)
    expect(fCapabilityMissing.deniedBy).toEqual({ by: 'external', reason: 'capabilityMissing' })
  })

  it('F7 the boundary re-resolution re-reads the durable truth (deny wins at gen 2)', () => {
    expect(fullBoundaryAllow.view.allowed).toBe(false)
  })

  it('F7 a later allow re-issue (gen 3) restores the mount on the next boundary', () => {
    expect(fullBoundaryReAllow.view.allowed).toBe(true)
    expect(fullBoundaryReAllow.view.source.recordId).toBe('p8s4b-mcp-again')
  })
})
