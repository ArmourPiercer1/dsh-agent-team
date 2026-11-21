/**
 * semantic-differences.mjs — the MEASURED differences between the old path this
 * baseline records and the behaviour a new path must reproduce.
 *
 * These are not "nice to know": `SemanticDifferencesResolved` is one of the
 * four retirement terms, and a difference is resolved only by an owner-approved
 * record (RETIREMENT.md §3). Every entry here is `blocking: true` and
 * `approval: null`, so the term stays FALSE — which is the true state at B1.
 *
 * A difference is listed because it was OBSERVED in this stage's artifacts, not
 * because it was imagined. Each names where it was measured.
 *
 * @module tests/ute-g1-process/lib/semantic-differences
 */

/**
 * @typedef {object} SemanticDifference
 * @property {string} id
 * @property {boolean} blocking
 * @property {{by: string, on: string, record: string, reference: string}|null} approval
 * @property {string} summary
 * @property {string} evidence
 */

/** @type {readonly SemanticDifference[]} */
export const SEMANTIC_DIFFERENCES = Object.freeze([
  Object.freeze({
    id: 'SD-PROCESS-1-no-truncation-flag',
    blocking: true,
    approval: null,
    summary: 'stdout/stderr are silently TAIL-truncated at the declared 262144-byte cap and the record carries no truncation flag, so a consumer cannot distinguish "the command printed exactly this" from "the head was dropped" (PB-B4: 300022 emitted bytes arrive as exactly 262144 ending with the final marker)',
    evidence: 'tests/ute-g1-process/golden/old-path.tsv row PB-B4-stdout-cap; tests/ute-g1-process/negative-controls.mjs NC-CAP-LOAD-BEARING',
  }),
  Object.freeze({
    id: 'SD-PROCESS-2-killed-exit-status',
    blocking: true,
    approval: null,
    summary: 'a child killed by the caller timeout reports exitCode=null plus a SIGNAL name; the status is not a number and the signal name is excluded from the golden by the printed exclusion set, so a new path must agree on the null-status shape and the caller-visible settle flags (timedOut) rather than on a numeric exit',
    evidence: 'tests/ute-g1-process/golden/old-path.tsv row PB-B5-timeout; tests/ute-g1-process/capture-old-path.mjs OLD-PATH-EXCLUSIONS',
  }),
  Object.freeze({
    id: 'SD-PROCESS-3-pty-face-not-measured',
    blocking: true,
    approval: null,
    summary: 'the shipped product wiring mounts NO governed PTY face, so the measured `bash` is the route-C `confined-bash-tool.mjs` (PD-12) definition over the confined subprocess face; `native-bash-tool.mjs` (NATIVE-BASH-PRESERVATION, the pinned host `bash-persistent` definition) is selected whenever a composition wires `faces.terminals.governedPty`, and that face adds persistent `cd`/`export` state and the `stty -echo`/marker protocol this corpus does NOT cover',
    evidence: 'tests/ute-g1-process/probe-composition.mjs PROBE-OWNER/PROBE-CONCLUSION; packages/runtime/src/plugin/live/a5sf-realm-row.mjs nativeBashPtySpecOf vs confinedBashSpecOf; cordis.patch.yml (the governed preset row is tool-bash, not pending PTY)',
  }),
  Object.freeze({
    id: 'SD-PROCESS-4-refusal-surface',
    blocking: true,
    approval: null,
    summary: 'lane denials are typed `IO_READ_DENIED` with authored-locator prose ("authored locator \'…\' is outside every allow subtree of the lane"), and a missing workdir shares the SAME code with different prose; the corpus compares a closed CATEGORY vocabulary and the filesystem witness, never the code or the sentence, so a new path that answers a different code is compatible only by an approved semantic change',
    evidence: 'tests/ute-g1-process/golden/old-path.tsv rows PB-B7/PB-B12/PB-B14; tests/ute-g1-process/lib/effect-oracle.mjs classifyProcessRefusal',
  }),
  Object.freeze({
    id: 'SD-PROCESS-5-pwsh-member-unreachable',
    blocking: true,
    approval: null,
    summary: 'the census books two members of `dsh.process-family` (`bash`, `pwsh`), but `pwsh` is unreachable on the product route (no route-C shadow, no preset row — the shipped governed preset REMOVES `tool-pwsh` as an un-instrumented second shell) and no `pwsh` binary exists on this machine; the unit is therefore covered 1 of 2, and a new path cannot claim the unit until a pwsh-capable composition and host are measured',
    evidence: 'tests/ute-g1-process/probe-composition.mjs PROBE-PWSH/PROBE-ROUTE-UNREACHABLE; dev/agent-workflow/ledgers/ute-retirement.json process row',
  }),
])

/** Printable lines, FS style (`semantic-differences.mjs` precedent). */
export const SEMANTIC_DIFF_LINE_RE = /^SEMANTIC-DIFF SD-PROCESS-[0-9]+-[a-z0-9-]+ blocking=(?:YES|NO) approval=(?:PENDING|none|by:[^ ]+) — .+$/u

/**
 * @returns {string[]} one line per declared difference.
 */
export function semanticDifferenceLines() {
  return SEMANTIC_DIFFERENCES.map((difference) => {
    const approval = difference.approval === null ? 'PENDING' : `by:${difference.approval.by}`
    return `SEMANTIC-DIFF ${difference.id} blocking=${difference.blocking ? 'YES' : 'NO'} approval=${approval} — ${difference.summary}`
  })
}
