/**
 * centre-install.mjs — the ONE place a member agent is wired to the centre.
 *
 * WHY THIS EXISTS. B proved the centre's guarantees on a purpose-built world. A world is not a
 * product: until the product's member setup calls exactly this function, every guarantee is a
 * property of a test double. This module is deliberately the ONLY composition point, so there is no
 * second place where a member could get tools without admission, facts, or settlement.
 *
 * WHAT IT DOES NOT DO. It does not compile policy, mint lanes, or decide anything. The member's
 * ceiling is already compiled by `compileEffectiveIo` upstream; this module maps that compiled answer
 * onto the centre's binding and installs the three observation points.
 *
 * @module packages/runtime/src/plugin/vnext/centre-install
 */

import { installAdmissionPoint } from './admission-port.mjs'
import { installExecutionFacts } from './execution-facts.mjs'
import { createSettlementWriter } from './settlement-port.mjs'

/**
 * Map ONE compiled member policy onto the centre's `Binding`.
 *
 * The lane objects are passed THROUGH, not rebuilt: a second interpretation of a compiled policy is
 * a second policy. Absent axes stay absent (`network` unset is not allow; `process` unset means the
 * generation compiles no subprocess lane, so `process.exec` is refused as unsupported).
 *
 * @param {object} input
 * @param {object} input.member - the compiled realm member (`{ identity, policy }`).
 * @param {string} input.agentId - the runtime agent id the tools execute on.
 * @param {string} input.sessionId - the agent session id.
 * @param {string} input.workspaceRoot - the member's effective workspace.
 * @param {string} [input.owner] - the owning team root session.
 * @returns {object} the binding the admission point resolves per call.
 */
export function bindingFromCompiledMember ({ member, bindings, agentId, sessionId, workspaceRoot, owner }) {
  if (member === undefined || member === null) throw new TypeError('centre-install: a member binding needs the compiled member')
  const policy = member.policy?.value ?? member.policy
  if (policy === undefined || policy === null || typeof policy !== 'object') {
    throw new TypeError('centre-install: the compiled member carries no policy value; a binding without a ceiling is not a binding')
  }
  const identity = member.identity ?? {}
  if (typeof policy.read !== 'object' || policy.read === null || typeof policy.write !== 'object' || policy.write === null) {
    throw new TypeError('centre-install: the compiled policy must carry read and write lanes')
  }
  if (typeof agentId !== 'string' || agentId === '') throw new TypeError('centre-install: agentId is required')
  if (typeof sessionId !== 'string' || sessionId === '') throw new TypeError('centre-install: sessionId is required')
  // The compiled per-tool answers, keyed by the bare tool name. They are passed through as the
  // compiler produced them; a tool with no declared restriction simply has no entry, and the ceiling
  // answers for it.
  const perTool = {}
  for (const binding of Array.isArray(bindings) ? bindings : []) {
    const toolName = binding?.toolName
    const effective = binding?.effective
    if (typeof toolName !== 'string' || toolName === '' || effective === undefined || effective === null) continue
    perTool[toolName] = Object.freeze({
      read: effective.read,
      write: effective.write,
      ...(effective.network === undefined || effective.network === null ? {} : { network: effective.network.access }),
    })
  }
  return Object.freeze({
    agentId,
    sessionId,
    instanceGeneration: identity.instanceGeneration ?? policy.instanceGeneration ?? 0,
    read: policy.read,
    write: policy.write,
    ...(policy.network === undefined ? {} : { network: policy.network.access }),
    workspaceRoot,
    ...(Object.keys(perTool).length === 0 ? {} : { perTool: Object.freeze(perTool) }),
    definitionSource: '@deepseek-ai/dsh-tool-fs',
    policyGeneration: policy.revision ?? '',
    blueprintRevision: identity.blueprintRevision ?? '',
    owner: owner ?? '',
  })
}

