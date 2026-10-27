/**
 * process-family/src/pwsh-mechanics — the governed PWSH row's closed
 * parameter law, the host-faithful argv/env/paths facts, and the row's
 * presentation (U7-F). The shell-class SECOND row of this family: the same
 * confined-provider law as `bash` (Landlock launcher, byte-pin double gate,
 * frozen lease/terminate — all owned by the provider, see
 * `confined-shell-executor.mjs`), this lane's own faithful command form.
 *
 * FIDELITY SOURCE (pinned host 0.2.0-rc.2 @ 639ed01539):
 *  - parameter law: `packages/shell/tool-pwsh/src/index.ts` `validatePwshArgs`
 *    (`command` + `description` required, non-blank; `timeoutMs` finite > 0;
 *    `workdir` string; `run_in_background` boolean) — the SAME field names
 *    the frozen center canonicalizer reads for the shell class
 *    (`operation-permission/canonical-operation.ts` A2C-1: tool-level
 *    resource key `pwsh`, `bash authority != pwsh authority`; the golden
 *    normalizer `bash-normalizer.ts` already carries the closed
 *    `pwsh-*` projection codes);
 *  - argv law: `packages/shell/pwsh-local/src/index.ts` `argv(spec)`:
 *    `[pwshPath, '-NoLogo', '-NoProfile', '-NonInteractive', '-Command',
 *    ENCODING_PREAMBLE + command]` — the command rides `-Command` as ONE
 *    argv element, NO shell-quoting layer (the quoting law: `execve` argv,
 *    never a re-parsed string);
 *  - env law: the bash row's PATH law (`[['PATH','/usr/bin:/bin']]`) PLUS
 *    the host pwsh tool's documented `ENV_OVERRIDES`
 *    (`NO_COLOR=1`, `PAGER=cat`, `GIT_PAGER=cat`).
 * The whole table is pinned by the golden-vector gate
 * (`test/u7f-pwsh-golden-vectors.test.ts`), the sibling of the shell
 * golden-vector law U6 PR3 established for the projection.
 *
 * DISCLOSED deviations from the native row, stated once here and nowhere
 * else (each is TIGHTER, never wider):
 *  1. `sandbox_permissions`/`justification` are NOT in the closed set — the
 *    governed plane assembles no escalation surface; an escalation-shaped
 *    call is refused by the closed-record law (`pwsh-unknown-parameter`)
 *    BEFORE any authority touch (the native row only shows those fields
 *    when a confiner is composed; here the confined provider IS the law).
 *  2. `run_in_background: true` answers the by-name `background-not-supported`
 *    refusal: the U7-4a governed background arm is the BASH row's creation
 *    lane (its attribution producer pins `names.bash === 'bash'`); a pwsh
 *    background job without attributed creation is not shipped, and the
 *    call is never reinterpreted as foreground.
 *  3. `pwshPath` resolution: the native executor probes Windows candidates
 *    and falls back to bare `pwsh` through PATH. The confined launcher
 *    `execve`s `argv[0]` (no PATH search), so this row resolves an ABSOLUTE
 *    path from the assembly pin (`confined.pwshPath`) or the fixed POSIX
 *    candidate list, POST-CONSUME, and refuses `pwsh-executable-not-found`
 *    before probe and before spawn when nothing exists. Resolution is a
 *    disk check with no policy effect: the spawn surface is the same
 *    provider gate every byte still passes through.
 *
 * @module process-family/pwsh-mechanics
 */
import { existsSync, statSync } from 'node:fs'

/** The row's closed parameter set — EXACTLY these keys (host
 *  `toolPwshParameters` minus the two conditional escalation fields,
 *  deviation 1 above). */
export const PWSH_ROW_PARAMS = Object.freeze(['command', 'description', 'workdir', 'timeoutMs', 'run_in_background'])

/** The host pwsh argv flags, verbatim (`pwsh-local argv()`). */
export const PWSH_ARGV_FLAGS = Object.freeze(['-NoLogo', '-NoProfile', '-NonInteractive', '-Command'])

/** The host's UTF-8 output pinning, verbatim (the statements ride on line 1
 *  after `; ` separators so PowerShell error line numbers stay accurate). */
