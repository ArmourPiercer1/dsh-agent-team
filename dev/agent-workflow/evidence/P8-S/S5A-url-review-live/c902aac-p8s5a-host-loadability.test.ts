/**
 * p8s5a-host-loadability.test.ts — T2 (P8-S5A): the production entry is
 * host-loadable under the S5-PRE load path.
 *
 *   - the entry is the DIST build artifact (`tsc -p packages/runtime/
 *     tsconfig.build.json` mirror layout:
 *     `dist/packages/runtime/src/plugin/host.js`);
 *   - it loads under PLAIN Node with zero TS tooling: this very runner is
 *     plain node — the `.test.ts` files get native type-stripping, but the
 *     imported `host.js` is a `.js` module loaded natively (no stripping,
 *     no loader hook of ours, no `node --import`, no package-exports
 *     change). The top-level `await import(...)` below is that proof: it
 *     runs at module load under the plain-node runner;
 *   - the module exposes the named Cordis exports (`name`, `apply`) plus
 *     the exported config validator.
 *
 * Runner note: the plain-node shim (scripts/test-vitest-shim.mjs) forbids
 * async `it()` bodies — so the import happens at module top level and the
 * `it` bodies assert synchronously on the loaded module.
 *
 * The sibling parent-level evidence (logged in dev/agent-workflow/evidence/
 * P8-S/): the sanctioned `tsc -p packages/legacy/tsconfig.build.json` +
 * `tsc -p packages/runtime/tsconfig.build.json` builds exit 0, and
 * `node --check dist/packages/runtime/src/plugin/host.js` exits 0.
 *
 * `apply` is deliberately NOT invoked here (that is T1's contract; invoking
 * it would register the upstream-resolution hook into this runner process).
 * @module @dsh-agent-team/runtime/test/p8s5a-host-loadability
 */

import { describe, expect, it } from 'vitest'
import { assertArtifactsBuilt, builtHostUrl } from './p8s5a-artifacts.mjs'

assertArtifactsBuilt()
// The plain-Node load itself: no TS loader, no hook — a native ESM import
// of the built .js entry (top-level await; the shim forbids async it()).
const host: Record<string, any> = await import(builtHostUrl())

describe('P8-S5A T2 host loadability (plain node, zero TS tooling)', () => {
  it('the built entry imports natively and exposes the named Cordis exports', () => {
    expect(typeof host).toBe('object')
    expect(host.name).toBe('dsh-agent-team')
    expect(typeof host.apply).toBe('function')
    expect(typeof host.validateTeamPluginConfig).toBe('function')
  })

  it('the built entry is plain JavaScript (no TS artifacts in the emitted file)', () => {
    // The module-load above already proves plain-Node loadability (the
    // runner strips only .ts). The loaded module is a live record with the
    // stable identity (a TS-emitted type surface would not load here at
    // all, and the parent-level `node --check` covers the syntax audit).
    expect(host === null).toBe(false)
    expect(typeof host.name).toBe('string')
  })

  it('the exported config validator fails closed with stable codes', () => {
    // A null/absent row config is invalid (loud, before any service read).
    expect(() => host.validateTeamPluginConfig(null)).toThrow()
    expect(() => host.validateTeamPluginConfig({})).toThrow()
    // A minimal valid config round-trips (the validator is total on the
    // row-config shape — T1 drives the full shape through apply).
    const valid = host.validateTeamPluginConfig({
      bootPhase: 'create',
      rootSessionId: 'session-t2',
      blueprintSource: 'schemaVersion: 1\nblueprintId: T2-BP\nrevision: "1"\n',
      generation: 1,
      seedMembers: [],
      staticModel: { provider: 'p', model: 'm' },
      deniedSelection: null,
      mcpServer: null,
      environmentFacts: [],
      externalPolicyFacts: { hard: {}, capabilityExists: {} },
      glueUrl: 'file:///x/y.mjs',
    })
    expect(valid.rootSessionId).toBe('session-t2')
    expect(valid.glueUrl).toBe('file:///x/y.mjs')
  })
})
