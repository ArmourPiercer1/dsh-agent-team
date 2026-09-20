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
import { ACTIVATION_ERROR_CODES, resolveActivationPolicy } from '../activation/index.js'
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
    // v2 committed world (blueprint-loading repair): GovernanceOverride
    // rows validate against the v2 TeamDomain schema version.
    schemaVersion: 2,
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

// ===========================================================================
// The INITIAL STATIC MCP grant (the bound Blueprint template's
// `capabilities.mcp` kind === 'allow' as the governance cell's static initial
// layer — plan MCP_BLUEPRINT_INITIAL_GRANT §6 Gate A). The initial grant
// enters the policy resolver at the `template` value layer (provenance
// template/static — NO synthetic durable record); the record-backed layers
// (templateOverlay / instanceOverlay / humanOverride) and the external hard
// facts keep their precedence over it. The input is the optional
// `initialTemplateMcp` of `resolveDurableMcpFacet` (absent = the unchanged
// unspecifiedFailClosed baseline for legacy / capabilities-less templates).
// ===========================================================================

const gA1 = resolveDurableMcpFacet({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [],
  external: EMPTY_EXTERNAL,
  serverName: SERVER,
  initialTemplateMcp: { kind: 'allow', items: [SERVER] },
})

const gA2 = resolveDurableMcpFacet({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [],
  external: EMPTY_EXTERNAL,
  serverName: 'some-other-server',
  initialTemplateMcp: { kind: 'allow', items: [SERVER] },
})

const gA3 = resolveDurableMcpFacet({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [],
  external: EMPTY_EXTERNAL,
  serverName: 'whatever-server',
  initialTemplateMcp: { kind: 'allow', items: [MCP_FACET_WILDCARD] },
})

const gA5 = resolveDurableMcpFacet({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [],
  external: EMPTY_EXTERNAL,
  serverName: SERVER,
  // no initialTemplateMcp: a legacy / capabilities-less template.
})

const gA6 = resolveDurableMcpFacet({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [],
  external: { hard: { mcp: { kind: 'deny' } }, capabilityExists: {} },
  serverName: SERVER,
  initialTemplateMcp: { kind: 'allow', items: [SERVER] },
})

const gA7 = resolveDurableMcpFacet({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [override('p8s4b-g-a7-deny', mcpDeny, { kind: 'human-override' })],
  external: EMPTY_EXTERNAL,
  serverName: SERVER,
  initialTemplateMcp: { kind: 'allow', items: [SERVER] },
})

const gA8humanAllow = resolveDurableMcpFacet({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [override('p8s4b-g-a8-allow', mcpAllow, { kind: 'human-override' })],
  external: EMPTY_EXTERNAL,
  serverName: SERVER,
  initialTemplateMcp: { kind: 'allow', items: [SERVER] },
})

const gA8overlayDeny = resolveDurableMcpFacet({
  rootSessionId: ROOT,
  instanceId: INSTANCE,
  overrides: [
    override('p8s4b-g-a8-den', mcpDeny, {
      kind: 'autonomy-overlay',
      scope: 'team',
      origin: 'leader',
    }),
  ],
  external: EMPTY_EXTERNAL,
  serverName: SERVER,
  initialTemplateMcp: { kind: 'allow', items: [SERVER] },
})

describe('initial static MCP grant (the bound Blueprint template mcp.allow)', () => {
  it('A1 fresh static allow, no overrides: allowed, provenance template/static (the bug)', () => {
    expect(gA1.view.allowed).toBe(true)
    expect(gA1.view.source).toEqual({ layer: 'template', origin: 'static', recordId: null })
    expect(gA1.view.deniedBy).toBe(undefined)
  })

  it('A2 a server not named in the initial allow is not granted', () => {
    expect(gA2.view.allowed).toBe(false)
    expect(gA2.view.source.layer).toBe('template')
  })

  it('A3 a wildcard initial allow grants every server', () => {
    expect(gA3.view.allowed).toBe(true)
    expect(gA3.view.source.layer).toBe('template')
  })

  it('A4 a raw empty initial allow is rejected FAIL CLOSED by the frozen resolver (the glue normalizes it to "no grant")', () => {
    // Frozen resolver contract: 'allow' items must be non-empty (an empty
    // allow is not a legal policy value at ANY layer). The live glue never
    // feeds it through: an empty template allow normalizes to "no initial
    // grant" (unspecified baseline — the live-glue matrix pins the
    // no-mount, no-crash outcome for that blueprint shape).
    let caught: unknown
    try {
      resolveDurableMcpFacet({
        rootSessionId: ROOT,
        instanceId: INSTANCE,
        overrides: [],
        external: EMPTY_EXTERNAL,
        serverName: SERVER,
        initialTemplateMcp: { kind: 'allow', items: [] },
      })
    } catch (error) {
      caught = error
    }
    expect(caught).toBeDefined()
    expect((caught as { code?: string }).code).toBe(ACTIVATION_ERROR_CODES.POLICY_RESOLUTION_FAILED)
  })

  it('A5 no static grant (absent) + no overrides: the unchanged unspecifiedFailClosed baseline', () => {
    expect(gA5.view.allowed).toBe(false)
    expect(gA5.view.source.layer).toBe('unspecified')
    expect(gA5.view.deniedBy).toEqual({ by: 'team', reason: 'unspecifiedFailClosed' })
  })

  it('A6 the external hard deny vetoes the static initial grant', () => {
    expect(gA6.view.allowed).toBe(false)
    expect(gA6.view.deniedBy).toEqual({ by: 'external', reason: 'externalHardDeny' })
  })

  it('A7 a durable human deny beats the static initial grant at the next boundary', () => {
    expect(gA7.view.allowed).toBe(false)
    expect(gA7.view.deniedBy).toEqual({
      by: 'team',
      reason: 'teamDeny',
      layer: 'humanOverride',
      origin: 'human',
      recordId: 'p8s4b-g-a7-deny',
    })
  })

  it('A8 a record-backed human allow keeps precedence over the static initial layer', () => {
    expect(gA8humanAllow.view.allowed).toBe(true)
    expect(gA8humanAllow.view.source.layer).toBe('humanOverride')
    expect(gA8humanAllow.view.source.recordId).toBe('p8s4b-g-a8-allow')
  })

  it('A8 a record-backed autonomy deny keeps precedence over the static initial layer', () => {
    expect(gA8overlayDeny.view.allowed).toBe(false)
    expect(gA8overlayDeny.view.deniedBy?.['layer']).toBe('templateOverlay')
    expect(gA8overlayDeny.view.deniedBy?.['recordId']).toBe('p8s4b-g-a8-den')
  })
})
