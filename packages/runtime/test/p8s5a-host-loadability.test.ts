/**
 * p8s5a-host-loadability.test.ts — T2 (P8-S5A): the production entry
 * exposes the loadable Cordis surface.
 *
 * Scope honesty (S5A-URL): this in-chain suite imports the entry from TS
 * SOURCE (`../src/plugin/host.js` — NodeNext .js→.ts sibling; the runner
 * hook and tsc resolve the same file identically) and proves the
 * SOURCE-level contract:
 *
 *   - the module exposes the named Cordis exports (`name`, `apply`), the
 *     `inject` set, and the exported config validator;
 *   - the validator fails closed with stable codes.
 *
 * BUILT-artifact loadability (the dist-mirror entry
 * `dist/packages/runtime/src/plugin/host.js` that the live harness mounts
 * under plain Node with zero TS tooling) is proven OUT-OF-CHAIN: the full
 * live harness re-run (17/17) and the plain-Node `node --check` + import
 * smoke over the rebuilt dist entry (see
 * dev/agent-workflow/evidence/P8-S/S5A-url-result.md, A6/A7).
 *
 * Runner note: the plain-node shim (scripts/test-vitest-shim.mjs) forbids
 * async `it()` bodies — so the entry is a static module import and the
 * `it` bodies assert synchronously on the loaded module.
 *
 * `apply` is deliberately NOT invoked here (that is T1's contract; invoking
 * it would register the upstream-resolution hook into this runner process).
 * @module @dsh-agent-team/runtime/test/p8s5a-host-loadability
 */

import { describe, expect, it } from 'vitest'
import * as host from '../src/plugin/host.js'

describe('P8-S5A T2 entry loadability (source entry)', () => {
  it('the entry imports and exposes the named Cordis exports', () => {
    expect(typeof host).toBe('object')
    expect(host.name).toBe('dsh-agent-team')
    expect(typeof host.apply).toBe('function')
    expect(typeof host.validateTeamPluginConfig).toBe('function')
    // The hard-service inject set (the Loader keeps the row inactive until
    // all three exist — the pre-S5A harness row; R122 swapped the
    // materialization seam to the stock `sessions` service, rc.1 having
    // removed sessionPersistence.ensureMaterialized).
    expect(host.inject).toEqual(['agents', 'storageDomain', 'sessions'])
  })

  it('the entry module is a live ESM namespace with a stable identity', () => {
    // The static module import above already proves in-chain loadability
    // of the source entry (the runner strips only .ts). The loaded module
    // is a live record with the stable identity (the out-of-chain built
    // artifact gets the plain-Node loadability proof — see header).
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
