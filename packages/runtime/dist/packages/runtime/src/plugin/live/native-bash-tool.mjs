/**
 * native-bash-tool.mjs — the product's governed `bash`, served by the PINNED
 * host `@deepseek-ai/dsh-tool-bash-persistent` definition over the Member's
 * governed persistent PTY.
 *
 * WHY THIS EXISTS (NATIVE-BASH-PRESERVATION, 2026-11-11). Alpha.5 replaced the
 * native tool instead of its execution backend: three Team-owned `bash`
 * definitions (`confined-bash-tool.mjs` PD-12, `confined-terminal-tool.mjs`
 * PD-13, the Team tool plane's process family) re-implemented the model-visible
 * tool, which A5-NATIVE-01/02 forbid. This module registers NO ToolDefinition
 * of its own. It calls the pinned host module's own `apply`, so the definition
 * the model resolves — name, description, parameter schema, output schema,
 * `render`, `presentCall`, error classes, the `stty -echo`/marker protocol, the
 * PTY lifecycle — is byte-for-byte the host's. The ONLY thing this file does is
 * (a) let the host definition be mounted on the Member's isolated scope (where
 * `ctx.terminals` is the governed PTY face, not the inherited host service) and
 * (b) wrap the definition's `execute` with the Team admission middleware in
 * FRONT of the native call: decide → consume once → native `execute`.
 *
 * THE MIDDLEWARE IS FOUND BY AGENT, NOT BY MODULE STATE. The Team tool plane
 * owns Alpha.4 lane decisions and the Alpha.6 Officer approval / one-shot
 * consumption. That authority must not be re-implemented here (a second
 * authorization fact), so `agent-bindings.mjs` publishes the plane's
 * `admitNative` edge for the runtime Agent, and this wrapper looks it up at
 * CALL time (the plane mounts after this module). No edge published = typed
 * refusal, never an unapproved execution.
 *
 * A governed Member NEVER silently falls back to an inherited base terminal:
 * the mount seam refuses this module on a realm whose `faces.terminals` is
 * `null` (`TERMINALS_LEGACY_PTY_REFUSED`), and the face itself refuses an
 * unbound owner.
 *
 * CORE PATCH BUDGET = 0: the pinned package is imported, never modified.
 *
 * @module @dsh-agent-team/runtime/plugin/live/native-bash-tool
 */
import { apply as applyPersistentBash } from '@deepseek-ai/dsh-tool-bash-persistent'
import { nativeAdmissionOf, NATIVE_ADMISSION_UNAVAILABLE } from './native-tool-admission.mjs'
import { outcomeOfTerminalResult } from '../../../operation-permission/pre-execute-adapter.js'

/** The plugin name route C reports in its receipts. */
export const name = 'a5sf-native-bash-persistent'

/**
 * `terminals` is the CONFINED PTY face the realm mounts on the isolated scope;
 * the mount seam refuses this module on a realm without one, so `ctx.terminals`
 * below can never be the inherited legacy PTY service.
 */
export const inject = ['tools', 'terminals']

/**
 * NO `Config` EXPORT — and that is the loader contract, not an omission.
 *
 * Cordis resolves a plugin's config with `resolveConfig(runtime, config)`:
 * `if (!runtime.Config) return config` (`vendor/cordis/lib/index.js`), i.e. a
 * module WITHOUT `Config` receives its config unchanged. A module WITH `Config`
 * is validated through `Config['~standard'].validate(config)`, so any non-schema
 * object exported as `Config` (this module used to export `Object.freeze({})`)
 * throws `Cannot read properties of undefined (reading 'validate')` at
 * activation, and the Member mount fails with
 * `TEAM_RUNTIME_DURABLE_WRITE_FAILED` → `SERVICE_MOUNT_FAILED` (found live by
 * the joint-acceptance lane; pinned host-free by P8/P8b below).
 *
 * This module carries no schema of its own on purpose: every field is the pinned
 * host module's (`timeoutMs`, `maxOutputChars`, `description`, `backendType`),
 * and `apply` below forwards them verbatim, so a second, invented schema here
 * could only reject values the host accepts. Absence is both the safe and the
 * correct answer.
 *
 * `mount.ts` requires only `name` + `apply` from a native tool module, so a
 * configless module is exactly what this seam expects; see
 * `a5sf-native-route-c.test.mjs`'s N1 for the sibling config-reader contract.
 */