export const PWSH_ENCODING_PREAMBLE
  = '[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); $OutputEncoding = [System.Text.UTF8Encoding]::new($false); '

/** The confined row's env law: the bash row's PATH law plus the host pwsh
 *  tool's ENV_OVERRIDES. A closed pair list — the provider never inherits
 *  the parent environment. */
export const PWSH_SPAWN_ENV = Object.freeze([
  Object.freeze(['PATH', '/usr/bin:/bin']),
  Object.freeze(['NO_COLOR', '1']),
  Object.freeze(['PAGER', 'cat']),
  Object.freeze(['GIT_PAGER', 'cat']),
])

/** POSIX pwsh install locations (the confined `execve` needs an absolute
 *  path; the native resolver's Windows candidates are not this OS).
 *  First EXISTING file wins — the order is part of the golden table. */
export const PWSH_CANDIDATE_PATHS = Object.freeze([
  '/usr/bin/pwsh',
  '/usr/local/bin/pwsh',
  '/opt/microsoft/powershell/7/pwsh',
])

/** The bash row's core rx grants (the launcher boots under these). */
export const PWSH_CORE_RX_PATHS = Object.freeze(['/bin', '/usr', '/lib'])

/** The default foreground timeout when the call states none (the bash row's
 *  `EXECUTE_TIMEOUT_MS` law, same number, same meaning). */
export const PWSH_DEFAULT_TIMEOUT_MS = 60_000

/** The closed refusal shape (the fs-mutation family-body grammar:
 *  `refused-<class> <code> — <detail>`; stable, no stack). */
const refusal = (refusalClass, code, detail) => ({
  ok: false,
  refusal: { kind: 'refused', refusalClass, code, text: `refused-${String(refusalClass)} ${String(code)} — ${detail}` },
})

/** @returns {string} a short, type-safe rendering of an offending value. */
function describeValue(value) {
  if (value === null) return 'null'
  if (Array.isArray(value)) return 'array'
  return typeof value === 'string' ? `string(${JSON.stringify(value)})` : String(typeof value)
}

/**
 * The governed pwsh closed parameter law — host `validatePwshArgs` field for
 * field, in the host's check ORDER (command, description, timeoutMs,
 * workdir, run_in_background), with the CENTER's frozen `pwsh-*` projection
 * codes for the fields the security projection reads
 * (`bash-normalizer.ts` / canonical-operation A2C-1). Pure: zero FS, zero
 * authority.
 *
 * @param {unknown} raw - the raw model-visible tool arguments.
 * @returns {{ok: true, parsed: Record<string, unknown>, fields: object} | {ok: false, refusal: object}}
 *   `parsed` is the lossless parameter record the PA fingerprint binds
 *   (`{tool:'pwsh', command, description, workdir?, timeoutMs?}` — explicit
 *   values only, the bash row's `parsed.value` law); `fields` carries the
 *   executor facts (trimmed defaults stated HERE, never hidden downstream).
 */