/**
 * Install the centre's three observation points on ONE member agent context.
 *
 * Order matters and is not cosmetic: admission decides BEFORE the body, execution facts observe the
 * host's settlement, and the settlement writer publishes the transition. All three share one callId
 * and one executionId, so a fact can always be joined to the decision that authorised it.
 *
 * @param {object} input
 * @param {object} input.ctx - the member agent's Cordis context.
 * @param {object} input.binding - the binding from {@link bindingFromCompiledMember}.
 * @param {(fact: object) => void} input.recordAdmission - durable admission sink.
 * @param {(fact: object) => void} input.recordExecution - durable execution sink.
 * @param {(callId: string) => boolean} [input.isReplay]
 * @param {(input: object) => void} [input.recordReplay]
 * @param {object} [input.grants]
 * @param {object} [input.store] - the product `ExecutionSettlementStore`.
 * @param {(exec: object) => {executionId: string, actorId: string, worldId: string}} input.identityOf
 * @param {(error: unknown, context: object) => void} [input.onFault]
 * @returns {{ dispose: () => void }} the disposer for every installed point.
 */
export function installMemberCentre ({ ctx, binding, resolveBinding, recordAdmission, recordExecution, isReplay, recordReplay, grants, store, identityOf, onFault }) {
  if (ctx === undefined || ctx === null) throw new TypeError('centre-install: a member centre needs the agent context')
  if (typeof recordAdmission !== 'function' || typeof recordExecution !== 'function') {
    throw new TypeError('centre-install: both durable sinks are required; a centre that cannot write a fact is not a centre')
  }
  const settlement = store === undefined
    ? undefined
    : createSettlementWriter({ store, identityOf, ...(onFault === undefined ? {} : { onFault }) })
  // The admission fact is remembered HERE so the execution fact can be joined to the decision that
  // authorised it. One map, one process: it is not a second durable store.
  const admissions = new Map()
  const record = (fact) => {
    // The durable append comes FIRST: an in-memory admission for a fact that was never written would
    // let an execution be joined to a decision no reviewer can find.
    recordAdmission(fact)
    admissions.set(fact.callId, fact)
  }
  const disposers = []
  try {
    disposers.push(installAdmissionPoint({
      ctx,
      resolveBinding: typeof resolveBinding === 'function' ? resolveBinding : () => binding,
      record,
      ...(isReplay === undefined ? {} : { isReplay }),
      ...(recordReplay === undefined ? {} : { recordReplay }),
      ...(grants === undefined ? {} : { grants }),
      ...(settlement === undefined ? {} : { settlement }),
      ...(onFault === undefined ? {} : { onFault }),
    }))
    disposers.push(installExecutionFacts({
      ctx,
      record: recordExecution,
      admissionOf: (callId) => admissions.get(callId),
      ...(identityOf === undefined ? {} : { executionIdOf: (callId) => identityOf({ callId, name: '' }).executionId }),
      ...(settlement === undefined ? {} : {
        onFact: (fact, exec) => {
          if (fact.outcome === 'admission-refusal') {
            // The refusal happened AFTER the record opened (the post-approval recheck). It is terminal:
            // leaving it open would recover as UNKNOWN and report "nobody knows" about a call nobody ran.
            settlement.refused({ exec, code: fact.refusalCode, reason: fact.error?.message ?? fact.errorMessage })
            return
          }
          if (fact.outcome === 'aborted') settlement.stop({ exec, phase: 'in-flight' })
          settlement.settled({ exec, outcome: fact.outcome })
        },
      }),
    }))
  } catch (error) {
    // A half-installed centre is worse than none: roll the installed points back before rethrowing, or
    // a leaked admission point keeps refusing calls for a member the caller believes was never bound.
    for (const dispose of disposers.reverse()) {
      try { dispose() } catch (rollbackError) { if (onFault !== undefined) onFault(rollbackError, { phase: 'rollback' }) }
    }
    throw error
  }
  let disposed = false
  return Object.freeze({
    dispose () {
      // Idempotent: `disposers.reverse()` mutates in place, so a second dispose would re-run every
      // disposer in the opposite order - the kind of double-teardown that hides as a random fault later.
      if (disposed) return
      disposed = true
      for (const dispose of disposers.reverse()) {
        try { dispose() } catch (error) { if (onFault !== undefined) onFault(error, { phase: 'dispose' }) }
      }
    },
  })
}
