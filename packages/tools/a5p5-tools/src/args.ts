/**
 * `a5p5-tools` Phase 1 — STRICT argument parsing for `grep` / `glob` / `bash`
 * (design pipeline stage 1: "parse args").
 *
 * THE PARSE LAW IS IMPORTED, NOT RESTATED: unknown fields are reported with
 * the frozen `closeRecordKeys` law, required strings with `reqString`, closed
 * enumerations with `closedValue`, and every outcome — good or bad — finishes
 * through `finish` into the PR0 `ParseResult`/`ToolContractProblem`
 * vocabulary. This lane adds NO second problem code and NO partial
 * acceptance: a refusal lists every defect, a success materializes every
 * default (nothing hidden), and results are deep-frozen.
 *
 * TARGET CLASSIFICATION (architecture.md target-path law + `resource.ts`
 * locator law, enforced BEFORE any canonicalization): blank, URI-scarred and
 * leading-`\` locators are refused; a relative `..` segment is refused on
 * EVERY spelling before any lexical collapse; `~/` classifies as realm-home,
 * POSIX/Windows absolutes as absolute-path, everything else as
 * workspace-relative. Legal whitespace is PRESERVED — `trim()` would rename
 * a file. Canonicalization to an OS path stays the trusted provider's job at
 * exec time (Alpha.4 A2-3: this layer manufactures no canonical key).
 *
 * RANGES REFUSE, NEVER CLAMP (a silent clamp is a policy the model never
 * asked for): `context` ∈ [0, 20], `max_results` ∈ [1, 5000], `timeout` ∈
 * [1, 600000] ms.
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/args
 */

import {
  closeRecordKeys,
  closedValue,
  finish,
  reqString,
  type ParseResult,
  type ProblemSink,
} from '../../../domain/tool-governance/src/parse-util.js'
import {
  GREP_OUTPUT_MODES,
  type GrepOutputMode,
  type ParsedShellArgs,
  type ParsedGlobArgs,
  type ParsedGrepArgs,
  type ParsedTarget,
} from './types.js'

/** Upper bound of the `context` leg (a wider window is a presentation change, not a search). */
export const MAX_CONTEXT_LINES = 20
/** Upper bound of `max_results` (bounded output; Spill attribution is a later slice). */
export const MAX_SEARCH_RESULTS = 5000
/** Default result window when the caller does not ask for one. */
export const DEFAULT_MAX_SEARCH_RESULTS = 250
/** Upper bound of `timeout` in ms (the provider default may be smaller, never this lane larger). */
export const MAX_TIMEOUT_MS = 600_000

/** Refuse unless the value is a safe integer inside `[min, max]` (typed, never clamped). */
function boundedInt(
  record: Record<string, unknown>,
  key: string,
  min: number,
  max: number,
  path: string,
  problems: ProblemSink,
): number | undefined {
  const raw = record[key]
  if (typeof raw !== 'number' || !Number.isSafeInteger(raw) || raw < min || raw > max) {
    problems.push({ code: 'field-type', path: `${path}.${key}`, detail: `\`${key}\` must be an integer within [${min}, ${max}]` })
    return undefined
  }
  return raw
}

/** Optional boolean: ABSENT takes the default; present-but-not-boolean refuses. */
function optBoolean(
  record: Record<string, unknown>,
  key: string,
  fallback: boolean,
  path: string,
  problems: ProblemSink,
): boolean {
  const raw = record[key]
  if (raw === undefined) return fallback
  if (typeof raw !== 'boolean') {
    problems.push({ code: 'field-type', path: `${path}.${key}`, detail: `\`${key}\` must be a boolean (no truthiness coercion)` })
    return fallback
  }
  return raw
}

/** Optional non-empty string: ABSENT stays absent; present-but-blank refuses. */
function optNonEmptyString(
  record: Record<string, unknown>,
  key: string,
  path: string,
  problems: ProblemSink,
): string | undefined {
  const raw = record[key]
  if (raw === undefined) return undefined
  if (typeof raw !== 'string') {
    problems.push({ code: 'field-type', path: `${path}.${key}`, detail: `\`${key}\` must be a string` })
    return undefined
  }
  if (raw.length === 0) {
    problems.push({ code: 'empty-string', path: `${path}.${key}`, detail: `\`${key}\` must be non-empty` })
    return undefined
  }
  return raw
}

/**
 * Classify one target spelling. ABSENT means the workspace root `'.'`.
 * Every refusal here happens BEFORE any canonicalization or collapse — the
 * `..` walk is a segment test, not a post-collapse escape check.
 */
