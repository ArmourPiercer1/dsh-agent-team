/**
 * confined-search-tool.mjs — the model-visible `grep`/`glob` tools, served by
 * the Member's CONFINED `subprocess` face.
 *
 * WHY THIS EXISTS (PD-16, 2026-11-13). The measured hole (recon
 * `a5sf-recon-search`, PR #655): the governed preset mounts the pinned host
 * `@deepseek-ai/dsh-tool-fs-search` row, which injects `subprocess` — NOT
 * `fs` — and the Member realm row shadowed only `bash` (PD-12) and the
 * terminal (PD-13). `grep`/`glob` therefore resolved the INHERITED base
 * `subprocess` service: `rg` ran as a direct child of the Host node process,
 * in the Host's mount/PID/net/user/cgroup namespaces, with no confined
 * launcher on the path and ZERO `a5sf-guard-consult/1` facts. A Member whose
 * compiled read ceiling was one workspace searched `..` and an absolute
 * out-of-lane directory and got the secret bytes back.
 *
 * HOW IT IS SERVED. This module is a NATIVE tool module in the route-C sense,
 * exactly like `confined-bash-tool.mjs` (PD-12): the realm row re-mounts it
 * INSIDE the Member's isolated scope, AFTER the capability deny lane, so the
 * `subprocess` service the host tool's own executor resolves is the CONFINED
 * face mounted on that scope — not the inherited base service. The confined
 * face's `rg` admission derives the invocation's declared read roots from the
 * argv operands (`readIntentsOf`), consults each one against the SAME compiled
 * read lane the `fs` face uses (one evaluator, one `TeamIoDenial`
 * vocabulary), records one `a5sf-guard-consult/1` fact per root, and refuses
 * an out-of-lane root BEFORE any provider call. Zero spawn, zero bytes.
 *
 * WHY IT DELEGATES INSTEAD OF REBUILDING THE TOOLS. `grep` and `glob` are the
 * pinned host's PUBLIC package (`@deepseek-ai/dsh-tool-fs-search`, a declared
 * dependency of this package) and it exports the per-tool registration faces
 * (`applyGrepTool`, `applyGlobTool`) plus their caps constants. Registering
 * those two here keeps the tool NAME, the parameter schema, the argv
 * templates and the result formatting BYTE-IDENTICAL to the shipped
 * definitions — the "surface-neutral" requirement — while the execution
 * seam underneath is this scope's confined `subprocess`. A local copy of
 * the argv/parse/format logic would drift from the pin and could emit an
 * argv shape the confined face's allow-list refuses.
 *
 * TWO-WAY LANE SEMANTICS (measured, disclosed, not silently changed):
 *   - a search root whose ancestor/VCS ignore discovery would leave the
 *     read lane is run with `--no-ignore-parent --no-ignore-vcs` by the
 *     confined face itself (`laneSafeSearchArgv`), and the allow fact
 *     carries `SEARCH_IGNORE_DISCOVERY_NOTES`. `.gitignore` semantics are
 *     therefore OFF for that invocation (a file the `.gitignore` would hide
 *     IS searched) — the alternative is an `rg` that reads a lane-denied
 *     `.git` and dies with exit 2. A root whose discovery stays in the lane
 *     keeps ordinary ripgrep semantics untouched.
 *   - `include`/`pattern`/`path` are model values passed as unquoted argv
 *     elements (no shell layer exists), so the face's rg allow-list and the
 *     caller's declared roots are the only things between the model and the
 *     process.
 *
 * WHAT THIS DOES NOT DO (stated so the fix cannot be read as more):
 *   - it does not add a second policy source. The lane is the compiled
 *     `EffectiveIo` the realm already mounted; this module holds no rule,
 *     reads no blueprint and evaluates nothing.
 *   - it does not attribute reads inside `rg` beyond the declared roots: the
 *     OS profile (Landlock) remains the boundary for what the admission did
 *     not name — the same disclosure the process face carries.
 *
 * CORE PATCH BUDGET = 0: no upstream source is touched. This is our package's
 * module, mounted through the existing public route-C seam.
 *
 * @module @dsh-agent-team/runtime/plugin/live/confined-search-tool
 */
import {
  GLOB_MAX_RESULTS,
  GREP_MAX_LINE_BYTES,
  GREP_MAX_MATCHES,
  RAW_OUTPUT_MAX_BYTES,
  SEARCH_GRACE_MS,
  SEARCH_META_MAX_BYTES,
  SEARCH_STDERR_MAX_BYTES,
  SEARCH_TIMEOUT_MS,
  applyGlobTool,
  applyGrepTool,
} from '@deepseek-ai/dsh-tool-fs-search'

