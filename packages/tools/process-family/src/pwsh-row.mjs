/**
 * process-family/src/pwsh-row.mjs — the governed PWSH takeover ROW
 * Definition (U7-F; the `bash-row.mjs` sibling for the shell-class second
 * row, mounted at its FIXED native spelling like the jobs trio and the
 * fs-mutation rows — never the renamable `names` map).
 *
 * The Family owns the Definition PLACEMENT (§4): the native spelling
 * `pwsh`, the model-facing description, the closed parameter schema
 * (host-faithful: `command` + `description` required, `workdir`/`timeoutMs`
 * optional — the same names the frozen center canonicalizer reads for the
 * shell class), and the execute transport. The transport is the family BODY
 * (the fs-family row precedent): every authority force arrives injected
 * through `pwshExecutor`; a refusal is an ANSWER (`{ text }`, the bash row's
 * transport law on this wire), never a thrown stack.
 *
 * DISCLOSED schema deviations (both TIGHTER, stated in full in
 * `pwsh-mechanics.mjs`): the escalation pair (`sandbox_permissions` /
 * `justification`) is not mounted — the governed row assembles no escalation
 * surface; `run_in_background` is not advertised — the native row shows it
 * only while a job registry is composed, and this row has no governed pwsh
 * job arm (a direct forged argument is refused by name).
 *
 * @module process-family/pwsh-row
 */

/** The row's closed parameter schema — host `toolPwshParameters` minus the
 *  two conditional escalation fields and the registry-conditional
 *  `run_in_background` (see header). */
export const PWSH_ROW_PARAMETERS = Object.freeze({
  type: 'object',
  properties: {
    command: { type: 'string', description: 'the PowerShell command text, run as `pwsh -Command <command>` (one argv element — no shell-quoting layer)' },
    description: { type: 'string', description: 'a short description of what the command does (1 sentence, states why it is needed)' },
    workdir: { type: 'string', description: 'working directory inside the governed working root (default: the root itself)' },
    timeoutMs: { type: 'integer', minimum: 1, description: 'kill the command after this many milliseconds (the row terminates a timed-out payload; the exit code is reported as not-observed)' },
  },
  required: ['command', 'description'],
  additionalProperties: false,
})

/**
 * Build the governed pwsh row Definition for one mount.
 *
 * @param {object} input
 * @param {string} input.pwshName - the placement spelling (the trusted
 *   assembly places this definition; the Kernel owns the name, § CI-04).
 * @param {(raw: unknown, corr: object) => Promise<object>} input.pwshExecutor
 *   - the Kernel-assembled governed pwsh executor (closed parse + lane
 *   verdict + injected PA edge + the confined backend or the typed shut
 *   face — the row does not know which).
 */
export function buildPwshRowDefinition({ pwshName, pwshExecutor }) {
  if (typeof pwshExecutor !== 'function') {
    throw new TypeError('PWSH_ROW_EXECUTOR_REQUIRED: the governed pwsh row places over an assembled executor, never a silent half-row')
  }
  return Object.freeze({
    name: pwshName,
    description: 'Execute a PowerShell command (`pwsh -NoLogo -NoProfile -NonInteractive -Command`) inside this member\'s admitted working root. Prefer PowerShell syntax (`Get-ChildItem`, `$env:NAME`, backtick continuation); multi-line scripts are supported. The command runs under the mount\'s confined provider: filesystem writes land only inside the admitted working root. Foreground only — a timed-out command is terminated, never promoted to a background job.',
    parameters: PWSH_ROW_PARAMETERS,
    // Transport (the bash row's law on this wire): every outcome — present,
    // cancelled, refused — answers as exactly one `{ text }`; the mount
    // decorates the row with its presentation face. Stable, model-visible,
    // no stack, ever.
    execute: async (raw, exec) => {
      const corr = {
        ...(exec?.token === undefined ? {} : { token: exec.token }),
        ...(typeof exec?.tokenKey === 'string' && exec.tokenKey.length > 0 ? { correlation: exec.tokenKey } : {}),
        ...(exec?.signal === undefined ? {} : { signal: exec.signal }),
      }
      const outcome = await pwshExecutor(raw, corr)
      const text = outcome !== null && typeof outcome === 'object' && typeof outcome.text === 'string'
        ? outcome.text
        : 'refused-executor pwsh-row-unanswered — the governed pwsh executor produced no answer'
      return { text }
    },
  })
}
