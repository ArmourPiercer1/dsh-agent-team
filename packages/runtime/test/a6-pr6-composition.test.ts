import { describe, expect, it } from 'vitest'
import { decideAlpha6Composition } from '../alpha6/composition.js'

const base = {
  enabled: true,
  blueprintDocumentVersion: 5,
  reviewRouting: { enabled: true, officerTemplateId: 'officer' },
  activeMemberTemplateIds: ['worker', 'officer'],
  leaderTemplateId: 'leader',
} as const

describe('A6-PR6 opt-in composition gate', () => {
  it('keeps legacy when the explicit opt-in is absent or false', () => {
    expect(decideAlpha6Composition({ ...base, enabled: false }))
      .toEqual({ mode: 'legacy', reason: 'disabled' })
  })

  it('activates only for v5 + routing.enabled + exactly one Officer', () => {
    expect(decideAlpha6Composition(base)).toEqual({
      mode: 'alpha6', officerTemplateId: 'officer', officerInstanceCount: 1,
    })
  })

  it('refuses v4, disabled routing, Leader-as-Officer and zero/multiple Officers', () => {
    expect(decideAlpha6Composition({ ...base, blueprintDocumentVersion: 4 }))
      .toEqual({ mode: 'refused', refused: 'blueprint-not-v5' })
    expect(decideAlpha6Composition({ ...base, reviewRouting: { enabled: false, officerTemplateId: 'officer' } }))
      .toEqual({ mode: 'refused', refused: 'routing-disabled' })
    expect(decideAlpha6Composition({ ...base, reviewRouting: { enabled: true, officerTemplateId: 'leader' } }))
      .toEqual({ mode: 'refused', refused: 'officer-template-missing' })
    expect(decideAlpha6Composition({ ...base, activeMemberTemplateIds: ['worker'] }))
      .toEqual({ mode: 'refused', refused: 'officer-instance-count' })
    expect(decideAlpha6Composition({ ...base, activeMemberTemplateIds: ['officer', 'officer'] }))
      .toEqual({ mode: 'refused', refused: 'officer-instance-count' })
  })
})
