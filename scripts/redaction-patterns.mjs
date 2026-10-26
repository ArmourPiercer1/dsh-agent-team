/**
 * redaction-patterns.mjs — the ONE credential-redaction vocabulary of this repository.
 *
 * Moved VERBATIM out of `scripts/sanitize-evidence.mjs` (U7-3 / EB4-B) so that the evidence
 * sanitizer and the call-chain diagnostic (`scripts/diag-call-chain.mjs`) redact with the same
 * table. Two copies of a redaction list drift, and the drift is invisible: both keep passing
 * their own tests while one of them starts printing a credential. Library only: importing this
 * module has no side effects.
 *
 * `[name, regex, replacement, appliesToSanitizedCopiesOnly]`.
 * `appliesToSanitizedCopiesOnly` patterns (absolute paths) are never reported by
 * `--verify`, because committed docs legitimately contain repo paths.
 */
export const PATTERNS = [
  ['boot-token', /(https?:\/\/[^\s"'`]+?\?token=)[A-Za-z0-9_-]{8,}/g, '$1<REDACTED-BOOT-TOKEN>', false],
  ['token-param', /\b(token|access_token|api_key|apikey|x-api-key)=["']?[A-Za-z0-9_\-.=]{8,}/gi, '$1=<REDACTED>', false],
  ['session-cookie', /dsh-auth-[A-Za-z0-9_-]{4,}(=[A-Za-z0-9._\-%=]{4,})?/g, 'dsh-auth-<REDACTED>=<REDACTED>', false],
  ['bearer', /\bBearer\s+[A-Za-z0-9._-]{4,}/gi, 'Bearer <REDACTED>', false],
  // JSON string values of credential-ish keys, any casing/separator.
  ['json-secret-key', /("(?:authorization|cookie|set-cookie|x-api-key|api[_-]?key|apikey|access[_-]?token|token|password|secret)"\s*:\s*")(?:\\.|[^"\\])*(")/gi, '$1<REDACTED>$2', false],
  // YAML / ini style `key: value` for the same vocabulary (the missed case).
  ['yaml-secret-key', /^(\s*(?:-\s+)?["']?(?:authorization|cookie|set-cookie|x-api-key|api[_-]?key|apikey|access[_-]?token|token|password|secret)["']?\s*:\s*)(?:"(?:\\.|[^"\\\r\n])*"|'(?:''|[^'\r\n])*'|[^\r\n"'`]+)/gim, (match, prefix) => {
    // Preserve quotes: this syntax also occurs in pretty-printed JSON.
    const value = match.slice(prefix.length)
    const quote = value[0] === '"' || value[0] === "'" ? value[0] : ''
    return `${prefix}${quote}<REDACTED>${quote}`
  }, false],
  // Cookie headers that visibly carry a session cookie value.
  ['cookie-header', /((?:set-cookie|cookie)\s*[:=]\s*)[^\r\n"'`]*(?:dsh-auth-|v1\.|Bearer)[^\r\n"'`]*/gi, '$1<REDACTED-COOKIE>', false],
  // Absolute paths appear in captured payloads; docs/scripts keep them.
  ['abs-path-posix', /\/(?:home|srv|Users|mnt|var|tmp|opt|workspace)\/[^\s"'`,)\]}\\]*/g, '<ABSOLUTE_PATH>', true],
  ['abs-path-windows', /(?:[A-Za-z]:\\|\\\\)[^\s"'`,)\]}]+/g, '<ABSOLUTE_PATH>', true],
  // Opaque base64url-looking runs. Lowercase-only runs are excluded on purpose:
  // git object ids (40/64 hex) and pinned SHAs are evidence we keep verbatim.
  // Runs with two or more hyphens are excluded (timestamped directory names).
  ['bare-secret', /(?<![-/\w])(?=[A-Za-z0-9_-]{40,}\b)(?=[A-Za-z0-9_-]*[A-Z])(?=[A-Za-z0-9_-]*[a-z])(?=[A-Za-z0-9_-]*[0-9])(?!(?:[A-Za-z0-9_-]*-){2})[A-Za-z0-9_-]{40,}\b(?![-/\w])/g, '<REDACTED-OPAQUE>', false],
]

/**
 * Apply every pattern (including the absolute-path ones) to one string.
 * @returns {{ text: string, counts: Record<string, number> }}
 */
export function redactAll(input) {
  let out = String(input)
  const counts = {}
  for (const [name, re, repl] of PATTERNS) {
    const before = out
    out = out.replace(re, repl)
    const n = before === out ? 0 : (before.match(re) ?? []).length
    if (n > 0) counts[name] = n
  }
  return { text: out, counts }
}
