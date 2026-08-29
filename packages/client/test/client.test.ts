import { describe, expect, it } from 'vitest'

import { PACKAGE_ID } from '../src/index.js'
import * as clientPlugin from '../src/plugin/client.js'
import type { TeamPluginClientContext } from '../src/plugin/client.js'

describe('@dsh-agent-team/client (P1-T4 skeleton)', () => {
  it('exposes the stable client identity marker', () => {
    expect(PACKAGE_ID).toBe('client')
  })
})

describe('dsh-agent-team client plugin (P1-T4 empty skeleton)', () => {
  it('has the public Cordis composition plugin shape', () => {
    // Plugin.Object contract: a stable display name plus a callable apply.
    expect(typeof clientPlugin.name).toBe('string')
    expect(clientPlugin.name).toBe('dsh-agent-team-client')
    expect(typeof clientPlugin.apply).toBe('function')
  })

  it('apply is side-effect-free on a minimal structural context', () => {
    const listeners: string[] = []
    const effects: Array<() => void> = []
    const ctx: TeamPluginClientContext = {
      get: () => undefined,
      on: (event) => {
        listeners.push(event)
        return () => {}
      },
      effect: (disposer) => {
        effects.push(disposer)
      },
    }

    expect(() => clientPlugin.apply(ctx)).not.toThrow()
    expect(listeners).toEqual([])
    expect(effects).toEqual([])
  })
})