export const name = 'a5sf-confined-search'

/**
 * `subprocess` is the CONFINED face the realm mounts on the isolated scope.
 * The mount seam refuses a `subprocess`-consuming module on a realm that owns
 * no such face (`SUBPROCESS_UNCONFINED_REALM`) instead of letting it resolve
 * the inherited base service — the exact fallback this module exists to close.
 * `systemPrompt` is injected because the host's per-tool faces register their
 * own `tool:grep` / `tool:glob` prompt sections.
 */
export const inject = ['tools', 'systemPrompt', 'subprocess']

/** The search tool names this module can place (the shipped spellings). */
export const A5SF_CONFINED_SEARCH_TOOLS = Object.freeze(['grep', 'glob'])

function positiveInteger(value, fallback, key) {
  if (value === undefined || value === null) return fallback
  if (!Number.isInteger(value) || value < 1) {
    throw new TypeError(`a5sf-confined-search: config.${key} must be a positive integer when present`)
  }
  return value
}

/**
 * Resolve the caps both host registration faces consume.
 *
 * The defaults are the HOST's own exported defaults, so a composition that
 * configures nothing gets the shipped numbers rather than a second, quietly
 * different set. A composition may narrow them (never below 1); the caps are
 * retention/timeout budgets, not policy, so they cannot widen a lane.
 */
export function searchCapsOf(config) {
  const grep = Object.freeze({
    maxMatches: positiveInteger(config?.grepMaxMatches, GREP_MAX_MATCHES, 'grepMaxMatches'),
    maxLineBytes: positiveInteger(config?.grepMaxLineBytes, GREP_MAX_LINE_BYTES, 'grepMaxLineBytes'),
    maxMetaBytes: positiveInteger(config?.searchMetaMaxBytes, SEARCH_META_MAX_BYTES, 'searchMetaMaxBytes'),
    rawOutputMaxBytes: positiveInteger(config?.rawOutputMaxBytes, RAW_OUTPUT_MAX_BYTES, 'rawOutputMaxBytes'),
    graceMs: positiveInteger(config?.graceMs, SEARCH_GRACE_MS, 'graceMs'),
    stderrMaxBytes: positiveInteger(config?.stderrMaxBytes, SEARCH_STDERR_MAX_BYTES, 'stderrMaxBytes'),
    timeoutMs: positiveInteger(config?.timeoutMs, SEARCH_TIMEOUT_MS, 'timeoutMs'),
  })
  const glob = Object.freeze({
    sampleOverCapGlobResults: config?.sampleOverCapGlobResults !== false,
    maxResults: positiveInteger(config?.globMaxResults, GLOB_MAX_RESULTS, 'globMaxResults'),
    maxMetaBytes: grep.maxMetaBytes,
    rawOutputMaxBytes: grep.rawOutputMaxBytes,
    graceMs: grep.graceMs,
    stderrMaxBytes: grep.stderrMaxBytes,
    timeoutMs: grep.timeoutMs,
  })
  return Object.freeze({ grep, glob })
}

/**
 * Which of the two tools this mount places.
 *
 * The ROW passes the subset of names the Member can already SEE, because the
 * route-C attach is surface-neutral: a module that registers a name the agent
 * cannot see would ADD a tool (a governance change) and is refused by the
 * attach. Absent config = both shipped names (the direct-seam default).
 */
export function searchToolsOf(config) {
  const configured = config?.tools
  if (configured === undefined || configured === null) return A5SF_CONFINED_SEARCH_TOOLS
  if (!Array.isArray(configured)) {
    throw new TypeError('a5sf-confined-search: config.tools must be an array of search tool names when present')
  }
  const unknown = configured.filter((tool) => !A5SF_CONFINED_SEARCH_TOOLS.includes(tool))
  if (unknown.length > 0) {
    throw new TypeError(`a5sf-confined-search: config.tools names unknown search tool(s) ${JSON.stringify(unknown)} (the shipped spellings are ${JSON.stringify(A5SF_CONFINED_SEARCH_TOOLS)})`)
  }
  return Object.freeze([...new Set(configured)])
}

export function apply(ctx, config) {
  const tools = searchToolsOf(config)
  const caps = searchCapsOf(config)
  if (tools.includes('grep')) applyGrepTool(ctx, caps.grep)
  if (tools.includes('glob')) applyGlobTool(ctx, caps.glob)
}
