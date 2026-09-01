import { describe, expect, it } from 'vitest'

import { PACKAGE_ID } from '../src/index.js'
import * as hostPlugin from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'
import { TEAM_PLUGIN_ERROR_CODES } from '../src/plugin/types.js'

// Module-top-level drive (the plain-node shim forbids async `it()` bodies):
// a minimal structural context with NO row config. The production entry
// NEVER rejects apply (Cordis absorbs rejected apply fibers into its own
// logger — invisible to the harness, proven by the attempt-1 incident): it
// provides the `teamRoot` facade synchronously and reports every setup
// failure — config validation first — through the facade's `ready`
// rejection, the single observable failure channel.
const provided: Record<string, unknown> = {}
const effects: Array<() => void> = []
const ctx: TeamPluginHostContext = {
  get: () => undefined,
  provide: (name: string, value: unknown) => {
    provided[name] = value
  },
  effect: (disposer: () => void) => {
    effects.push(disposer)
  },
}
let applyError: unknown
try {
  await hostPlugin.apply(ctx)
} catch (err) {
  applyError = err
}
let rejected: unknown
try {
  const teamRoot = provided.teamRoot as { ready: Promise<unknown> } | undefined
  if (teamRoot !== undefined) {
    await teamRoot.ready
  }
} catch (err) {
  rejected = err
}

describe('@dsh-agent-team/runtime (P1-T4 skeleton)', () => {
  it('exposes the stable runtime identity marker', () => {
    expect(PACKAGE_ID).toBe('runtime')
  })
})

describe('dsh-agent-team host plugin (P8-S5A production entry)', () => {
  it('has the public Cordis composition plugin shape', () => {
    // Plugin.Object contract: a stable display name plus a callable apply,
    // and the inject declaration that parks the row until all three host
    // services (agents, storageDomain, sessionPersistence) exist.
    expect(typeof hostPlugin.name).toBe('string')
    expect(hostPlugin.name).toBe('dsh-agent-team')
    expect(typeof hostPlugin.apply).toBe('function')
    expect(Array.isArray(hostPlugin.inject)).toBe(true)
    expect(hostPlugin.inject).toEqual(['agents', 'storageDomain', 'sessionPersistence'])
  })

  it('never rejects apply: the facade is provided synchronously and the bootstrap failure rejects ready', () => {
    // apply resolved — the rejected-fiber-absorption incident stays fixed:
    expect(applyError === undefined).toBe(true)
    // The `teamRoot` facade IS provided (the observability row injects on
    // it), and exactly one cleanup effect is armed:
    expect('teamRoot' in provided).toBe(true)
    expect(effects.length).toBe(1)
    // ...and the missing row config surfaced through `ready` (duck-typed:
    // the built dist carries its own compiled classes).
    expect(rejected !== undefined).toBe(true)
    const err = rejected as { name?: string; code?: unknown }
    const isTeamPluginError =
      err !== null &&
      typeof err === 'object' &&
      err.name === 'TeamPluginError' &&
      typeof err.code === 'string'
    expect(isTeamPluginError).toBe(true)
    expect(err.code).toBe(TEAM_PLUGIN_ERROR_CODES.TEAM_PLUGIN_CONFIG_INVALID)
  })
})
