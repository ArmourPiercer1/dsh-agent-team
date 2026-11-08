/**
 * closed-tool-arguments.mjs — enforce a route-C shadow's CLOSED parameter schema
 * at the tool-call boundary.
 *
 * WHY THIS EXISTS (PD20-C3 / B-2, measured by `a5sf-recon-shell`). The
 * model-visible `bash` shadow declares `additionalProperties: false` with the
 * three parameters it serves, but the harness tool-call path does not validate
 * a closed schema for a native module: it hands `execute(args, exec)` whatever
 * the model sent. Measured consequence: a call carrying
 * `run_in_background: true` was EXECUTED in the foreground with no job id, no
 * background process and no typed refusal — the model believed it had started a
 * managed job. `job_list` then answered `(no background jobs)` (free text), so
 * neither half told the truth about the other.
 *
 * THE RULE THIS MODULE PINS. An unknown parameter is a REFUSAL, never a silent
 * drop:
 *   - `run_in_background` gets its own code (`BACKGROUND_NOT_SUPPORTED`) and a
 *     message that says the truth — this shell runs each command in a FRESH
 *     confined child with no job registry producer, so no job will ever exist;
 *   - any other undeclared key gets `UNSUPPORTED_PARAMETER` and the accepted
 *     list.
 *
 * WHAT IT IS NOT: not a policy source (it holds no lane, ceiling or vocabulary
 * of the Member's authority), not a schema validator (it does not check types —
 * each tool keeps its own argument checks), and not a second tool surface (the
 * registered schema is unchanged; this only makes its closure real).
 *
 * @module @dsh-agent-team/runtime/plugin/live/closed-tool-arguments
 */

/** Typed code: a parameter this tool does not declare. */
export const UNSUPPORTED_PARAMETER = 'UNSUPPORTED_PARAMETER'

/**
 * Typed code: the model asked for a background/managed job the confined shell
 * cannot produce. Distinct from {@link UNSUPPORTED_PARAMETER} because the
 * refusal is a CAPABILITY statement, not a typo: a caller that retries without
 * the parameter still gets a foreground command.
 */
export const BACKGROUND_NOT_SUPPORTED = 'BACKGROUND_NOT_SUPPORTED'

/** The parameter name every host `bash` uses for managed background jobs. */
export const BACKGROUND_PARAMETER = 'run_in_background'

/**
 * The typed refusal raised at the tool boundary. `code` is the machine-readable
 * discriminator; the message repeats it because a tool error is rendered as
 * text to the model.
 */
export class ClosedToolArgumentsRefusal extends Error {
  constructor(code, toolName, detail) {
    super(`${code}: ${toolName} — ${detail}`)
    this.name = 'ClosedToolArgumentsRefusal'
    this.code = code
  }
}

/**
 * The refusal for one call, or `null` when every key is declared.
 *
 * @param {string} toolName - the registered tool name (for the message).
 * @param {object} args - the arguments the model sent (may be null/undefined).
 * @param {readonly string[]} declared - every parameter the tool declares.
 * @returns {ClosedToolArgumentsRefusal|null} the refusal.
 */
export function closedArgumentsRefusal(toolName, args, declared) {
  if (args === null || args === undefined) return null
  if (typeof args !== 'object' || Array.isArray(args)) {
    return new ClosedToolArgumentsRefusal(
      UNSUPPORTED_PARAMETER,
      String(toolName),
      `expected an object of named parameters, got ${Array.isArray(args) ? 'an array' : typeof args}`,
    )
  }
  const accepted = declared.join(', ')
  for (const key of Object.keys(args)) {
    if (declared.includes(key)) continue
    if (key === BACKGROUND_PARAMETER) {
      return new ClosedToolArgumentsRefusal(
        BACKGROUND_NOT_SUPPORTED,
        String(toolName),
        'this shell has no managed-job producer: every command runs in a FRESH foreground confined child, '
        + 'so no job id is ever created and there is nothing to list, read or kill. The parameter was REFUSED '
        + 'instead of silently dropped. Run the command in the foreground and drop `run_in_background`; the call '
        + 'returns when the command finishes (raise `timeoutMs` instead if it needs longer).',
      )
    }
    return new ClosedToolArgumentsRefusal(
      UNSUPPORTED_PARAMETER,
      String(toolName),
      `parameter '${key}' is not declared by this tool (accepted: ${accepted}); it was REFUSED instead of silently dropped`,
    )
  }
  return null
}

/**
 * Throw the typed refusal for one call (the tool boundary's one-liner).
 *
 * @param {string} toolName - the registered tool name.
 * @param {object} args - the arguments the model sent.
 * @param {readonly string[]} declared - every parameter the tool declares.
 * @returns {void} never, when the call carries an undeclared parameter.
 */
export function assertClosedArguments(toolName, args, declared) {
  const refusal = closedArgumentsRefusal(toolName, args, declared)
  if (refusal !== null) throw refusal
}
