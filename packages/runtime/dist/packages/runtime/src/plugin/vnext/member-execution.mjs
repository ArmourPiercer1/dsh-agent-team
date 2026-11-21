/**
 * member-execution.mjs — ONE member's native execution composition, in one place.
 *
 * EXTRACTED FROM agent-bindings.mjs (2026-11-22, external architecture review). The review's first
 * acceptance point is that the entry must only ASSEMBLE: identity, binding, admission, facts,
 * settlement and the native mount's lifecycle belong to a component with explicit inputs, not to a
 * 5,000-line closure that also owns personas, MCP views, skills and delivery.
 *
 * WHAT THIS MODULE OWNS (and nothing else owns):
 *  - the refusal to run a governed member without a state directory (an unrecorded governed member is
 *    the unwired case this project refuses);
 *  - the admission binding, built BY REFERENCE from the compiled answer;
 *  - the durable fact ledger and the settlement store, keyed by the product's own execution identity;
 *  - the centre installation over one callId join;
 *  - crash recovery AT BIND TIME (a record left RUNNING becomes UNKNOWN, never a replay);
 *  - the native mount and its dispose() - the handle whose disposal installs the MEMBER_CLOSED
 *    tombstone, which the first production wiring discarded.
 *
 * WHAT IT DOES NOT OWN: no tool body, no policy compilation, no approval decision, no persona, no MCP.
 * Its inputs are values and two callbacks; it holds no reference to the binding closure's state.
 *
 * @module packages/runtime/src/plugin/vnext/member-execution
 */

import { join } from 'node:path'
import { bindingFromCompiledMember, installMemberCentre } from './centre-install.mjs'
import { openFactLedger } from './fact-ledger.mjs'
import { hostNativeSpecs, mountHostModules } from './realm-lane.mjs'
import { createExecutionSettlementStore } from '../../../settlement/execution-settlement.js'
import { dispatchExecutionId } from '../../../settlement/dispatch-settlement.js'

/**
 * Install one member's execution composition.
 *
 * @param {object} input
 * @param {object} input.agentCtx - the member agent's context (the scope admission listens on).
 * @param {object} input.realm - the mounted member realm.
 * @param {object} input.compiledAnswer - `compiledAnswerOfRealm(realm)`: `{members, bindings?}`.
 * @param {object} input.config - the row config (only `centreStatePath` / `defaultWorkspace` are read).
 * @param {string} input.sessionId - the member's session id.
 * @param {string} input.instanceId - the member instance id (also the fact ledger's file stem).
 * @param {string} input.teamRoot - the owning team root session id (settlement provenance).
 * @param {string|undefined} input.workspaceRoot - the member's effective workspace root.
 * @param {readonly object[]} [input.nativeSpecs] - `{url, expectedTools?}` native modules to mount.
 * @param {string} [input.scope] - the resolved agent scope for definition-identity checks.
 * @param {(dispose: () => void) => void} input.onDispose - where the centre's disposer goes.
 * @param {(entry: {settled: () => Promise<void>}) => void} input.onNativeDispose - where the native
 *   mount's async disposer goes (the caller awaits it BEFORE disposing the realm).
 * @param {(message: string) => void} input.observe - the row's observation sink.
 * @returns {object|undefined} `{binding, ledger, settlementStore}` when a centre was installed.
 */
export async function installMemberExecution ({
  agentCtx,
  realm,
  compiledAnswer,
  config,
  sessionId,
  instanceId,
  teamRoot,
  workspaceRoot,
  nativeSpecs = [],
  scope,
  onDispose,
  onNativeDispose,
  observe,
}) {
  if (typeof onDispose !== 'function') throw new TypeError('member-execution: onDispose must be a function (a centre without a disposer outlives its member)')
  if (typeof observe !== 'function') throw new TypeError('member-execution: observe must be a function (a fault with nowhere to go is a silent fault)')
  let centreState
  // THE CENTRE. A compiled realm means controlled tools are live on this member, so the admission
  // point, the durable facts and the settlement store are part of the enforcement, not an option.
  if (compiledAnswer !== undefined) {
    const stateRoot = typeof config?.centreStatePath === 'string' && config.centreStatePath.trim() !== ''
      ? config.centreStatePath
      : undefined
    if (stateRoot === undefined) {
      throw new Error(
        `member-execution: Member '${instanceId}' mounts a compiled realm but this row sets no config.centreStatePath;`
        + ' a governed member whose admission/execution facts and settlements cannot be written is refused rather'
        + ' than run unrecorded (set centreStatePath to a directory this deployment owns)',
      )
    }
    const binding = bindingFromCompiledMember({
      member: compiledAnswer.members?.[0],
      ...(compiledAnswer.bindings === undefined ? {} : { bindings: compiledAnswer.bindings }),
      agentId: sessionId,
      sessionId,
      workspaceRoot: workspaceRoot ?? config?.defaultWorkspace ?? process.cwd(),
      owner: teamRoot,
    })
    const ledger = openFactLedger({ path: join(stateRoot, `${instanceId}.facts.jsonl`) })
    const settlementStore = createExecutionSettlementStore({ dir: join(stateRoot, 'settlement') })
    const identityOf = (exec) => ({
      executionId: dispatchExecutionId({ rootSessionId: teamRoot, agentInstanceId: instanceId }, exec.callId),
      actorId: instanceId,
      worldId: sessionId,
    })
    const centre = installMemberCentre({
      ctx: agentCtx,
      binding,
      recordAdmission: (fact) => ledger.recordAdmission(fact),
      recordExecution: (fact) => ledger.recordExecution(fact),
      isReplay: (callId) => ledger.has(callId),
      recordReplay: (input) => ledger.recordReplayRefusal(input),
      store: settlementStore,
      identityOf,
      onFault: (error, context) => observe(`centre: ${context.phase} fault: ${error instanceof Error ? error.message : String(error)}`),
    })
    // CRASH RECOVERY, at bind time: a record left RUNNING by a dead process becomes UNKNOWN with its
    // missing evidence, and is never replayed.
    const recovered = settlementStore.recoverUnsettled(new Date().toISOString())
    if (recovered.length > 0) {
      observe(`centre: recovered ${recovered.length} unsettled execution(s) as ${[...new Set(recovered.map((entry) => entry.after))].join(',')}`)
    }
    onDispose(() => centre.dispose())
    centreState = { binding, ledger, settlementStore }
  }
  // THE NATIVE MOUNT. Its dispose() releases the realm's definition and installs the MEMBER_CLOSED
  // tombstone; the caller must await it BEFORE disposing the realm, because the tombstone needs a
  // living realm to be installed.
  if (Array.isArray(nativeSpecs) && nativeSpecs.length > 0) {
    const specs = hostNativeSpecs(await Promise.all(nativeSpecs.map(async (spec) => ({
      url: spec.url,
      module: await import(spec.url),
      ...(spec.expectedTools === undefined ? {} : { expectedTools: spec.expectedTools }),
    }))))
    const nativeMount = await mountHostModules({ realm, root: agentCtx, scope, specs })
    onNativeDispose({ settled: () => nativeMount.dispose() })
  }
  return centreState
}
