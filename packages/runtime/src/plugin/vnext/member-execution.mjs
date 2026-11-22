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
import { bindingFromCompiledMember, executorReadinessOf, installMemberCentre } from './centre-install.mjs'
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
 * @param {object} input.compiledAnswer - `compiledAnswerOfRealm(realm)`: `{members, bindings?}` plus
 *   the realm's OWN mounted faces (`subprocess?`, `terminal?`, `web?`) — the centre derives its
 *   executor-readiness answers from them (`executorReadinessOf`), never from the declaration.
 * @param {object} input.config - the row config (only `centreStatePath` / `defaultWorkspace` are read).
 * @param {string} input.sessionId - the member's session id.
 * @param {string} input.instanceId - the member instance id (also the fact ledger's file stem).
 * @param {string} input.teamRoot - the owning team root session id (settlement provenance).
 * @param {string|undefined} input.workspaceRoot - the member's effective workspace root.
 * @param {() => object|undefined} [input.resolveCompiledAnswer] - re-read the CURRENT compiled answer
 *   (the glue passes `() => compiledAnswerOfRealm(realm)`). This is what makes the centre's
 *   post-approval recheck a real second question instead of a constant: a member whose realm is gone
 *   answers `undefined` and the guard refuses with ADMISSION_NO_BINDING.
 * @param {readonly object[]} [input.nativeSpecs] - `{url, expectedTools?}` native modules to mount.
 * @param {string} [input.scope] - the resolved agent scope for definition-identity checks.
 * @param {object} [input.grants] - the one-shot grant binder (`member-io-policy`) and the projection
 *   from a binding to the trusted member identity. Absent = every ask is refused (ADMISSION_ASK_UNWIRED).
 * @param {object} [input.approvals] - the durable approval authority (`createControlApprovalPort`).
 *   Required beside `grants`: a grant without a recorded approval is never minted.
 * @param {(dispose: () => void) => void} input.onDispose - where the centre's disposer goes.
 * @param {(entry: {settled: () => Promise<void>}) => void} input.onNativeDispose - where the native
 *   mount's async disposer goes (the caller awaits it BEFORE disposing the realm).
 * @param {(message: string) => void} input.observe - the row's observation sink.
 * @returns {object|undefined} `{binding, ledger, settlementStore}` when a centre was installed.
 */
/**
 * A native tool module must be a host package. The check is on the SPECIFIER, before the import: an
 * `await import()` of an unvalidated string runs the code it names, so a validation that happens after
 * it has already executed the thing it was supposed to refuse.
 */
export function assertHostModuleSpecifier (specifier) {
  if (typeof specifier !== 'string' || specifier === '') {
    throw new TypeError('member-execution: a native tool module needs a specifier')
  }
  if (!specifier.startsWith('@deepseek-ai/')) {
    throw new Error(`member-execution: refusing to import ${JSON.stringify(specifier)}: native tool modules are host packages (@deepseek-ai/*), and importing anything else would execute code this deployment did not choose`)
  }
  return specifier
}

export async function installMemberExecution ({
  agentCtx,
  realm,
  compiledAnswer,
  resolveCompiledAnswer,
  config,
  sessionId,
  instanceId,
  teamRoot,
  workspaceRoot,
  overlayDecision,
  grants,
  approvals,
  nativeSpecs = [],
  scope,
  onDispose,
  onNativeDispose,
  observe,
}) {
  if (typeof onDispose !== 'function') throw new TypeError('member-execution: onDispose must be a function (a centre without a disposer outlives its member)')
  if (typeof observe !== 'function') throw new TypeError('member-execution: observe must be a function (a fault with nowhere to go is a silent fault)')
  let centreState
  // Path safety: the instance id names a file under the deployment-owned directory, so it is
  // validated here rather than trusted from a blueprint/config value.
  if (!/^[A-Za-z0-9._-]+$/u.test(String(instanceId)) || String(instanceId) === '.' || String(instanceId) === '..') {
    throw new Error(`member-execution: instance id ${JSON.stringify(String(instanceId))} is not a safe file stem (letters, digits, dot, underscore, dash only)`)
  }
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
    const buildBinding = (answer) => bindingFromCompiledMember({
      member: answer.members?.[0],
      ...(answer.bindings === undefined ? {} : { bindings: answer.bindings }),
      // THE EXECUTOR READINESS the compiled answer itself answers: a process-class tool declared on
      // `confined-subprocess` is admitted only while this realm still carries the confined face.
      // Rebuilt on every recheck, so a face that disappeared between the approval and the body is a
      // typed `ADMISSION_EXECUTOR_UNAVAILABLE`, not a stale allow.
      executors: executorReadinessOf(answer),
      // The MEMBER, not the session. `agentId` used to be the session id, which put the host's identity
      // where the record's member identity belongs; they are now separate fields.
      agentId: String(instanceId),
      instanceId: String(instanceId),
      sessionId,
      // No silent cwd substitution: a member whose workspace nobody can name is judged against the
      // host process's cwd, which is not this deployment's answer to give.
      ...(workspaceRoot === undefined && (config?.defaultWorkspace === undefined || config.defaultWorkspace === '')
        ? {}
        : { workspaceRoot: workspaceRoot ?? config.defaultWorkspace }),
      owner: teamRoot,
    })
    const binding = buildBinding(compiledAnswer)
    const ledger = openFactLedger({ path: join(stateRoot, `${instanceId}.facts.jsonl`) })
    // PER MEMBER. One shared settlement directory multipled two defects: recovery at member B's bind
    // turned member A's LIVE execution into UNKNOWN, and A's real terminal write then conflicted.
    const settlementStore = createExecutionSettlementStore({ dir: join(stateRoot, 'settlement', String(instanceId)) })
    const identityOf = (exec) => ({
      executionId: dispatchExecutionId({ rootSessionId: teamRoot, agentInstanceId: instanceId }, exec.callId),
      actorId: instanceId,
      worldId: sessionId,
    })
    let closed = false
    const centre = installMemberCentre({
      ctx: agentCtx,
      binding,
      // The live resolver: the answer as it is NOW, or nothing once the member is closed. This is the
      // difference between a recheck that can refuse and one that can only agree.
      resolveBinding: () => {
        if (closed) return undefined
        const current = typeof resolveCompiledAnswer === 'function' ? resolveCompiledAnswer() : compiledAnswer
        if (current === undefined) return undefined
        return buildBinding(current)
      },
      recordAdmission: (fact) => ledger.recordAdmission(fact),
      recordExecution: (fact) => ledger.recordExecution(fact),
      // The durable permission-plane restriction (E3): consulted per call beside the lane verdict and
      // able only to REMOVE authority. Absent means "no overlay wired on this row", which the centre
      // records as such rather than reading as an allow.
      ...(overlayDecision === undefined ? {} : { overlayDecision }),
      // THE ASK PATH (B): the one-shot grant binder and the durable approval authority. Both are
      // supplied together by the glue, or neither is: an ask must become a Control request and a
      // one-shot grant, and a half-wired ask is refused by the centre with its own code.
      ...(grants === undefined ? {} : { grants }),
      ...(approvals === undefined ? {} : { approvals }),
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
    onDispose(() => {
      closed = true
      // LIFECYCLE CLOSE, not removal. A removed point would leave the archived member's tools running
      // with no admission at all; close keeps a refusal tombstone (ADMISSION_MEMBER_CLOSED) on the
      // member's own layer and keeps the settlement observer, so a call that finishes after the close
      // still settles instead of recovering as UNKNOWN (ADM-59/ADM-60).
      if (typeof centre.close === 'function') centre.close()
      else centre.dispose()
    })
    centreState = { binding, ledger, settlementStore }
  }
  // THE NATIVE MOUNT. Its dispose() releases the realm's definition and installs the MEMBER_CLOSED
  // tombstone; the caller must await it BEFORE disposing the realm, because the tombstone needs a
  // living realm to be installed.
  if (Array.isArray(nativeSpecs) && nativeSpecs.length > 0) {
    // VALIDATE BEFORE IMPORTING. `await import()` executes whatever the spec names - a remote URL, a
    // path outside the deployment, a package that is not a host tool module - so the check that the
    // module belongs to `@deepseek-ai/*` must be a decision about the STRING, taken before any code
    // runs. Importing first and inspecting afterwards would already have paid the cost the check exists
    // to avoid.
    const specs = hostNativeSpecs(await Promise.all(nativeSpecs.map(async (spec) => {
      assertHostModuleSpecifier(spec.url)
      const url = spec.url
      return {
        url,
        module: await import(url),
        ...(spec.expectedTools === undefined ? {} : { expectedTools: spec.expectedTools }),
      }
    })))
    const nativeMount = await mountHostModules({ realm, root: agentCtx, scope, specs })
    onNativeDispose({ settled: () => nativeMount.dispose() })
  }
  return centreState
}