export function parseGovernedPwshArgs(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return refusal('schema', 'pwsh-command-missing', 'the tool arguments must be a plain object')
  }
  const record = /** @type {Record<string, unknown>} */ (raw)
  for (const key of Object.keys(record)) {
    if (!PWSH_ROW_PARAMS.includes(key)) {
      // Deviation 1: escalation-shaped calls land here — closed-record law,
      // refused before any authority/spawn touch.
      return refusal('schema', 'pwsh-unknown-parameter', `unknown parameter '${key}' — this row's closed parameter set is [${PWSH_ROW_PARAMS.join(', ')}]`)
    }
  }
  const command = record.command
  if (command === undefined) return refusal('schema', 'pwsh-command-missing', 'command is required')
  if (typeof command !== 'string') return refusal('schema', 'pwsh-command-not-a-string', `command must be a string (got ${describeValue(command)})`)
  if (command.trim().length === 0) return refusal('schema', 'pwsh-command-empty', 'command must not be blank')
  // `description` — the host's required field (tool-pwsh validatePwshArgs).
  // The center's security projection ignores it (not a shell-class
  // canonicalization field); the row keeps the host's model-facing law.
  const description = record.description
  if (description === undefined) return refusal('schema', 'pwsh-description-missing', 'description is required (a short description of what the command does)')
  if (typeof description !== 'string') return refusal('schema', 'pwsh-description-not-a-string', `description must be a string (got ${describeValue(description)})`)
  if (description.trim().length === 0) return refusal('schema', 'pwsh-description-empty', 'description must not be blank')
  const timeoutMs = record.timeoutMs
  if (timeoutMs !== undefined && (typeof timeoutMs !== 'number' || !Number.isFinite(timeoutMs) || timeoutMs <= 0)) {
    return refusal('schema', 'pwsh-timeout-ms-invalid', `timeoutMs must be a finite number > 0 (got ${describeValue(timeoutMs)})`)
  }
  const workdir = record.workdir
  if (workdir !== undefined && typeof workdir !== 'string') {
    return refusal('schema', 'pwsh-workdir-not-a-string', `workdir must be a string (got ${describeValue(workdir)})`)
  }
  const runInBackground = record.run_in_background
  if (runInBackground !== undefined && typeof runInBackground !== 'boolean') {
    return refusal('schema', 'pwsh-run-in-background-not-boolean', `run_in_background must be a boolean (got ${describeValue(runInBackground)})`)
  }
  if (runInBackground === true) {
    // Deviation 2: by-name refusal, never reinterpreted as foreground.
    return refusal('schema', 'background-not-supported', 'this governed row runs foreground commands only — run_in_background is not provided for pwsh (the governed background arm is the bash creation lane)')
  }
  const parsed = {
    tool: 'pwsh',
    command,
    description,
    ...(workdir !== undefined && workdir.trim().length > 0 ? { workdir } : {}),
    ...(timeoutMs !== undefined ? { timeoutMs } : {}),
  }
  return {
    ok: true,
    parsed,
    fields: {
      command,
      description,
      // the tool's own input normalization (the normalizer law: blank ⇒ '.')
      workdir: workdir === undefined || workdir.trim().length === 0 ? '.' : workdir,
      timeoutMs: timeoutMs ?? null,
    },
  }
}

/**
 * Resolve the pwsh executable for ONE post-consume spawn attempt (the pure
 * pre-gate stays pure: this is the first FS touch of the row's execution
 * arm and it runs only after the PA edge allowed). An assembly pin wins and
 * is the ONLY path tried; otherwise the fixed candidate list, first
 * existing regular file wins.
 *
 * @param {{ pwshPath?: unknown }} confined - the mount's confined provider
 *   config (trusted assembly input, unchanged).
 * @returns {{ path: string } | { path: null; tried: readonly string[] }} the
 *   resolved absolute executable path, or the exhaustive tried list.
 */
export function resolvePwshExecutable(confined) {
  const pinned = confined?.pwshPath
  if (pinned !== undefined) {
    const usable = typeof pinned === 'string' && pinned.startsWith('/') && isExecutableFile(pinned)
    return usable ? { path: pinned } : { path: null, tried: typeof pinned === 'string' ? [pinned] : ['<confined.pwshPath: not a string>'] }
  }
  for (const candidate of PWSH_CANDIDATE_PATHS) {
    if (isExecutableFile(candidate)) return { path: candidate }
  }
  return { path: null, tried: PWSH_CANDIDATE_PATHS }
}

/** @param {string} path - a candidate absolute path. @returns {boolean} */
function isExecutableFile(path) {
  try {
    if (!existsSync(path)) return false
    return statSync(path).isFile()
  } catch {
    // An unreadable stat is NOT an existence proof: fail closed, next arm.
    return false
  }
}

