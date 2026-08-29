import { describe, expect, it } from 'vitest'

import { PACKAGE_ID } from '../src/index.js'

describe('@dsh-agent-team/storage (P1-T4 skeleton)', () => {
  it('exposes the stable storage identity marker', () => {
    expect(PACKAGE_ID).toBe('storage')
  })

  it('identity marker is a non-empty string', () => {
    expect(typeof PACKAGE_ID).toBe('string')
    expect(PACKAGE_ID.length).toBeGreaterThan(0)
  })
})
