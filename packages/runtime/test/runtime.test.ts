import { describe, expect, it } from 'vitest'

import { PACKAGE_ID } from '../src/index.js'
import * as hostPlugin from '../src/plugin/host.js'
import type { TeamPluginHostContext } from '../src/plugin/host.js'

describe('@dsh-agent-team/runtime (P1-T4 skeleton)', () => {
  it('exposes the stable runtime identity marker', () => {
    expect(PACKAGE_ID).toBe('runtime')
  })
})

describe('dsh-agent-team host plugin (P1-T4 empty skeleton)', () => {
  it('has the public Cordis composition plugin shape', () => {
    // Plugin.Object contract: a stable display name plus a callable apply.
    expect(typeof hostPlugin.name).toBe('string')
    expect(hostPlugin.name).toBe('dsh-agent-team')
    expect(typeof hostPlugin.apply).toBe('function')
  })

  it('apply is side-effect-free on a minimal structural context', () => {
    const listeners: string[] = []
    const effects: Array<() => void> = []
    const ctx: TeamPluginHostContext = {
      get: () => undefined,
      on: (event) => {
        listeners.push(event)
        return () => {}
      },
      effect: (disposer) => {
        effects.push(disposer)
      },
    }

    expect(() => hostPlugin.apply(ctx)).not.toThrow()
    expect(listeners).toEqual([])
    expect(effects).toEqual([])
  })
})
