/**
 * a5p2-kernel-harness.ts — one honest assembly for the PR2 kernel tests.
 * NOT a test file. Everything a production assembly would supply (clock,
 * generations, documents, ledger, probe) arrives HERE, and the port spies
 * count what actually ran — "body = 0 / zero side effects" claims are only
 * worth their gate with counters in the room.
 *
 * @module test/a5p2-kernel-harness
 */
import type { ToolPolicyDocument } from '../../domain/tool-governance/src/index.js'
import type { Effect } from '../../domain/tool-governance/src/index.js'
import type { AuthorityEnvelopeDocuments } from '../governance/authority-ceiling.js'
import type { RuntimeAuthority } from '../governance/runtime-authority.js'
import { createAdmissionKernel, createGrantLedger, createStubAssuranceProbe, type AdmissionKernel, type AssuranceProbe, type GrantLedger, type RequiredAssuranceReader } from '../tool-admission/index.js'
import { parseToolPolicyDocument, type RequestedEffectSet } from '../../domain/tool-governance/src/index.js'
import { scopeResource } from './a5p2-fixtures.js'

/** Default finite wall clock; tests override with hostile values on purpose. */
export const FIXED_NOW = 1_737_000_000_000

/** A hard envelope that exists but narrows nothing; no mutation envelope. */
export function emptyHardDocs(): AuthorityEnvelopeDocuments {
  return { teamHardEnvelope: { rules: [] }, permissionMutationEnvelope: { status: 'absent' } }
}
export function absentDocs(): AuthorityEnvelopeDocuments {
  return { teamHardEnvelope: { status: 'absent' }, permissionMutationEnvelope: { status: 'absent' } }
}
export function hardRulesDocs(rules: ReadonlyArray<{ operationClass: string; resource: string; maximumEffect: 'deny' | 'ask' | 'allow' }>): AuthorityEnvelopeDocuments {
  return {
    teamHardEnvelope: { rules: rules.map((r) => ({ operationClass: r.operationClass, matcher: { kind: 'exact' as const, resource: r.resource }, maximumEffect: r.maximumEffect })) },
    permissionMutationEnvelope: { status: 'absent' },
  }
}
/** Rules in the LEADER-bound expansion envelope (ADR A5-1: it binds the
 *  Leader only — a Human User is not narrowed by it). */
export function mutationRulesDocs(rules: ReadonlyArray<{ operationClass: string; resource: string; maximumEffect: 'deny' | 'ask' | 'allow' }>): AuthorityEnvelopeDocuments {
  return {
    teamHardEnvelope: { rules: [] },
    permissionMutationEnvelope: { rules: rules.map((r) => ({ operationClass: r.operationClass, matcher: { kind: 'exact' as const, resource: r.resource }, maximumEffect: r.maximumEffect })) },
  }
}

/** A policy document that AUTHORIZES exactly these effects (expansion allow). */
export function allowPolicy(set: RequestedEffectSet): ToolPolicyDocument {
  const parsed = parseToolPolicyDocument({
    rules: set.effects.map((effect: Effect) => ({
      realmId: effect.resource === null ? 'realm-a' : effect.resource.realmId,
      effectKind: effect.kind,
      matcher: { kind: 'exact', resource: scopeResource(effect) },
      maximumEffect: 'allow',
    })),
  })
  if (!parsed.ok) throw new Error(`harness policy rejected: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}
/** The empty policy: authorizes nothing (every effect lands `no-authority`). */
export function emptyPolicy(): ToolPolicyDocument {
  return { rules: [] }
}

/** Port counters — the machine-readable half of every "body=0" claim. */
export interface PortSpies {
  probeCalls: number
  registrations: number
  consumptions: number
  /** Ordered trace of the side-effecting edges (gate ordering pins). */
  sequence: string[]
}
export function recordPorts(): PortSpies {
  return { probeCalls: 0, registrations: 0, consumptions: 0, sequence: [] }
}

export interface HarnessOptions {
  readonly clock?: () => number
  readonly authorityGeneration?: () => number
  readonly documents?: () => AuthorityEnvelopeDocuments
  readonly policy?: () => ToolPolicyDocument
  readonly probe?: AssuranceProbe
  readonly ledger?: GrantLedger
  readonly ports?: PortSpies
  readonly beneficiary?: RuntimeAuthority
  readonly requiredAssurance?: RequiredAssuranceReader
  readonly grantExpiry?: (issuedAt: number) => number | null
  readonly onObserve?: (event: Readonly<Record<string, unknown>> & { readonly event: string }) => void
}

export interface Harness {
  readonly kernel: AdmissionKernel
  readonly ledger: GrantLedger
  readonly ports: PortSpies
}

/** Build a kernel over an instrumented ledger + probe. */
export function makeHarness(options: HarnessOptions = {}): Harness {
  const ledger = options.ledger ?? createGrantLedger()
  const ports = options.ports ?? recordPorts()
  const innerProbe = options.probe ?? createStubAssuranceProbe({})
  const probe: AssuranceProbe = (binding, dimension) => {
    ports.probeCalls += 1
    ports.sequence.push(`probe:${dimension}`)
    return innerProbe(binding, dimension)
  }
  const instrumented: GrantLedger = {
    register: (grant) => {
      const r = ledger.register(grant)
      if (r.ok) {
        ports.registrations += 1
        ports.sequence.push('register')
      }
      return r
    },
    consume: (grantId, call) => {
      const r = ledger.consume(grantId, call)
      if (r.ok) {
        ports.consumptions += 1
        ports.sequence.push('consume')
      }
      return r
    },
    view: ledger.view,
    consumedCount: () => ledger.consumedCount(),
  }
  const kernel = createAdmissionKernel({
    clock: options.clock ?? (() => FIXED_NOW),
    authorityGeneration: options.authorityGeneration ?? (() => 1),
    documents: options.documents ?? emptyHardDocs,
    policyDocument: options.policy ?? emptyPolicy,
    beneficiaryAuthority: options.beneficiary ?? 'member',
    assuranceProbe: probe,
    requiredAssurance: options.requiredAssurance ?? (() => ({})),
    ledger: instrumented,
    ...(options.grantExpiry === undefined ? {} : { grantExpiry: options.grantExpiry }),
    ...(options.onObserve === undefined ? {} : { onObserve: options.onObserve }),
  })
  return { kernel, ledger, ports }
}