/**
 * The refusal code a call gets when the plane's admission edge is absent.
 * Re-exported so a consumer (and a test) compares a code, not a sentence.
 */
export { NATIVE_ADMISSION_UNAVAILABLE }

/**
 * Wrap ONE pinned definition's `execute` with the Team admission edge.
 *
 * Every other definition field is carried by reference to the object the host
 * module built, which is what "the registered definition IS the native tool"
 * means operationally: the parameter schema, the output schema and its
 * `render`, and `presentCall` are the host's own values.
 *
 * @param definition - the definition the pinned host module registered.
 * @param realTools - the ToolRuntime of the Member scope.
 * @returns the disposer `ToolRuntime.register` returned.
 */
function registerWithAdmission(definition, realTools) {
  const wrapped = {
    ...definition,
    async execute(args, exec) {
      const owner = exec?.agent
      const admission = nativeAdmissionOf(owner)
      if (admission === undefined) {
        throw new Error(
          `${NATIVE_ADMISSION_UNAVAILABLE}: the Team admission edge is not published for this agent, so this native `
          + '`bash` call cannot be decided or consumed; refusing instead of executing an unapproved native call',
        )
      }
      const admitted = await admission.admit({ toolName: 'bash', args, exec })
      if (admitted?.kind !== 'allow') {
        // A denial carries the SAME typed token the plane's own rows answer, so
        // the tool layer sees one vocabulary whether the tool is Team-owned or
        // native.
        throw new Error(`${String(admitted?.code ?? 'A5_NATIVE_CALL_DENIED')}: ${String(admitted?.detail ?? 'the Team admission refused this native bash call')}`)
      }
      try {
        const result = await definition.execute(args, exec)
        // PD-42 (owner ruling 2026-11-13): a RESOLVED native call is not
        // automatically a successful execution. The pinned `bash` definition
        // reports a non-zero command exit as ordinary model-facing text (its
        // exit code is a text trailer, not a ToolResult field), so the ONE
        // shared classifier reads that trailer and reports `failed` for a
        // refused/failed command. An abort still reports the PD-41
        // `cancelled` (the plane settles nothing for it).
        admission.settle({
          callId: admitted.callId,
          outcome: exec?.signal?.aborted === true ? 'cancelled' : outcomeOfTerminalResult(result),
        })
        return result
      } catch (error) {
        // An ABORT is not a completion (PD-41 correction): the plane's own
        // settlement decides the durable fact; this only reports the outcome
        // the native body produced.
        admission.settle({ callId: admitted.callId, outcome: exec?.signal?.aborted === true ? 'cancelled' : 'failed' })
        throw error
      }
    },
  }
  return realTools.register(wrapped)
}

/**
 * Register the governed native `bash` row on the Member's isolated scope.
 *
 * @param ctx - the Member scope (its `terminals` is the governed PTY face).
 * @param config - optional host config passthrough (never policy).
 */
export function apply(ctx, config = {}) {
  const backends = typeof ctx.terminals?.listBackends === 'function' ? ctx.terminals.listBackends() : []
  const backendType = backends[0]
  if (typeof backendType !== 'string' || backendType === '') {
    throw new Error(
      'A5SF_PTY_BACKEND_UNAVAILABLE: the Member scope exposes no terminal backend type; the native persistent bash '
      + 'cannot open a PTY and will not fall back to the inherited host service',
    )
  }
  const realTools = ctx.tools
  const facade = {
    tools: {
      register: (definition) => registerWithAdmission(definition, realTools),
    },
    terminals: ctx.terminals,
    effect: (fn, label) => ctx.effect(fn, label),
    get: (serviceName) => ctx.get(serviceName),
  }
  // The pinned module owns the definition, the config defaults and the shell
  // protocol; this call is the whole adoption.
  applyPersistentBash(facade, { ...config, backendType })
}
