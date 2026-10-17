/**
 * a5sr4 — the v3→v4 migration REPORT module (VNEXT-SCHEMA-ADR M-4: "migration
 * report = machine-readable per-field carried/rejected/requires-decision +
 * MIGRATION_PERMISSION_WIDENING refusal; E2: a migration must NEVER widen;
 * exit = (a) read-only report"). The EDIT loop / auto-rewrite is NOT built —
 * that half ships only with the release round.
 *
 * The report consumes REAL documents (v3 source, proposed v4), not a bespoke
 * fixture envelope, so what the NEG suite drives (a5sr5 N-M01…M05) is the
 * shipped decision surface, not a mirror.
 *
 * @module test/a5sr4-migration-report
 */
import { describe, expect, it } from 'vitest'
import { planBlueprintV3toV4Migration } from '../blueprint/src/index.js'

function v3Doc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 3,
    blueprintId: 'team.min',
    revision: '1',
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    ...overrides,
  }
}

function v4Doc(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return v3Doc({ schemaVersion: 4, ...overrides })
}

const BASH_ALLOW = {
  owner: 'dsh.shell',
  name: 'bash',
  authorization: 'allow',
  io: {
    read: { mode: 'restricted', allow: ['.'], ask: [], deny: [] },
    write: { mode: 'restricted', allow: [], ask: [], deny: [] },
    network: { mode: 'allow' },
  },
  execution: { implementationOrigin: 'dsh-native', executionBoundary: 'trusted-host' },
}

describe('a5sr4 identity migration — v3 face carries 1:1, governance stays undeclared', () => {
  it('a bare v3 source reports EVERY field carried, nothing rejected, no decision owed, zero widening', () => {
    const report = planBlueprintV3toV4Migration(v3Doc())
    expect(report.verdict).toBe('accept')
    expect(report.requiresDecision).toBe(false)
    expect(report.permissionWidening).toBe(false)
    const carried = report.fields.filter((f) => f.verdict === 'carried').map((f) => f.path)
    for (const key of ['$.teamHardEnvelope', '$.permissionMutationEnvelope', '$.policyStates', '$.metadata']) {
      expect(carried).toContain(key)
    }
    expect(report.fields.filter((f) => f.verdict === 'rejected')).toEqual([])
  })

  it('a source that is not a valid v3 document reports rejected at the failing path (never half-migrated)', () => {
    const report = planBlueprintV3toV4Migration(v3Doc({ teamHardEnvelope: undefined }))
    expect(report.verdict).toBe('reject')
    expect(report.ok).toBe(false)
    expect(report.fields.some((f) => f.verdict === 'rejected')).toBe(true)
  })
})

describe('a5sr4 permission-widening refusals (E2) — the migrator has NO authority to widen', () => {
  it('N-M02: a proposed envelope CONTENT that differs from the bound source rejects with MIGRATION_PERMISSION_WIDENING', () => {
    const proposed = v4Doc({
      teamHardEnvelope: {
        rules: [{ operationClass: 'write', matcher: { kind: 'subtree', path: 'src/**' }, maximumEffect: 'allow' }],
      },
    })
    const report = planBlueprintV3toV4Migration(v3Doc(), proposed)
    expect(report.verdict).toBe('reject')
    expect(report.code).toBe('MIGRATION_PERMISSION_WIDENING')
    expect(report.permissionWidening).toBe(true)
  })

  it('N-M01: a produced toolBindings entry granting allow where v3 had no fact => requires-decision (never silent allow)', () => {
    const report = planBlueprintV3toV4Migration(v3Doc(), v4Doc({ toolBindings: [BASH_ALLOW] }))
    expect(report.verdict).toBe('report-requires-decision')
    expect(report.requiresDecision).toBe(true)
    expect(report.permissionWidening).toBe(true)
    expect(report.fields.some((f) => f.code === 'MIGRATION_PERMISSION_WIDENING' && f.verdict === 'requires-decision')).toBe(true)
  })

  it('N-M04: an applied compat-default rule producing a WIDE value rejects (no compat-default→wide mapping may exist)', () => {
    const report = planBlueprintV3toV4Migration(v3Doc(), v4Doc({ toolBindings: [BASH_ALLOW] }), {
      appliedRules: ['compat-default'],
    })
    expect(report.verdict).toBe('reject')
    expect(report.code).toBe('MIGRATION_PERMISSION_WIDENING')
  })

  it('N-M05: a proposed document that silently drops a carried source field requires a decision (narrowing is legal but loud)', () => {
    const source = v3Doc({ metadata: { owner: 'team-a' } })
    const proposed = v4Doc({ metadata: {} })
    const report = planBlueprintV3toV4Migration(source, proposed)
    expect(report.verdict).toBe('report-requires-decision')
    expect(report.fields.some((f) => f.path === '$.metadata' && f.verdict === 'requires-decision')).toBe(true)
  })

  it('N-M03: a proposed document carrying a v4-unknown top-level field rejects as rejected-field (validator verdict, not opinion)', () => {
    const report = planBlueprintV3toV4Migration(v3Doc(), v4Doc({ reviewerTier: 5 }))
    expect(report.verdict).toBe('reject')
    expect(report.fields.some((f) => f.verdict === 'rejected')).toBe(true)
  })

  it('an identical-content v4 proposal (governance undeclared) is the clean accept path', () => {
    const report = planBlueprintV3toV4Migration(v3Doc(), v4Doc())
    expect(report.verdict).toBe('accept')
    expect(report.permissionWidening).toBe(false)
  })
})
