/**
 * `ToolBinding` and its assembly state machine (design §4.1, plan §3).
 *
 * THE MACHINE (design §4.1, verbatim order):
 *
 *   UNBOUND → PREPARING → ACTIVE → DRAINING → TOMBSTONED → RELEASED
 *
 *  - PREPARING: mask first, Guard first, Dispatcher last; ANY failure means
 *    the Agent is NOT published (`PREPARING → UNBOUND` is the only back-edge);
 *  - ACTIVE: the ToolDefinition shape stays stable, internals flip immutable
 *    Binding Revisions — never "unload first and let the name fall back";
 *  - DRAINING: no new operations, no new Asks; in-flight calls are cancelled/
 *    drained; masks and the trusted-identity tombstone STAY (NEG-1: lifting
 *    the mask before the in-flight body settles lets the native body run);
 *  - TOMBSTONED: stale references to the old Agent object keep meeting a
 *    final refusal for the Team-trusted identity;
 *  - RELEASED: only after every in-flight Body/ExecutionLease settled with
 *    evidence. Terminal.
 *
 * The refusal is TYPED (`state-transition`), never a throw: a wrong teardown
 * order is a governance fact the caller must see and record.
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/domain/tool-governance/binding
 */

import { parseAssuranceContract, type AssuranceContract, type ExecutionBoundary, type ImplementationOrigin } from './assurance.js'
import {
  closeRecordKeys,
  finish,
  isRecord,
  reqNonNegativeInt,
  reqString,
  type ParseResult,
  type ProblemSink,
} from './parse-util.js'

/** The binding states, in assembly order (design §4.1). */
export const BINDING_STATES = ['UNBOUND', 'PREPARING', 'ACTIVE', 'DRAINING', 'TOMBSTONED', 'RELEASED'] as const

/** One binding state. */
export type BindingState = (typeof BINDING_STATES)[number]

/** The legal transitions. Anything else (e.g. ACTIVE←DRAINING, UNBOUND→ACTIVE) is refused. */
export const BINDING_TRANSITIONS: Readonly<Record<BindingState, readonly BindingState[]>> = Object.freeze({
  UNBOUND: Object.freeze(['PREPARING'] as const),
  PREPARING: Object.freeze(['ACTIVE', 'UNBOUND'] as const),
  ACTIVE: Object.freeze(['DRAINING'] as const),
  DRAINING: Object.freeze(['TOMBSTONED'] as const),
  TOMBSTONED: Object.freeze(['RELEASED'] as const),
  RELEASED: Object.freeze([] as const),
})

/** One immutable binding revision (design §4.2). */
export interface ToolBinding {
  readonly bindingId: string
  /** The trusted Team Agent / Scope key the binding belongs to. */
  readonly agentScopeKey: string
  /** The executable tool name the binding routes. */
  readonly toolName: string
  /** The identity of the registered ToolDefinition shape (stable at ACTIVE). */
  readonly definitionIdentity: string
  readonly providerId: string
  readonly implementationOrigin: ImplementationOrigin
  readonly executionBoundary: ExecutionBoundary
  readonly assurance: AssuranceContract
  /** Policy generation the binding was validated against. */
  readonly policyGeneration: number
  /** Authority generation the binding was validated against. */
  readonly authorityGeneration: number
  /** Immutable revision counter (flipped, never mutated in place). */
  readonly revision: number
  readonly status: BindingState
}

/** A binding advance outcome — typed, never thrown. */
export type BindingAdvance =
  | { readonly ok: true; readonly binding: ToolBinding }
  | { readonly ok: false; readonly problems: readonly [{ readonly code: 'state-transition'; readonly path: string; readonly detail: string }] }

/** Strictly parse one raw binding; the three dimensions must be CONSISTENT. */
export function parseToolBinding(raw: unknown): ParseResult<ToolBinding> {
  const problems: ProblemSink = []
  if (!isRecord(raw)) {
    return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'a ToolBinding must be a record' }] }
  }
  closeRecordKeys(
    raw,
    [
      'bindingId',
      'agentScopeKey',
      'toolName',
      'definitionIdentity',
      'providerId',
      'implementationOrigin',
      'executionBoundary',
      'assurance',
      'policyGeneration',
      'authorityGeneration',
      'revision',
      'status',
    ],
    '$',
    problems,
  )
  const bindingId = reqString(raw, 'bindingId', '$', problems)
  const agentScopeKey = reqString(raw, 'agentScopeKey', '$', problems)
  const toolName = reqString(raw, 'toolName', '$', problems)
  const definitionIdentity = reqString(raw, 'definitionIdentity', '$', problems)
  const providerId = reqString(raw, 'providerId', '$', problems)
  const implementationOrigin = raw['implementationOrigin']
  const executionBoundary = raw['executionBoundary']
  const policyGeneration = reqNonNegativeInt(raw, 'policyGeneration', '$', problems)
  const authorityGeneration = reqNonNegativeInt(raw, 'authorityGeneration', '$', problems)
  const revision = reqNonNegativeInt(raw, 'revision', '$', problems)
  const statusRaw = raw['status']
  if (typeof statusRaw !== 'string' || !(BINDING_STATES as readonly string[]).includes(statusRaw)) {
    problems.push({ code: 'value-outside-closed-set', path: '$.status', detail: `status must be one of ${BINDING_STATES.join(' | ')}` })
  }
  const assuranceResult = parseAssuranceContract(raw['assurance'])
  if (!assuranceResult.ok) {
    problems.push(...assuranceResult.problems.map((p) => ({ ...p, path: `$.assurance${p.path === '$' ? '' : p.path.slice(1)}` })))
  } else {
    // THREE independent dimensions — but one binding's origin/boundary fields
    // and the assurance contract's may not disagree about the same binding.
    if (assuranceResult.value.implementationOrigin !== implementationOrigin) {
      problems.push({ code: 'contradiction', path: '$.assurance.implementationOrigin', detail: 'the binding and its assurance contract disagree about implementationOrigin' })
    }
    if (assuranceResult.value.executionBoundary !== executionBoundary) {
      problems.push({ code: 'contradiction', path: '$.assurance.executionBoundary', detail: 'the binding and its assurance contract disagree about executionBoundary' })
    }
  }
  return finish(problems, () => ({
    bindingId: bindingId as string,
    agentScopeKey: agentScopeKey as string,
    toolName: toolName as string,
    definitionIdentity: definitionIdentity as string,
    providerId: providerId as string,
    implementationOrigin: implementationOrigin as ToolBinding['implementationOrigin'],
    executionBoundary: executionBoundary as ToolBinding['executionBoundary'],
    assurance: assuranceResult.ok ? assuranceResult.value : ({} as AssuranceContract),
    policyGeneration: policyGeneration as number,
    authorityGeneration: authorityGeneration as number,
    revision: revision as number,
    status: statusRaw as BindingState,
  }))
}

/**
 * Advance one binding along the §4.1 machine. Illegal orders (the NEG-1
 * family: unmask-before-drain, release-with-in-flight, re-activate-from-
 * draining) come back as a typed `state-transition` refusal.
 */
export function advanceBindingStatus(binding: ToolBinding, to: BindingState): BindingAdvance {
  const allowed: readonly BindingState[] = BINDING_TRANSITIONS[binding.status]
  if (!allowed.includes(to)) {
    return {
      ok: false,
      problems: [
        {
          code: 'state-transition',
          path: '$.status',
          detail: `'${binding.status}' may only advance to: ${allowed.join(', ') || 'none'}`,
        },
      ],
    }
  }
  return { ok: true, binding: Object.freeze({ ...binding, status: to }) }
}
