/**
 * a5p4-realm-evidence — the realm/trustRoot evidence surface (PR4 plan: the
 * real-probe evidence / realmId / trustRoot check must run BEFORE any
 * hard-profile acceptance — COORDINATION PR2-freeze item (ii) and the PR0
 * review M-1 cross-law). THIS lane ships the evidence interface plus the
 * negative controls; it does NOT enable hard profiles (the enablement
 * constant stays false and is pinned).
 *
 * @module packages/runtime/test/a5p4-realm-evidence.test
 */

import { describe, expect, it } from 'vitest'
import {
  HARD_PROFILE_ENABLED,
  recordLegEvidence,
  verifyHardProfileEvidence,
  type ProviderProbeEvidence,
} from '../sandbox-provider/realm-evidence.js'
import type { ProcessCapabilityRow } from '../sandbox-provider/contract-stub.js'

const realmA = 'realm-a5p4-alpha'
const TRUST = 'git:alpha5-pr4-prov:sandbox-provider/launcher'

function row(over: Partial<ProcessCapabilityRow>): ProcessCapabilityRow {
  return {
    dimension: 'content-read',
    level: 'enforced',
    mechanism: 'landlock v4 entry self-lock (bare syscall 444/445/446)',
    realmId: realmA,
    trustRoot: TRUST,
    evidence: 'evidence://a5p4/leg-selective',
    note: '',
    ...over,
  }
}

function evidence(over: Partial<ProviderProbeEvidence>): ProviderProbeEvidence {
  return {
    realmId: realmA,
    trustRoot: TRUST,
    abiVersion: 4,
    legs: [
      recordLegEvidence('selective', 'ENFORCE-CONFIRMED', 'evidence://a5p4/leg-selective', ['--enforce-leg', 'selective']),
      recordLegEvidence('denyall', 'ENFORCE-CONFIRMED', 'evidence://a5p4/leg-denyall', ['--enforce-leg', 'denyall']),
    ],
    capabilities: [row({ dimension: 'content-read' }), row({ dimension: 'write' })],
    ...over,
  }
}

describe('a5p4 hard-profile evidence gate (negative controls)', () => {
  it('the lane ships the gate DISABLED and nothing flips it here', () => {
    expect(HARD_PROFILE_ENABLED).toBe(false)
  })

  it('a complete real evidence set is ACCEPTED by the verifier (as an evaluation, while enablement stays off)', () => {
    const r = verifyHardProfileEvidence(evidence({}), { realmId: realmA, hardDimensions: ['content-read', 'write'] })
    expect(r.ok).toBe(true)
  })

  it('refuses enforced-claimed-but-null-mechanism (the M-1 cross-law at runtime)', () => {
    const r = verifyHardProfileEvidence(
      evidence({ capabilities: [row({ mechanism: null })] }),
      { realmId: realmA, hardDimensions: ['content-read'] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toContain('mechanism')
  })

  it('refuses an evidence ref that resolves to NO recorded leg (fabrication guard)', () => {
    const r = verifyHardProfileEvidence(
      evidence({ capabilities: [row({ evidence: 'evidence://a5p4/never-recorded' })] }),
      { realmId: realmA, hardDimensions: ['content-read'] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.code).toBe('IO_POLICY_UNSUPPORTED')
  })

  it('refuses an empty realmId or a realm-confused claim', () => {
    const r1 = verifyHardProfileEvidence(evidence({ realmId: '  ' }), { realmId: '  ', hardDimensions: ['content-read'] })
    expect(r1.ok).toBe(false)
    const r2 = verifyHardProfileEvidence(evidence({}), { realmId: 'realm-other', hardDimensions: ['content-read'] })
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.error.message.toLowerCase()).toContain('realm')
  })

  it('refuses null trustRoot for a hard dimension (author-trusted code must NAME its root)', () => {
    const r = verifyHardProfileEvidence(evidence({ trustRoot: null, capabilities: [row({ trustRoot: null })] }), {
      realmId: realmA, hardDimensions: ['content-read'],
    })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toContain('trustRoot')
  })

  it('any leg verdict other than ENFORCE-CONFIRMED (or the DEMO discriminator) taints every hard claim', () => {
    const r = verifyHardProfileEvidence(
      evidence({ legs: [...evidence({}).legs, recordLegEvidence('denyall', 'MIXED/FAILED', 'evidence://a5p4/leg-denyall', [])] }),
      { realmId: realmA, hardDimensions: ['content-read'] },
    )
    expect(r.ok).toBe(false)
  })

  it('a hard dimension with NO capability row at all is refused (missing ≠ untested-by-omission)', () => {
    const r = verifyHardProfileEvidence(evidence({ capabilities: [] }), { realmId: realmA, hardDimensions: ['content-read'] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toContain('content-read')
  })

  it('a capability row claiming enforced with level below demand demotes to refusal (partial never satisfies hard)', () => {
    const r = verifyHardProfileEvidence(
      evidence({ capabilities: [row({ level: 'partial' })] }),
      { realmId: realmA, hardDimensions: ['content-read'] },
    )
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error.message).toContain('partial')
  })
})
