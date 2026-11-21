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
/** The compiled generation, or a refusal: a binding without one cannot be rechecked against anything. */
function requireGeneration (identity, policy, member) {
  const generation = identity.instanceGeneration ?? policy.instanceGeneration ?? member.instanceGeneration
  if (!Number.isInteger(generation) || generation < 0) {
    throw new TypeError('centre-install: the compiled member carries no instance generation; a binding that cannot name its generation cannot be rechecked')
  }
  return generation
}

export function bindingFromCompiledMember ({ member, bindings, agentId, sessionId, workspaceRoot, owner, instanceId }) {
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
    // No default generation. A binding that cannot name the generation it was compiled for cannot be
    // compared against a later one at the recheck, so `0` would make every revocation look like a match.
    instanceGeneration: requireGeneration(identity, policy, member),
    ...(instanceId !== undefined ? { instanceId: String(instanceId) } : identity.instanceId === undefined ? {} : { instanceId: String(identity.instanceId) }),
    read: policy.read,
    write: policy.write,
    ...(policy.network === undefined ? {} : { network: policy.network.access }),
    workspaceRoot,
    ...(Object.keys(perTool).length === 0 ? {} : { perTool: Object.freeze(perTool) }),
    // NOT a hardcoded package name: the compiled member names where its definitions came from when it
    // knows, and '' means "no single source" (the tools come from several modules) rather than a guess.
    definitionSource: typeof member.definitionSource === 'string' ? member.definitionSource : '',
    // THE AUTHORING REFERENCE the trusted member identity is projected from. A grant binds a complete
    // (`teamId` / `memberInstanceId` / `templateId` / `instanceGeneration`) identity; without the
    // template the projection is incomplete and the centre refuses to mint (ADMISSION_MEMBER_UNIDENTIFIED)
    // rather than inventing one.
    ...(typeof policy.templateId === 'string' && policy.templateId.trim() !== ''
      ? { templateId: policy.templateId }
      : typeof identity.templateId === 'string' && identity.templateId.trim() !== ''
        ? { templateId: identity.templateId }
        : {}),
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
 * @param {object} [input.approvals] - the durable approval authority (`createControlApprovalPort`); an
 *   ask with a binder but no approval authority is refused, never self-approved.
 * @param {object} [input.store] - the product `ExecutionSettlementStore`.
 * @param {(exec: object) => {executionId: string, actorId: string, worldId: string}} input.identityOf
 * @param {(error: unknown, context: object) => void} [input.onFault]
 * @returns {{ dispose: () => void, close: () => void }} `dispose` REMOVES every installed point
 *   (teardown/rollback: after it no point answers, which ADM-28 pins). `close` is the LIFECYCLE
 *   CLOSE the product calls when a member is archived: the admission point stays installed in its
 *   closed mode, so a later call is REFUSED with `ADMISSION_MEMBER_CLOSED` (recorded, settled
 *   REFUSED/not-started) instead of running unmediated or being judged against a binding the member
 *   no longer has, and the execution observer stays installed so an in-flight call that finishes
 *   afterwards still writes its fact and settles (ADM-59/ADM-60/ADM-61).
 */
export function installMemberCentre ({ ctx, binding, resolveBinding, recordAdmission, recordExecution, isReplay, recordReplay, grants, approvals, store, identityOf, overlayDecision, onFault }) {
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
  let admissionPoint
  try {
    admissionPoint = installAdmissionPoint({
      ctx,
      resolveBinding: typeof resolveBinding === 'function' ? resolveBinding : () => binding,
      record,
      // The identity a CLOSED centre still names in its refusal fact. Never used to decide anything.
      closedBinding: binding,
      ...(isReplay === undefined ? {} : { isReplay }),
      ...(recordReplay === undefined ? {} : { recordReplay }),
      ...(grants === undefined ? {} : { grants }),
      ...(approvals === undefined ? {} : { approvals }),
      ...(settlement === undefined ? {} : { settlement }),
      ...(overlayDecision === undefined ? {} : { overlayDecision }),
      ...(onFault === undefined ? {} : { onFault }),
    })
    disposers.push(admissionPoint)
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
  let closedByLifecycle = false
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
    /**
     * LIFECYCLE CLOSE — what the product calls when a member is archived. It is NOT `dispose()`:
     * removal leaves the member's tools with no admission at all, which is the unwired shape this
     * centre exists to refuse. Close keeps the point installed in its closed mode (every later call is
     * refused with `ADMISSION_MEMBER_CLOSED`, recorded and settled REFUSED/not-started) and keeps the
     * execution observer so an in-flight call that finishes afterwards still writes its fact and
     * settles. Idempotent; a second close is a no-op (ADM-59/ADM-60/ADM-61).
     */
    close () {
      if (closedByLifecycle) return
      closedByLifecycle = true
      if (typeof admissionPoint?.close === 'function') {
        admissionPoint.close()
        return
      }
      /* c8 ignore next 4 -- a port without close() is not produced by this module */
      for (const dispose of disposers.reverse()) {
        try { dispose() } catch (error) { if (onFault !== undefined) onFault(error, { phase: 'close' }) }
      }
    },
  })
}
