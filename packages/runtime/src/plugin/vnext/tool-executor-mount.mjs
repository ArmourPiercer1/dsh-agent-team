/**
 * tool-executor-mount.mjs — THE ONE HOST-SHAPE SEAM for tool dispatch.
 *
 * WHY THIS MODULE EXISTS (round 121; defect measured in round 118).
 *
 * The two pinned hosts dispatch a tool call through two DIFFERENT public
 * contracts, and neither is a "version" of the other:
 *
 *   rc.2 `@deepseek-ai/dsh-tools` (`ToolRuntime`) OWNS dispatch. A call is
 *        `tools.execute({ callId, name, arguments, agent, signal })`, the
 *        runtime runs it, and `ToolRuntime.mode` / `modeFor(scope)` /
 *        `defaultMode` are public presentation selectors. There is NO
 *        executor service to mount.
 *
 *   rc.5 deleted `mode` (`z.never()`: "Mount a native or PTC tool executor
 *        instead") and made `tools.execute` DELEGATE: it resolves a per-scope
 *        EXECUTOR (`selectExecutor(agent)`) and throws the host's
 *        `TOOL_EXECUTOR_UNAVAILABLE` when the composition mounted none. The
 *        executor is installed by a PLUGIN PACKAGE exporting
 *        `{ name, inject, apply }` (`@deepseek-ai/dsh-tool-executor-native`,
 *        `…-ptc`); `tools.setExecutor` accepts ONE executor per scope.
 *
 * A Team composition that mounts a governed Member realm must therefore make
 * sure dispatch is available in the scope the centre judges — WITHOUT
 * re-implementing an executor (that would be a second execution path around
 * admission) and WITHOUT emulating the removed rc.2 `mode` on rc.5.
 *
 * HOW THE SHAPE IS DECIDED. By PUBLIC CAPABILITY PROBE on the tools service
 * object the composition actually loaded — never by a version string, a
 * package.json read, or `try { rc5 } catch { rc2 }`:
 *
 *   typeof tools.setExecutor === 'function'            -> 'executor-mount'
 *   typeof tools.modeFor === 'function'
 *     || 'defaultMode' in tools                        -> 'registry-dispatch'
 *   neither                                             -> 'no-dispatch-contract'
 *                                                          (the MOUNT succeeds and
 *                                                           records the absence; every
 *                                                           governed call then refuses
 *                                                           A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING)
 *
 * WHY THE ABSENCE IS RECORDED, NOT THROWN, AT MOUNT TIME. A minimal tools
 * DOUBLE (a permission-only synthetic world, the live bridge's own handle)
 * answers `get`/`guard` and never dispatches; refusing to mount a realm for it
 * would fail worlds for a capability they do not use. Silence is still
 * impossible — `dispatchGovernedToolCall` / `governedToolExecutorOf` refuse the
 * FIRST governed call with the same typed code, so a composition that really
 * needs dispatch cannot end up quietly running nothing. There is deliberately
 * no legacy fallback.
 *
 * WHERE ADMISSION SITS. Mounting the host's own executor adds ONE dispatch
 * mechanism to the scope; it does not bypass the centre. The centre installs
 * `tools/pre-execute` listeners and `tools.guard()` denials on the SAME scope
 * (`packages/runtime/src/plugin/vnext/admission-port.mjs`), and the host's
 * executor pipeline is what dispatches them: pre-execute listeners run before
 * the body and guards are consulted immediately before it. Consequently a call
 * that reaches the mounted executor is still ADMITTED first, and a denied lane
 * is denied by the centre while the executor is mounted (pinned by the
 * round-121 controls in `a5sf-bl16-grep-realm.test.ts`).
 *
 * @module @dsh-agent-team/runtime/src/plugin/vnext/tool-executor-mount
 */

/** The bare specifier of the host's own native executor plugin package (rc.5 shape). */
export const HOST_TOOL_EXECUTOR_SPECIFIER = '@deepseek-ai/dsh-tool-executor-native'

