/**
 * native-tool-admission.mjs — the ONE hand-off from the Team tool plane's
 * admission authority to a NATIVE tool definition's `execute`.
 *
 * WHY IT EXISTS (NATIVE-BASH-PRESERVATION, 2026-11-11). When the model-visible
 * `bash` is the pinned host definition, the Alpha.4 lane decision and the
 * Alpha.6 Officer approval / one-shot consumption must still wrap the call, and
 * they must be the SAME authority the plane already owns — a second
 * authorization fact in this file would be a fork of the approval algebra.
 *
 * So this module holds NO policy, NO decision and NO consumption: it is a
 * publication slot. `agent-bindings.mjs` publishes the plane's `admitNative`
 * edge for the runtime Agent; `native-bash-tool.mjs` looks it up at CALL time
 * (the plane mounts after the native tool module, so a mount-time lookup would
 * always miss).
 *
 * KEYED BY THE RUNTIME AGENT, deliberately: the repo's own evidence
 * (`a5sf-live-native/scope-duplicate-instances.log`) measured that a second
 * `@deepseek-ai/dsh-scope` package instance reads `undefined` for a healthy
 * Host-tagged ctx, so a scope key is not a safe identity here. The Agent object
 * the tool's `exec.agent` carries is the same object the glue published for.
 * A session-id map is carried as a second, exact (never prefix) lookup for a
 * path where the object identity differs.
 *
 * @module @dsh-agent-team/runtime/plugin/live/native-tool-admission
 */

/** The typed token a native call answers when no admission edge is published. */
export const NATIVE_ADMISSION_UNAVAILABLE = 'A5_NATIVE_ADMISSION_UNAVAILABLE'

/** Runtime Agent object → admission edge. */
const byAgent = new WeakMap()
/** Exact agent session id → admission edge (the secondary, exact lookup). */
const bySession = new Map()

/**
 * Publish the plane's admission edge for ONE runtime Agent.
 *
 * @param agent - the runtime Agent the plane was assembled for.
 * @param edge - `{ admit({toolName,args,exec}), settle({callId,outcome}) }`.
 * @returns a disposer that removes this publication (only if still current).
 */
export function publishNativeAdmission(agent, edge) {
  if (agent === undefined || agent === null || typeof agent !== 'object') {
    throw new TypeError('publishNativeAdmission needs the runtime Agent it publishes for')
  }
  if (edge === undefined || edge === null || typeof edge.admit !== 'function') {
    throw new TypeError('publishNativeAdmission needs an edge carrying admit()')
  }
  byAgent.set(agent, edge)
  const sessionId = agent?.session?.id ?? agent?.id
  if (typeof sessionId === 'string' && sessionId !== '') bySession.set(sessionId, edge)
  return () => {
    if (byAgent.get(agent) === edge) byAgent.delete(agent)
    if (typeof sessionId === 'string' && sessionId !== '' && bySession.get(sessionId) === edge) bySession.delete(sessionId)
  }
}

/**
 * The admission edge published for an owner, or `undefined`.
 *
 * @param owner - the `exec.agent` of a native tool call.
 * @returns the published edge, or `undefined` (the caller must fail closed).
 */
export function nativeAdmissionOf(owner) {
  if (owner === undefined || owner === null || typeof owner !== 'object') return undefined
  const direct = byAgent.get(owner)
  if (direct !== undefined) return direct
  const sessionId = owner?.session?.id ?? owner?.id
  if (typeof sessionId !== 'string' || sessionId === '') return undefined
  return bySession.get(sessionId)
}
