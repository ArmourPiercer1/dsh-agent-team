/**
 * a5p2-fixtures.ts — shared builders for the Alpha.5 PR2 lane tests
 * (admission clock / assurance probe / approval case / grant one-shot /
 * kernel / composition). NOT a test file; imported by `a5p2-*.test.ts`.
 *
 * Everything is built through the PR0 PARSERS (REUSE: a fixture that hand-
 * casts a grant or an effect set would be testing a shape the frozen grammar
 * rejects).
 *
 * @module test/a5p2-fixtures
 */
import {
  parseRequestedEffectSet,
  parseToolBinding,
  parseToolPolicyDocument,
  type AssuranceContract,
  type AssuranceDimension,
  type AssuranceDimensionRecord,
  type AssuranceLevel,
  type Effect,
  type RequestedEffectSet,
  type ToolBinding,
  type ToolPolicyDocument,
} from '../../domain/tool-governance/src/index.js'

export const REALM = 'realm-a'
export const OTHER_REALM = 'realm-b'
export const MEMBER = { teamSessionId: 'ts-1', instanceId: 'inst-2' }
export const LEADER_MEMBER = { teamSessionId: 'ts-1', instanceId: 'inst-leader' }

export function readEffect(locator = 'data/a.txt', realm = REALM): Effect {
  return { kind: 'read', resource: { realmId: realm, kind: 'workspace', canonicalLocator: locator, rights: ['read'] } }
}
export function writeEffect(locator = 'data/b.txt', realm = REALM): Effect {
  return { kind: 'write', resource: { realmId: realm, kind: 'workspace', canonicalLocator: locator, rights: ['write'] } }
}
export function listEffect(locator = 'data', realm = REALM): Effect {
  return { kind: 'list', resource: { realmId: realm, kind: 'directory', canonicalLocator: locator, rights: ['list'] } }
}
export function connectEffect(locator = 'https://api.example.test/v1', realm = REALM): Effect {
  return { kind: 'connect', resource: { realmId: realm, kind: 'network-destination', canonicalLocator: locator, rights: ['connect'] } }
}
export function toolInvokeEffect(toolName = 'bash'): Effect {
  return { kind: 'tool-invoke', toolName, resource: null }
}
export function domainRefEffect(domainAuthorityId = 'hpc-cas'): Effect {
  return { kind: 'domain-ref', domainAuthorityId, resource: null }
}

/** Canonicalize through the frozen parser; the fixture is invalid if this fails. */
export function effects(...raw: unknown[]): RequestedEffectSet {
  const parsed = parseRequestedEffectSet(raw)
  if (!parsed.ok) throw new Error(`fixture effect set rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

export function effectOnly(effect: Effect): RequestedEffectSet {
  return effects(effect)
}

/** One full §2.1 dimension record (all five fields stated). */
export function dimensionRecord(
  level: AssuranceLevel,
  over: Partial<AssuranceDimensionRecord> = {},
): AssuranceDimensionRecord {
  const real = level === 'enforced' || level === 'author-trusted'
  return {
    level,
    mechanism: over.mechanism !== undefined ? over.mechanism : real ? 'landlock-abi4-selflock' : null,
    realmId: over.realmId ?? REALM,
    trustRoot: over.trustRoot !== undefined ? over.trustRoot : real ? 'os:kernel-6.12' : null,
    evidence: over.evidence !== undefined ? over.evidence : real ? 'evidence/a5p4/probe.json' : null,
  }
}

/** An assurance contract with EVERY dimension stated at `level` (PR0 law). */
export function assuranceContract(
  per: Partial<Record<AssuranceDimension, AssuranceDimensionRecord>>,
  levels: Partial<Record<AssuranceDimension, AssuranceLevel>> = {},
  origin: AssuranceContract['implementationOrigin'] = 'team-trusted-extension',
  boundary: AssuranceContract['executionBoundary'] = 'confined-subprocess',
): AssuranceContract {
  const dimensions = ['content-read', 'directory-metadata', 'write', 'alias', 'network-destination', 'inherit-cancel'] as const
  const assurance = {} as Record<AssuranceDimension, AssuranceDimensionRecord>
  for (const d of dimensions) {
    assurance[d] = per[d] ?? dimensionRecord(levels[d] ?? 'untested')
  }
  return { implementationOrigin: origin, executionBoundary: boundary, assurance }
}

/** The probe-confirmed record for one dimension (stub probe input). */
export function observed(over: Partial<{ mechanism: string; realmId: string; trustRoot: string; evidence: string }> = {}) {
  return {
    mechanism: over.mechanism ?? 'landlock-abi4-selflock',
    realmId: over.realmId ?? REALM,
    trustRoot: over.trustRoot ?? 'os:kernel-6.12',
    evidence: over.evidence ?? 'evidence/a5p4/probe.json',
  }
}

export function binding(over: Partial<ToolBinding> = {}, contract?: AssuranceContract): ToolBinding {
  const assurance = contract ?? assuranceContract({})
  const parsed = parseToolBinding({
    bindingId: 'bind-bash-1',
    agentScopeKey: 'session-m1',
    toolName: 'bash',
    definitionIdentity: 'def:bash',
    providerId: 'team-adapter',
    implementationOrigin: assurance.implementationOrigin,
    executionBoundary: assurance.executionBoundary,
    assurance,
    policyGeneration: 1,
    authorityGeneration: 1,
    revision: 1,
    status: 'ACTIVE',
    ...over,
  })
  if (!parsed.ok) throw new Error(`fixture binding rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/** Realm-scoped tool-policy document (the EXPANSION-plane family). */
export function policyDoc(rules: ReadonlyArray<{
  effectKind: string
  resource: string
  maximumEffect: 'deny' | 'ask' | 'allow'
  matcherKind?: 'exact' | 'subtree'
  realmId?: string
}>): ToolPolicyDocument {
  const parsed = parseToolPolicyDocument({
    rules: rules.map((r) => ({
      realmId: r.realmId ?? REALM,
      effectKind: r.effectKind,
      matcher: { kind: r.matcherKind ?? 'exact', resource: r.resource },
      maximumEffect: r.maximumEffect,
    })),
  })
  if (!parsed.ok) throw new Error(`fixture policy document rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

/** Realm-qualified matcher resource spelling used by the lane (kept in ONE
 *  place so tests and lane agree exactly like the assembly would). */
export function scopeResource(effect: Effect, realm = REALM): string {
  if (effect.kind === 'tool-invoke') return `${realm}|tool:${effect.toolName}`
  if (effect.kind === 'domain-ref') return `${realm}|domain:${effect.domainAuthorityId}`
  return `${effect.resource.realmId}|${effect.resource.canonicalLocator}`
}