/** The typed code for "this tools service offers neither dispatch shape". */
export const TOOL_EXECUTOR_CAPABILITY_MISSING = 'A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING'
/** The typed code for "the rc.5 shape is present but no executor is selected for this scope". */
export const TOOL_EXECUTOR_UNAVAILABLE = 'A5SF_TOOL_EXECUTOR_UNAVAILABLE'
/** The typed code for "the host executor package loaded but is not the plugin the host's contract describes". */
export const TOOL_EXECUTOR_PLUGIN_INVALID = 'A5SF_TOOL_EXECUTOR_PLUGIN_INVALID'
/** The typed code for "the host accepted the batch but returned no result for the call". */
export const TOOL_EXECUTOR_RESULT_MISSING = 'A5SF_TOOL_EXECUTOR_RESULT_MISSING'

/**
 * A refusal from this seam. It carries a machine-greppable `code`, so a
 * capability absence can never masquerade as a generic assertion or a silent
 * `undefined`.
 */
export class A5sfToolExecutorSeamError extends Error {
  /**
   * @param {string} code - one of the codes this module exports.
   * @param {string} detail - what is missing and what the composition must do.
   */
  constructor(code, detail) {
    super(`tool-executor-mount: ${code}: ${detail}`)
    this.name = 'A5sfToolExecutorSeamError'
    this.code = code
    this.detail = detail
  }
}

/**
 * The dispatch shape of a tools service, decided ONLY by the public methods it
 * exposes. `undefined` means neither shape is present (a refusal for callers).
 *
 * @param {object|undefined|null} tools - the live tools service.
 * @returns {'executor-mount'|'registry-dispatch'|undefined}
 */
export function hostToolDispatchShape(tools) {
  if (tools === undefined || tools === null || typeof tools !== 'object') return undefined
  // rc.5: dispatch is a per-scope executor SERVICE; the registry only delegates.
  if (typeof tools.setExecutor === 'function') return 'executor-mount'
  // rc.2: the registry dispatches; `mode`/`modeFor`/`defaultMode` are the
  // public presentation selectors that prove the dispatch is built in.
  if (typeof tools.modeFor === 'function' || 'defaultMode' in tools) return 'registry-dispatch'
  return undefined
}

/**
 * Resolve the executor selected for `agent`, or `null` when the scope chain
 * selects none.
 *
 * THIS IS AN ABSENCE PROBE, NOT A FALLBACK. It calls the host's own public
 * selector and translates ONLY the host's typed "no executor" answer into
 * `null` (the caller then mounts one, or refuses). Any other fault is
 * rethrown: a broken registry must never read as "no executor" and be papered
 * over with a mount.
 *
 * @param {object} tools - the live tools service (rc.5 shape).
 * @param {unknown} agent - the agent / scope key the call would dispatch for.
 * @returns {object|null} the selected executor, or `null`.
 */
export function selectedToolExecutorOrNull(tools, agent) {
  try {
    return tools.selectExecutor(agent)
  } catch (error) {
    // The host exports `ToolExecutorUnavailableError` with the stable public
    // `code` below; matching the code (not a message string) keeps the probe
    // honest across the host's own wording changes.
    if (error?.code === 'TOOL_EXECUTOR_UNAVAILABLE' || error?.name === 'ToolExecutorUnavailableError') return null
    throw error
  }
}