function parseTarget(record: Record<string, unknown>, key: string, path: string, problems: ProblemSink): ParsedTarget | undefined {
  const raw = record[key]
  if (raw === undefined) return Object.freeze({ placement: 'workspace', locator: '.' })
  if (typeof raw !== 'string') {
    problems.push({ code: 'field-type', path: `${path}.${key}`, detail: `\`${key}\` must be a path string` })
    return undefined
  }
  const reject = (detail: string): undefined => {
    problems.push({ code: 'locator-rejected', path: `${path}.${key}`, detail })
    return undefined
  }
  if (raw.trim().length === 0) return reject('a target locator must not be blank')
  if (raw.includes('://')) return reject('a filesystem locator never wears a URI scheme')
  if (raw.split(/[\\/]/).includes('..')) return reject('relative `..` segments are refused')
  if (raw.startsWith('\\')) return reject('UNC/leading-` targets are refused (use an explicit absolute-path grant)')
  if (raw.startsWith('~/')) return Object.freeze({ placement: 'realm-home', locator: raw })
  if (raw.startsWith('/') || /^[A-Za-z]:[\\/]/.test(raw)) return Object.freeze({ placement: 'absolute-path', locator: raw })
  return Object.freeze({ placement: 'workspace', locator: raw })
}

/** Strictly parse raw `grep` arguments (closed shape; every default materialized). */
export function parseGrepArgs(raw: unknown): ParseResult<ParsedGrepArgs> {
  const problems: ProblemSink = []
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'grep arguments must be a record' }] }
  }
  const record = raw as Record<string, unknown>
  closeRecordKeys(record, ['pattern', 'path', 'glob', 'output_mode', 'fixed_string', 'ignore_case', 'multiline', 'context', 'max_results'], '$', problems)
  const pattern = reqString(record, 'pattern', '$', problems)
  const outputMode = closedValue(record, 'output_mode', GREP_OUTPUT_MODES, '$', problems) as GrepOutputMode | undefined
  const target = parseTarget(record, 'path', '$', problems)
  const globFilter = optNonEmptyString(record, 'glob', '$', problems)
  const fixedString = optBoolean(record, 'fixed_string', false, '$', problems)
  const ignoreCase = optBoolean(record, 'ignore_case', false, '$', problems)
  const multiline = optBoolean(record, 'multiline', false, '$', problems)
  const contextLines = record['context'] === undefined ? 0 : boundedInt(record, 'context', 0, MAX_CONTEXT_LINES, '$', problems)
  const maxResults = record['max_results'] === undefined ? DEFAULT_MAX_SEARCH_RESULTS : boundedInt(record, 'max_results', 1, MAX_SEARCH_RESULTS, '$', problems)
  return finish(problems, () => {
    const parsed: ParsedGrepArgs = {
      tool: 'grep',
      pattern: pattern as string,
      target: target as ParsedTarget,
      ...(globFilter === undefined ? {} : { globFilter }),
      outputMode: outputMode as GrepOutputMode,
      fixedString,
      ignoreCase,
      multiline,
      contextLines: contextLines as number,
      maxResults: maxResults as number,
    }
    return parsed
  })
}

/** Strictly parse raw `glob` arguments (filename traversal: pattern + target ONLY). */
export function parseGlobArgs(raw: unknown): ParseResult<ParsedGlobArgs> {
  const problems: ProblemSink = []
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'glob arguments must be a record' }] }
  }
  const record = raw as Record<string, unknown>
  closeRecordKeys(record, ['pattern', 'path'], '$', problems)
  const pattern = reqString(record, 'pattern', '$', problems)
  const target = parseTarget(record, 'path', '$', problems)
  return finish(problems, () => ({
    tool: 'glob' as const,
    pattern: pattern as string,
    target: target as ParsedTarget,
  }))
}

/**
 * Strictly parse raw `bash` arguments. The command text is kept OPAQUE —
 * nothing here inspects it for side effects (law 2 of `types.ts`); its real
 * file/network reach is decided by admission + the confined provider.
 */
export function parseBashArgs(raw: unknown): ParseResult<ParsedShellArgs> {
  const problems: ProblemSink = []
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, problems: [{ code: 'not-a-record', path: '$', detail: 'bash arguments must be a record' }] }
  }
  const record = raw as Record<string, unknown>
  closeRecordKeys(record, ['command', 'cwd', 'timeout', 'background'], '$', problems)
  const command = reqString(record, 'command', '$', problems)
  const cwd = parseTarget(record, 'cwd', '$', problems)
  const timeoutMs = record['timeout'] === undefined ? undefined : boundedInt(record, 'timeout', 1, MAX_TIMEOUT_MS, '$', problems)
  const background = optBoolean(record, 'background', false, '$', problems)
  return finish(problems, () => {
    const parsed: ParsedShellArgs = {
      tool: 'bash',
      command: command as string,
      cwd: cwd as ParsedTarget,
      ...(timeoutMs === undefined ? {} : { timeoutMs }),
      background,
    }
    return parsed
  })
}
