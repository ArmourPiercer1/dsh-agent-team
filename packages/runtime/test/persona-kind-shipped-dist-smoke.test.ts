/**
 * SHIPPED DIST SMOKE — finding A (persona KIND convention) + Blocker-1
 * (role identity) + Blocker-3 (typed §13.5 lane) over the BUILT artifact.
 *
 * Labeled exactly what it is: a SHIPPED DIST SMOKE. The plugin is
 * consumed from the committed `dist` mirror WITHOUT a separate build
 * step (root package.json `./host` export →
 * `packages/runtime/dist/packages/runtime/src/plugin/host.js`; README
 * L85–88/L121: the required generated artifacts must be committed in the
 * same commit as the source). This smoke imports the PUBLIC dist export
 * surface — the BUILT `provider.js` the host entry chains into — via the
 * file-URL dynamic-import precedent (the way
 * `packages/testkit/test/plugin-dsh-compat.test.ts` imports a prebuilt
 * lib), and asserts the finding-A semantics over the SHIPPED module:
 * the kind-subject resolution returns the OBSERVED-kind fact (never
 * `unknown`), the template scope's role selects the plan entry, and the
 * complete observation carries the alongside `(persona, 'complete')`
 * world fact the engine's typed lane keys on.
 *
 * It is the ARTIFACT-LANE evidence — it does NOT replace the 14-test
 * source-level suite (the real parser/provider/preflight integration
 * over the observer-seam double), and it is NOT a live host: no host
 * entry is booted, no instance is started.
 *
 * @module @dsh-agent-team/runtime/test/persona-kind-shipped-dist-smoke
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { describe, expect, it } from 'vitest'

// The public dist surface: the BUILT provider module of the runtime
// package (the host entry `./host` → dist .../src/plugin/host.js chains
// into this module; importing it directly keeps the smoke minimal and
// import-side-effect-free). The vitest runner's .js→.ts sibling hook
// cannot rewrite this path (there is NO .ts sibling inside the dist
// mirror), so the loaded module is the built JS artifact itself.
const distProviderPath = fileURLToPath(
  new URL('../dist/packages/runtime/requirement-facts/provider.js', import.meta.url),
)

// The SHIPPED module (typed against the source surface — the dist mirror
// is built from exactly this source). Loaded ONCE, over the file URL, so
// the vitest transform pipeline is bypassed (the plugin-dsh-compat
// precedent).
const shipped = (await import(
  /* @vite-ignore */ pathToFileURL(distProviderPath).href
)) as typeof import('../requirement-facts/index.js')

/** The production observer-seam observation shape (plan §C.2). */
const observation = (kind: 'standard' | 'complete'): { kind: 'standard' | 'complete'; source: string } => ({
  kind,
  source: 'effective-composition',
})

type ShippedPlan = {
  readonly root: { readonly presetId: string; readonly persona: { kind: 'standard' | 'complete'; source: string } }
  readonly member: { readonly presetId: string; readonly persona: { kind: 'standard' | 'complete'; source: string } }
}

/**
 * One SHIPPED provider instance over a plain substrate-plan double (the
 * smoke asserts the PROVIDER artifact's semantics — the resolver seam is
 * covered by the source-level suite; the plan shape is the resolver's
 * frozen output contract).
 */
function shippedProvider(plan: ShippedPlan) {
  return shipped.createRuntimeRequirementFactsProvider({
    configuredMcpServers: [],
    // The production structural fact (the mcpServer-only probe registry —
    // no `persona` probe port): a plain double is sufficient for the
    // artifact-lane assertions (persona never probes).
    readiness: {
      hasProbe: (type: string) => type === 'mcpServer',
      probe: async () => ({ verdict: 'reachable', source: 'mcp-fiber', observedAt: '2026-10-02T00:00:00.000Z' }),
    },
    substratePlan: async () => plan,
    now: () => '2026-10-02T00:00:00.000Z',
  })
}

const teamStandard = [
  { requirementId: 'req-persona-standard-team', type: 'persona' as const, subjects: ['standard'], complete: true },
]

describe('SHIPPED DIST SMOKE — the built provider artifact carries the finding-A semantics', () => {
  it('the built provider.js is committed in the dist mirror (the artifact the plugin loads)', () => {
    const built = readFileSync(distProviderPath, 'utf8')
    // The artifact carries the KIND path (the role-aware selection) — not
    // the pre-fix preset-id-only matching.
    expect(built).toContain('REQUIREMENT_FACT_SCOPE_ROLES')
    expect(built).toContain('isRequiredPersonaKind')
  })

  it('the shipped module resolves a KIND subject against the role observation (not unknown) — no seed', async () => {
    const provider = shippedProvider({
      // A composable preset under a BESPOKE id (preset id ≠ persona kind —
      // the PR #22 donor invariant): the root observes `standard`, the
      // member observes `complete`.
      root: { presetId: 'ptc/team-small-ctb', persona: observation('standard') },
      member: { presetId: 'ptc/member-custom', persona: observation('complete') },
    })

    // Team scope: the ROOT observation (standard) satisfies the required
    // kind — the shipped artifact returns the OBSERVED-kind fact.
    const team = await provider.resolveFacts({ requirements: teamStandard, scope: { kind: 'team' } })
    expect(team.observations[0]).toMatchObject({ subject: 'standard', readiness: 'reachable' })
    expect(team.environmentFacts).toEqual([
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ])

    // Leader template scope: the LEADER's own (root) observation —
    // Blocker-1 role identity over the SHIPPED module.
    const leader = await provider.resolveFacts({
      requirements: teamStandard,
      scope: { kind: 'template', templateId: 'leader', role: 'leader' },
    })
    expect(leader.environmentFacts).toEqual([
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ])

    // Member template scope: the MEMBER observation (complete) — the
    // required kind is unmet AND the complete observation surfaces the
    // alongside `(persona, 'complete')` world fact (Blocker-3 — the
    // engine's typed §13.5 lane keys on exactly that fact).
    const member = await provider.resolveFacts({
      requirements: teamStandard,
      scope: { kind: 'template', templateId: 'worker', role: 'member' },
    })
    expect(member.observations[0]).toMatchObject({ subject: 'standard', readiness: 'unreachable' })
    expect(member.environmentFacts).toEqual([
      { domain: 'persona', subject: 'complete', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: false, generation: 1 },
    ])

    // The LEGACY preset-id path is intact in the shipped artifact
    // (non-kind subject → the observed root preset id).
    const legacy = await provider.resolveFacts({
      requirements: [
        { requirementId: 'legacy-root', type: 'persona' as const, subjects: ['ptc/team-small-ctb'], complete: true },
      ],
      scope: { kind: 'team' },
    })
    expect(legacy.environmentFacts).toEqual([
      { domain: 'persona', subject: 'ptc/team-small-ctb', available: true, generation: 1 },
    ])
  })
})
