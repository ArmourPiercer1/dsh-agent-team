/**
 * process-family/src/bash-normalizer — the Family PURE normalizer for the
 * shell-class (`bash` / `pwsh`) operation projection (U6 PR3; the slice-plan
 * law "canonical-operation.ts: shell projection → family normalizer +
 * kernel-side fingerprint (bash/pwsh golden vectors…)").
 *
 * This is the SAME split U6 PR2 established for `read`
 * (`packages/tools/fs-family/src/read-normalizer.ts`): the Family's part is
 * PURE — it turns the call arguments into the security-relevant shell-class
 * fields and nothing else. It mints NO fingerprint (the authority computes
 * `sha256:` over the lossless projection — the fingerprint is kernel-side
 * authority), resolves NO path (the injected resolver seam owns workdir
 * identity in the authority), reads NO clock, performs NO I/O, and imports
 * NOTHING (the zero-import law makes a cycle to the center unexpressable).
 *
 * WHAT MOVED (verbatim law, from master
 * `operation-permission/canonical-operation.ts` `extractShellCommand` +
 * `extractShellEffects`, @ cd54f3b7c):
 *  - `command` — required string, non-blank after trim, carried VERBATIM
 *    (the H2 P1-2 ruling: the command IS the security-relevant field; the
 *    authority hashes it, this normalizer never parses it);
 *  - `workdir` — the tool's own input normalization (omitted/blank ⇒ '.'),
 *    non-string fails closed BEFORE any resolver call;
 *  - `run_in_background` — omitted ⇒ false; present non-boolean fails closed;
 *  - `timeoutMs` — the EXPLICIT value only (never a deployment default or
 *    the executor cap is substituted); present ⇒ finite number > 0;
 *  - `sandbox_permissions` — the requested mode STRING only; any string
 *    (including '') is its own value; mode legality is the upstream
 *    authority at execution.
 * Every malformed shape fails closed with the SAME closed `<tool>-…`
 * reason strings AND the SAME detail shapes master threw (the golden-vector
 * gate `u6-pr3-shell-golden-vectors.test.ts` pins the whole corpus
 * byte-identical against the pre-move recording — durable grants/rules are
 * keyed by the fingerprint this projection feeds).
 *
 * @module process-family/bash-normalizer
 */

/** The closed failure surface. `details` is ABSENT exactly where master's
 *  `canonicalizationFailed(tool, reason)` carried no extra details
 *  (`${tool}-command-missing`, `${tool}-command-empty`); where master did,
 *  `details.key` is `'valueType'` for the `typeof value` reports and
 *  `'value'` for the value-itself reports, and `details.raw` is the RAW
 *  value the authority passes through `toRemoteSafeDetail`. The split is
 *  carried so the error DETAILS stay byte-identical, not just the reason.
 *  (The record gate — arguments not a plain object — stays the AUTHORITY'S
 *  own `asArgumentRecord`, shared across every tool class; it answers the
 *  same `${tool}-command-missing` reason with its own `valueType` detail.) */
export type ShellProjectionFailure = {
  readonly ok: false
  readonly reason:
    | 'bash-command-missing' | 'pwsh-command-missing'
    | 'bash-command-not-a-string' | 'pwsh-command-not-a-string'
    | 'bash-command-empty' | 'pwsh-command-empty'
    | 'bash-workdir-not-a-string' | 'pwsh-workdir-not-a-string'
    | 'bash-run-in-background-not-boolean' | 'pwsh-run-in-background-not-boolean'
    | 'bash-timeout-ms-invalid' | 'pwsh-timeout-ms-invalid'
    | 'bash-sandbox-permissions-not-a-string' | 'pwsh-sandbox-permissions-not-a-string'
  readonly details?: { readonly key: 'value' | 'valueType'; readonly raw: unknown }
}

/** The shell-class security fields, pre-hash. `command` rides VERBATIM
 *  (the authority hashes it into `commandHash`); `workdirInput` is the
 *  resolver INPUT (the authority resolves it; identity is the resolver's). */
