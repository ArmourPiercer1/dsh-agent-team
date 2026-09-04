/**
 * pbf-default-artifact-urls.test.ts — plugin-bundle-form (task/
 * plugin-bundle-form): the location-derived glue/seam defaults of the
 * shipped production entry, and the validator semantics the git-install
 * surface (root `dsh.bundle.patch` → cordis.patch.yml, no machine-specific
 * URLs) relies on.
 *
 * This suite pins the PURE derivation functions on fake base URLs for
 * both module layouts (dist first, then source) plus the validator
 * boundary (absent URLs accepted, present-but-empty glueUrl rejected,
 * explicit URLs still round-tripping for the R122/125 worlds). The
 * real-tree file-existence and the shipped cordis.patch.yml
 * validator-through-file assertions live out-of-chain in the
 * references/ install-surface check (evidence script), keeping this
 * package's test convention of no direct Node builtin imports.
 *
 * Runner note: the plain-node shim forbids async `it()` bodies — all
 * assertions here are synchronous (the entry is a static module import,
 * exactly like p8s5a-host-loadability).
 * @module @dsh-agent-team/runtime/test/pbf-default-artifact-urls
 */

import { describe, expect, it } from 'vitest'
import * as host from '../src/plugin/host.js'

// The two module layouts of the shipped entry, expressed as the module
// URL the entry would have in each layout (fake absolute URLs are enough
// for the pure derivation functions).
const DIST_HOST_URL = 'file:///install/dsh-agent-team/packages/runtime/dist/packages/runtime/src/plugin/host.js'
const SRC_HOST_URL = 'file:///install/dsh-agent-team/packages/runtime/src/plugin/host.ts'

/** The minimal valid row config (the p8s5a T2 shape, URLs omitted). */
function minimalConfig(): Record<string, unknown> {
  return {
    bootPhase: 'create',
    rootSessionId: 'session-pbf',
    blueprintSource: 'schemaVersion: 1\nblueprintId: PBF-BP\nrevision: "1"\n',
    generation: 1,
    seedMembers: [],
    staticModel: { provider: 'p', model: 'm' },
    deniedSelection: null,
    mcpServer: null,
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
  }
}

describe('plugin-bundle-form: location-derived artifact URLs', () => {
  it('defaultGlueUrl resolves the co-located glue in the dist layout', () => {
    expect(host.defaultGlueUrl(DIST_HOST_URL)).toBe(
      'file:///install/dsh-agent-team/packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs',
    )
  })

  it('defaultGlueUrl resolves the co-located glue in the source layout', () => {
    expect(host.defaultGlueUrl(SRC_HOST_URL)).toBe(
      'file:///install/dsh-agent-team/packages/runtime/src/plugin/live/agent-bindings.mjs',
    )
  })

  it('defaultSeamUrlCandidates is dist-first with two layout candidates', () => {
    // The bootstrap passes its OWN module URL: from the dist layout
    // (dist/packages/runtime/src/plugin) five up = the runtime package
    // root — candidate 0 hits; from the source layout (src/plugin) two
    // up = the same package root — candidate 1 hits. The other candidate
    // is dead weight per layout (root-binding is never compiled; the seam
    // is ONE file at the package root).
    expect(host.defaultSeamUrlCandidates(DIST_HOST_URL)).toEqual([
      'file:///install/dsh-agent-team/packages/runtime/root-binding/harness/seam.mjs',
      'file:///install/dsh-agent-team/packages/runtime/dist/packages/runtime/root-binding/harness/seam.mjs',
    ])
  })

  it('defaultSeamUrlCandidates source layout: the second candidate is the package seam', () => {
    const candidates = host.defaultSeamUrlCandidates(SRC_HOST_URL)
    expect(candidates).toHaveLength(2)
    expect(candidates[1]).toBe(
      'file:///install/dsh-agent-team/packages/runtime/root-binding/harness/seam.mjs',
    )
  })

  it('the validator accepts a shipped-form config (no glueUrl/seamUrl)', () => {
    const validated = host.validateTeamPluginConfig(minimalConfig())
    expect(validated.rootSessionId).toBe('session-pbf')
    expect(validated.glueUrl).toBeUndefined()
    expect(validated.seamUrl).toBeUndefined()
  })

  it('a present-but-empty glueUrl still fails closed', () => {
    expect(() =>
      host.validateTeamPluginConfig({ ...minimalConfig(), glueUrl: '' }),
    ).toThrow()
  })

  it('explicit glueUrl/seamUrl still round-trip (R122/125 regression guard)', () => {
    const validated = host.validateTeamPluginConfig({
      ...minimalConfig(),
      glueUrl: 'file:///x/y.mjs',
      seamUrl: 'file:///x/z.mjs',
    })
    expect(validated.glueUrl).toBe('file:///x/y.mjs')
    expect(validated.seamUrl).toBe('file:///x/z.mjs')
  })
})