/**
 * Build the confined SpawnRequest CORE for ONE governed pwsh command (the
 * provider's closed request face, `provider.ts` `SpawnRequest`: exactly
 * `{grantFingerprint, realmId, bindingId, memberScope, argv, cwd, env,
 * allowPaths?, exitPassthrough?}` — the timeout is the EXECUTOR's settle
 * race, never a provider field, and there is no hardening knob; `allowPaths`
 * is assembled by the backend, where the bash row's optional `/lib64` probe
 * lives). argv is the host pwsh-local argv VERBATIM modulo the resolved
 * absolute path; `exitPassthrough: true` is the SAME B2 exit-code fidelity
 * law the bash row carries (the payload's own exit status rides the
 * launcher's exit status through `--exit-passthrough`).
 *
 * @param {object} input
 * @param {string} input.realmId - the call's realm.
 * @param {string} input.grantFingerprint - the provider request fingerprint.
 * @param {string} input.bindingId - the row's binding identity.
 * @param {string} input.memberScope - the instance scope (the bash row's
 *   pass-through law).
 * @param {string} input.pwshPath - the resolved absolute executable path.
 * @param {string} input.cwd - the anchored working directory.
 * @param {string} input.command - the opaque command text (verbatim).
 * @returns {object} the request core (argv/env closed; no allowPaths).
 */
export function buildPwshSpawnRequest({ realmId, grantFingerprint, bindingId, memberScope, pwshPath, cwd, command }) {
  return {
    grantFingerprint,
    realmId,
    bindingId,
    memberScope,
    argv: [pwshPath, ...PWSH_ARGV_FLAGS, `${PWSH_ENCODING_PREAMBLE}${command}`],
    cwd,
    env: PWSH_SPAWN_ENV,
    exitPassthrough: true,
  }
}

/** The presentation body prefix (the shell-row grammar's quote marker). */
export const PWSH_BODY_PREFIX = '> '

/** The stable meta footer prefix (this row's own meta line). */
export const PWSH_META_PREFIX = 'pwsh-meta '

/** The row's stream presentation cap (the bash row's DEFAULT_MAX_STREAM_CHARS). */
export const PWSH_MAX_STREAM_CHARS = 65_536

/**
 * Render one pwsh outcome through the row's OWN presentation — the shell-row
 * sentence grammar mirrored for this row (the bash row renders the same
 * grammar through the assembly-injected a5p5 face; the family-body lane
 * imports NOTHING from that dormant lane, so this is the row's home for the
 * same wire law: `pwsh · exit=N [| · timed-out | · cancelled]`, quoted
 * stdout, `stderr:` block, the stable meta footer.
 *
 * @param {{exitCode: number|null, stdout: string, stderr: string, timedOut: boolean, cancelled: boolean, truncated: boolean}} outcome
 * @param {{ maxChars?: number }} [options]
 * @returns {{ text: string, presentationMeta: object }}
 */
export function renderPwshResult(outcome, options = {}) {
  const maxChars = options.maxChars ?? PWSH_MAX_STREAM_CHARS
  const stdoutCut = outcome.stdout.length > maxChars
  const stderrCut = outcome.stderr.length > maxChars
  const meta = {
    kind: 'shell',
    tool: 'pwsh',
    exitCode: outcome.exitCode,
    timedOut: outcome.timedOut,
    cancelled: outcome.cancelled,
    truncated: outcome.truncated || stdoutCut || stderrCut,
  }
  const lines = [
    outcome.cancelled
      ? 'pwsh · cancelled'
      : `pwsh · exit=${String(outcome.exitCode === null ? 'not-observed' : outcome.exitCode)}${outcome.timedOut ? ' · timed-out' : ''}`,
  ]
  const stdout = stdoutCut ? outcome.stdout.slice(0, maxChars) : outcome.stdout
  if (stdout.length === 0) {
    lines.push(`${PWSH_BODY_PREFIX}(empty stdout)`)
  } else {
    lines.push(...indented(stdout))
  }
  if (meta.truncated) lines.push(`${PWSH_BODY_PREFIX}… output truncated …`)
  const stderr = stderrCut ? outcome.stderr.slice(0, maxChars) : outcome.stderr
  if (stderr.length > 0) {
    lines.push('stderr:')
    lines.push(...indented(stderr))
  }
  lines.push(PWSH_META_PREFIX + JSON.stringify(meta))
  return { text: lines.join('\n'), presentationMeta: meta }
}

/** @param {string} text @returns {string[]} */
function indented(text) {
  return text.split('\n').map((line) => `${PWSH_BODY_PREFIX}${line}`)
}