/**
 * Ensure the scope can dispatch, mounting the HOST's own executor plugin when
 * (and only when) the host's dispatch contract is the rc.5 executor mount.
 *
 * The mount is the host's exported plugin OBJECT (`{ name, inject, apply }`),
 * never the bare class: mounting the class skips `inject`, and the pipeline
 * then cannot see `tools` (the failure the repo already paid for in round 110).
 *
 * @param {object} input
 * @param {object} input.scope - the Cordis Context whose scope becomes the executor's selection.
 * @param {object} input.tools - the live tools service.
 * @param {unknown} [input.agent] - the scope key to probe for an EXISTING selection.
 *   Omit to always attempt the mount (the scope's own context tag is the key).
 * @param {string} [input.specifier] - override for tests; the host package by default.
 * @returns {Promise<{shape: string, mounted: boolean, name: string, plugin?: object, dispose?: () => Promise<void>}>}
 *   a frozen description of what this seam did. `mounted: false` on rc.2 is
 *   NOT a degraded mode: the registry dispatches by itself there.
 */
export async function mountHostToolExecutor({ scope, tools, agent, specifier = HOST_TOOL_EXECUTOR_SPECIFIER }) {
  if (scope === undefined || scope === null || typeof scope.plugin !== 'function') {
    throw new TypeError('tool-executor-mount: mountHostToolExecutor needs the Cordis Context whose scope selects the executor')
  }
  const shape = hostToolDispatchShape(tools)
  if (shape === undefined) {
    // A TOOLS SERVICE THAT DECLARES NO DISPATCH CONTRACT. Mounting a realm is
    // not dispatching a call: synthetic worlds (and the live bridge's own
    // permission-only handle) install a MINIMAL tools double that answers
    // `get`/`guard` and nothing else, and they never dispatch a tool. Refusing
    // the mount here would fail those worlds for a capability they do not use,
    // so this seam records the absence instead — and `governedToolExecutorOf` /
    // `dispatchGovernedToolCall` refuse EVERY call on such a registry with the
    // same typed `A5SF_TOOL_EXECUTOR_CAPABILITY_MISSING`. Silence is still
    // impossible: the first governed call names the missing capability.
    return Object.freeze({ shape, mounted: false, name: 'no-dispatch-contract' })
  }
  if (shape === 'registry-dispatch') {
    // rc.2 byte-identical arm: the registry dispatches; mounting nothing is
    // the host's own semantics, not a Team fallback.
    return Object.freeze({ shape, mounted: false, name: 'registry-dispatch' })
  }
  // rc.5 — an executor may ALREADY be selected for this scope (a deployment
  // bundle or a preset mounted one). One executor per scope is the host's
  // contract, so an existing selection is USED, never replaced.
  if (agent !== undefined && selectedToolExecutorOrNull(tools, agent) !== null) {
    return Object.freeze({ shape, mounted: false, name: 'already-selected' })
  }
  // A NON-LITERAL specifier on purpose: a static `import('@deepseek-ai/…')`
  // would be resolved by the test adapter's Vite/ESM transforms even on the
  // rc.2 host, where the package does not exist. The host is chosen first by
  // capability, and only then is its package loaded.
  let loaded
  try {
    loaded = await import(specifier)
  } catch (error) {
    throw new A5sfToolExecutorSeamError(
      TOOL_EXECUTOR_CAPABILITY_MISSING,
      `the tools service requires an executor mount, but the host's executor package ${JSON.stringify(specifier)}`
      + ` could not be loaded (${error instanceof Error ? error.message : String(error)});`
      + ' refusing instead of running the Member with no dispatch at all',
    )
  }
  if (loaded === null || typeof loaded !== 'object' || typeof loaded.apply !== 'function' || typeof loaded.name !== 'string') {
    throw new A5sfToolExecutorSeamError(
      TOOL_EXECUTOR_PLUGIN_INVALID,
      `${JSON.stringify(specifier)} did not export the host's plugin shape { name: string, inject?, apply() };`
      + ' mounting anything else would register an executor the host pipeline does not own',
    )
  }
  const plugin = { name: loaded.name, inject: loaded.inject, apply: loaded.apply }
  const fiber = await scope.plugin(plugin)
  return Object.freeze({
    shape,
    mounted: true,
    name: loaded.name,
    plugin: Object.freeze(plugin),
    dispose: async () => {
      await fiber.dispose()
    },
  })
}