export type ShellProjectionFields = {
  readonly command: string
  readonly workdirInput: string
  readonly runInBackground: boolean
  readonly timeoutMs: number | null
  readonly sandboxPermissions: string | null
}

export type ShellProjectionResult =
  | { readonly ok: true; readonly fields: ShellProjectionFields }
  | ShellProjectionFailure

/**
 * Project one shell-class argument record into its security fields.
 * Mirrors master's extraction ORDER exactly (command, then the effect fields
 * in workdir / run_in_background / timeoutMs / sandbox_permissions order —
 * a call with two malformed fields refuses on the FIRST one, and the golden
 * corpus pins which reason wins where).
 *
 * @param tool - the exact shell-class tool name (`'bash'` | `'pwsh'`); the
 *   closed reason strings carry it verbatim (A2C-1: ONE canonicalizer for
 *   the class, the tool name the only separator).
 * @param args - the losslessly-parsed arguments record (the authority has
 *   already established it is a plain object).
 */
export function normalizeShellProjection(
  tool: 'bash' | 'pwsh',
  args: Record<string, unknown>,
): ShellProjectionResult {
  // ── command (the class's security-relevant field) ───────────────────────
  const command = args['command']
  if (command === undefined) {
    return { ok: false, reason: `${tool}-command-missing` }
  }
  if (typeof command !== 'string') {
    return { ok: false, reason: `${tool}-command-not-a-string`, details: { key: 'valueType', raw: typeof command } }
  }
  if (command.trim().length === 0) {
    return { ok: false, reason: `${tool}-command-empty` }
  }

  // ── workdir — the input normalization (the tool's own defaulting); a
  //    non-string fails closed BEFORE the resolver call. ───────────────────
  const workdir = args['workdir']
  let workdirInput: string
  if (workdir === undefined) {
    workdirInput = '.'
  } else if (typeof workdir === 'string') {
    workdirInput = workdir.trim().length === 0 ? '.' : workdir
  } else {
    return { ok: false, reason: `${tool}-workdir-not-a-string`, details: { key: 'valueType', raw: typeof workdir } }
  }

  // ── run_in_background — omitted ⇒ false (foreground: the tool's own
  //    background gate is `args.run_in_background === true`); present but
  //    not a boolean ⇒ fail closed (the tool would reject it). ─────────────
  const runInBackground = args['run_in_background']
  if (runInBackground !== undefined && typeof runInBackground !== 'boolean') {
    return { ok: false, reason: `${tool}-run-in-background-not-boolean`, details: { key: 'value', raw: runInBackground } }
  }

  // ── timeoutMs — the EXPLICIT value only (plan §4.4: never a deployment
  //    default or the executor cap is substituted into the fingerprint);
  //    present ⇒ finite number > 0 (mirrors the upstream `validateBashArgs`
  //    L61–63 @ a66e470204). ───────────────────────────────────────────────
  const timeoutMs = args['timeoutMs']
  if (
    timeoutMs !== undefined &&
    !(typeof timeoutMs === 'number' && Number.isFinite(timeoutMs) && timeoutMs > 0)
  ) {
    return { ok: false, reason: `${tool}-timeout-ms-invalid`, details: { key: 'value', raw: timeoutMs } }
  }

  // ── sandbox_permissions — the requested mode string only; any string
  //    (including '') is its own value — mode legality is the upstream
  //    authority at execution (the Team layer does not mint authority for
  //    anything that will never execute). ─────────────────────────────────
  const sandboxPermissions = args['sandbox_permissions']
  if (sandboxPermissions !== undefined && typeof sandboxPermissions !== 'string') {
    return { ok: false, reason: `${tool}-sandbox-permissions-not-a-string`, details: { key: 'valueType', raw: typeof sandboxPermissions } }
  }

  return {
    ok: true,
    fields: {
      command,
      workdirInput,
      runInBackground: runInBackground ?? false,
      timeoutMs: timeoutMs ?? null,
      sandboxPermissions: sandboxPermissions ?? null,
    },
  }
}
