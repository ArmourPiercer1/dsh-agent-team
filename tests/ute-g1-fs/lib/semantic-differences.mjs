/**
 * semantic-differences.mjs — the recorded differences between the old path and
 * the prototype that the comparison harness CANNOT make disappear.
 *
 * WHY THIS FILE EXISTS
 *   The corpus grades effects and refusal CLASSES; it deliberately does not
 *   require equal typed codes, because the two host generations speak different
 *   vocabularies. That tolerance is right for an effect comparison and wrong as
 *   a retirement argument: a semantic difference that only lives in a memo is a
 *   difference someone will discover in production. So every known difference
 *   is declared HERE, printed by `run-prototype.mjs` on every run, and asserted
 *   by `lane-suite.test.mjs` (a difference the harness cannot print is not
 *   recorded).
 *
 * THE CONTRACT
 *   `SEMANTIC-DIFF class=<c> old=<o> new=<n> cause=<cause> reason=<reason> blocking=<yes|no>`
 *   - `class`     the kind of semantic surface (refusal-code, refusal-observation…)
 *   - `old`/`new` the two observed/claimed behaviours
 *   - `cause`     the concrete mechanism that forces the difference (a file:line
 *                 when it is an upstream assumption)
 *   - `reason`    why the prototype does not paper over it
 *   - `blocking`  `yes` when a future retirement/equivalence decision MUST treat
 *                 this difference explicitly (it is not a formatting detail)
 *
 * CHANGE DISCIPLINE: adding or removing an entry changes what the harness prints
 * and what the lane suite asserts. Do not delete an entry to make a run quieter;
 * a difference that stopped existing is retired by editing this list with a
 * pointer to the evidence that measured it gone.
 *
 * @module tests/ute-g1-fs/lib/semantic-differences
 */

/**
 * @typedef {object} SemanticDifference
 * @property {string} id - stable machine id.
 * @property {string} klass - the semantic surface class.
 * @property {string} oldPath - what the legacy governed path does/says.
 * @property {string} newPath - what the prototype does/says.
 * @property {string} cause - the concrete mechanism (file:line for host assumptions).
 * @property {string} reason - why this prototype does not eliminate it.
 * @property {boolean} blocking - must a retirement decision treat it explicitly?
 * @property {string} detail - one paragraph a reader can act on.
 */

/** @type {readonly SemanticDifference[]} */
export const SEMANTIC_DIFFERENCES = Object.freeze([
  Object.freeze({
    id: 'lane-refusal-code',
    klass: 'refusal-code',
    oldPath: 'FS_SANDBOX_DENIED',
    newPath: 'FS_PERMISSION_DENIED',
    cause: 'upstream-deref:packages/fs/tool-fs/src/sandbox.ts:139-143',
    reason: 'not-a-patch',
    blocking: true,
    detail: 'rc.5 tool-fs assumes an FsError with code FS_SANDBOX_DENIED can only come from an '
      + 'fs-sandbox backend that resolved a sandbox policy, and dereferences policy.mode when it '
      + 'sees one (measured crash: "Cannot read properties of undefined (reading \'mode\')"). The '
      + 'prototype is a lane provider, not that backend, so it raises FS_PERMISSION_DENIED for lane '
      + 'refusals. A future retirement decision must either adopt the fs-sandbox protocol (declare '
      + 'sandboxMode, mount sandbox-policy) or keep a non-sandbox code; the old and new paths do NOT '
      + 'emit the same code for the same effect. NOTE: on the MEASURED legacy route-C path the '
      + 'refusal is prose, not FS_SANDBOX_DENIED — FS_SANDBOX_DENIED is the host code the next-path '
      + 'provider would have used if the upstream assumption allowed it.',
  }),
  Object.freeze({
    id: 'refusal-observation-shape',
    klass: 'refusal-observation',
    oldPath: 'prose',
    newPath: 'typed-FsError-code',
    cause: 'host-generation',
    reason: 'class-not-code',
    blocking: true,
    detail: 'The legacy governed path refuses with human messages ("authored locator \'…\' is outside '
      + 'every allow subtree of the lane", "file has not been read — read the file, then retry", '
      + '"file changed since it was read — re-read the file, then retry"); the next host answers with '
      + 'typed FsError codes. The corpus maps both onto one closed class vocabulary (lane-deny, '
      + 'write-requires-read, stale-version, other), which is what makes the vectors comparable at '
      + 'all. A future equivalence oracle that compares CODES directly would go red here for reasons '
      + 'that are not behaviour changes.',
  }),
])

/**
 * Render one difference as the single harness line.
 * @param {SemanticDifference} difference
 * @returns {string}
 */
export function semanticDifferenceLine(difference) {
  return `SEMANTIC-DIFF class=${difference.klass} old=${difference.oldPath} new=${difference.newPath}`
    + ` cause=${difference.cause} reason=${difference.reason} blocking=${difference.blocking ? 'yes' : 'no'}`
    + ` id=${difference.id}`
}

/** Render every difference, in declaration order. */
export function semanticDifferenceLines() {
  return SEMANTIC_DIFFERENCES.map(semanticDifferenceLine)
}

/** The exact shape `semanticDifferenceLine` produces; the lane suite pins it. */
export const SEMANTIC_DIFF_LINE_RE = /^SEMANTIC-DIFF class=\S+ old=\S+ new=\S+ cause=\S+ reason=\S+ blocking=(?:yes|no) id=\S+$/