/**
 * The call-level guard: return the executor a governed call WILL dispatch
 * through, or refuse with a typed code naming the missing capability.
 *
 * The product uses this on the path that hands a call to the host, so a
 * composition that forgot the mount answers `A5SF_TOOL_EXECUTOR_UNAVAILABLE`
 * (a refusal a reviewer can grep) instead of the host's generic error. On rc.2
 * there is no executor to select and the call returns the registry marker —
 * the host dispatches itself, exactly as before.
 *
 * @param {object} tools - the live tools service.
 * @param {unknown} agent - the agent / scope key the call dispatches for.
 * @returns {{shape: string, name: string, executor: object|undefined}}
 */
export function governedToolExecutorOf(tools, agent) {
  const shape = hostToolDispatchShape(tools)
  if (shape === undefined) {
    throw new A5sfToolExecutorSeamError(
      TOOL_EXECUTOR_CAPABILITY_MISSING,
      'the mounted tools service exposes neither `tools.setExecutor` nor the built-in registry dispatch;'
      + ' the call has no governed dispatch path',
    )
  }
  if (shape === 'registry-dispatch') {
    return Object.freeze({ shape, name: 'registry-dispatch', executor: undefined })
  }
  const executor = selectedToolExecutorOrNull(tools, agent)
  if (executor === null) {
    throw new A5sfToolExecutorSeamError(
      TOOL_EXECUTOR_UNAVAILABLE,
      'no tool executor is selected for this member scope, so the host cannot dispatch the call;'
      + ' mount the host executor (`mountHostToolExecutor`) rather than letting the call fail ungoverned',
    )
  }
  return Object.freeze({ shape, name: executor?.constructor?.name ?? 'executor', executor })
}

/**
 * Dispatch ONE governed tool call in the shape the selected host accepts.
 *
 * This is the call-level entry the round-121 controls drive: it resolves the
 * executor FIRST (`governedToolExecutorOf`), so an unmounted rc.5 composition
 * answers `A5SF_TOOL_EXECUTOR_UNAVAILABLE` — the product's named refusal —
 * instead of the host's generic error or, worse, a call that never ran. The
 * host then runs its own pipeline, which is where the centre's
 * `tools/pre-execute` listener and `tools.guard()` denials are consulted:
 * admission is NOT bypassed by dispatching this way.
 *
 * The two input shapes are the hosts' own public contracts (rc.5 batch
 * `{ calls: [{ type: 'tool-call', id, name, arguments }] }`, rc.2 single call);
 * neither is an emulation of a removed API — the shape is chosen by
 * `hostToolDispatchShape`, not by a version.
 *
 * @param {object} tools - the live tools service.
 * @param {object} call - `{ callId, name, arguments, agent, signal }`.
 * @returns {Promise<object>} the settled tool result (`{ isError, content, … }`).
 */
export async function dispatchGovernedToolCall(tools, call) {
  const accepted = governedToolExecutorOf(tools, call.agent)
  if (accepted.shape === 'registry-dispatch') {
    return await tools.execute({
      signal: call.signal,
      callId: call.callId,
      name: call.name,
      arguments: call.arguments ?? {},
      agent: call.agent,
    })
  }
  const batch = await tools.execute({
    calls: [{ type: 'tool-call', id: call.callId, name: call.name, arguments: JSON.stringify(call.arguments ?? {}) }],
    signal: call.signal,
    agent: call.agent,
  })
  const outcome = batch?.results?.[0]
  if (outcome === undefined) {
    throw new A5sfToolExecutorSeamError(
      TOOL_EXECUTOR_RESULT_MISSING,
      `the host executor accepted the batch for ${JSON.stringify(call.name)} but returned no result for call ${JSON.stringify(call.callId)};`
      + ' reporting a missing settlement instead of an invented one',
    )
  }
  return outcome.result
}
