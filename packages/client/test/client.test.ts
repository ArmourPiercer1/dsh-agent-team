/**
 * P9-T9 (P9-S6) client plugin identity/shape test.
 *
 * Imports ONLY from `src/plugin/team-mount-core.js` — never from
 * `src/plugin/client.js`: the glue value-imports the three `.tsx`
 * components and the plain-node runner (executes `.test.ts` only, no
 * `.tsx`/`.css` resolution) cannot load that module graph. The glue's
 * `apply` wrapper is covered by the full-face type check and the build.
 */
import { describe, expect, it } from 'vitest'

import { PACKAGE_ID } from '../src/index.js'
import {
  applyTeamMount,
  inject,
  name,
} from '../src/plugin/team-mount-core.js'

describe('@dsh-agent-team/client (P9-T9 mount)', () => {
  it('exposes the stable client identity marker', () => {
    expect(PACKAGE_ID).toBe('client')
  })
})

describe('dsh-agent-team client plugin (P9-T9 mount core)', () => {
  it('has the public Cordis composition plugin shape', () => {
    // Plugin.Object contract: a stable display name, the injected service
    // list, and a callable apply (the glue's `apply` delegates here).
    expect(typeof name).toBe('string')
    expect(name).toBe('dsh-agent-team-client')
    expect(Array.isArray(inject)).toBe(true)
    expect(inject).toEqual(['slots', 'locale', 'sessions', 'connection', 'remote', 'remote.agentPresets'])
    expect(typeof applyTeamMount).toBe('function')
  })
})
