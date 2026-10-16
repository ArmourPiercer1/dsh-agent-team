/**
 * A5-PR3 (Lane B) — C-FS error closed set: denied / hidden / undetermined.
 *
 * Laws under test (INTERFACES-v1 C-FS):
 *  - the error class set is CLOSED and exactly three;
 *  - every error carries the class + a closed reason in `details`, and its
 *    `code` stays inside the frozen PR0 §5 set (no lane-invented codes);
 *  - a HIDDEN READ is never silent: it is a typed error whose `details`
 *    carry a non-empty diagnostic line;
 *  - `sideEffectUnknown` is only ever TRUE for undetermined effects — the
 *    class is not decoration, it is what later lanes branch on.
 *
 * @module packages/runtime/controlled-fs/test/cf-errors
 */
import { describe, expect, it } from 'vitest'

import {
  GOVERNANCE_ERROR_CODES,
} from '../../../domain/tool-governance/src/index.js'
import {
  CF_DENIED_REASONS,
  CF_ERROR_CLASSES,
  CF_HIDDEN_REASONS,
  CF_UNDETERMINED_REASONS,
  cfsDenial,
  cfsErrorClassOfReason,
  cfsHidden,
  cfsUndetermined,
} from '../src/index.js'

describe('C-FS error closed set', () => {
  it('classes are exactly denied | hidden | undetermined', () => {
    expect([...CF_ERROR_CLASSES]).toEqual(['denied', 'hidden', 'undetermined'])
  })

  it('every reason belongs to exactly one class, and the class lookup is total over reasons', () => {
    const all = [...CF_DENIED_REASONS, ...CF_HIDDEN_REASONS, ...CF_UNDETERMINED_REASONS]
    expect(new Set(all).size).toBe(all.length)
    for (const reason of all) expect(CF_ERROR_CLASSES).toContain(cfsErrorClassOfReason(reason))
  })

  it('denials keep their §5 code inside the frozen PR0 set and carry class+reason in details', () => {
    for (const reason of CF_DENIED_REASONS) {
      const err = cfsDenial(reason, 'test').error
      expect(GOVERNANCE_ERROR_CODES).toContain(err.code)
      expect(err.details?.['cfClass']).toBe('denied')
      expect(err.details?.['cfReason']).toBe(reason)
      expect(err.sideEffectUnknown).not.toBe(true)
    }
  })

  it('hidden-read is typed AND diagnostic — an empty/absent diagnostic cannot be constructed', () => {
    for (const reason of CF_HIDDEN_REASONS) {
      const err = cfsHidden(reason, 'test', 'path withheld from member ts-1/member-b @ probe').error
      expect(err.details?.['cfClass']).toBe('hidden')
      expect(typeof err.details?.['cfDiagnostic']).toBe('string')
      expect((err.details?.['cfDiagnostic'] as string).trim().length).toBeGreaterThan(0)
    }
    expect(() => cfsHidden('hidden-read', 'no diagnostic', '')).toThrow()
  })

  it('undetermined refuses with an honest side-effect flag: writes unknown, reads not', () => {
    const write = cfsUndetermined('exec-time-identity-drift', 'w', { sideEffectPossible: true }).error
    expect(write.details?.['cfClass']).toBe('undetermined')
    expect(write.sideEffectUnknown).toBe(true)
    const read = cfsUndetermined('exec-time-identity-drift', 'r', { sideEffectPossible: false }).error
    expect(read.sideEffectUnknown).not.toBe(true)
  })
})
