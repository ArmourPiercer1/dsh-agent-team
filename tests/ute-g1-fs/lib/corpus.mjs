/**
 * corpus.mjs — the G1-FS golden-vector corpus for the FS tool family.
 *
 * One vector = one declared lane + one fixture pre-state + one ordered
 * invocation + the observed effects to snapshot. The corpus is written once and
 * executed by BOTH paths:
 *
 *   - `capture-old-path.mjs` runs it through the LEGACY governed path
 *     (0.2.0-rc.2 host + the product route-C realm) and records
 *     `golden/old-path.tsv`;
 *   - `run-prototype.mjs` runs it through the NEXT host (0.2.0-rc.5) with the
 *     prototype confined provider and compares the record to that fixture.
 *
 * `expect` is the DESIGN CLAIM, checked against the captured old path (a claim
 * the old path does not satisfy is a corpus bug, reported RED). It is never
 * checked against the new path directly — the new path is graded against the
 * old-path golden, so an old-path quirk cannot be "fixed" by re-declaring it.
 *
 * COVERAGE (and the gaps, stated): write-overwrite, create, edit, mode
 * preservation, lane refusals on both axes, write⇒read (unobserved existing
 * target), stale edit, symlink escape, and a content-leak check. NOT covered:
 * delete/move (the FS tool family exposes no model-facing delete/move tool —
 * the provider-level operations exist but the old governed path does not guard
 * them at all, so there is no old-path effect to be equivalent to); `read`
 * confinement as a POSITIVE proof (the oracle can only see the result text and
 * the file's unchanged bytes, never the absence of an `open()`); large-file
 * streaming windows; `read_image`.
 *
 * @module tests/ute-g1-fs/lib/corpus
 */

/** The secret token the leak vectors plant outside the read lane. */
export const SECRET_TOKEN = 'UTE_G1_SECRET_DO_NOT_READ_7f3a'
/** A token that must never come back on an unobserved-overwrite refusal. */
export const UNREAD_TOKEN = 'UTE_G1_UNREAD_ORIGINAL_9c1d'

/** Lane tokens are resolved to absolute paths by each harness. */
const INSIDE = ['inside']
const BOUND = ['bound']

export const CORPUS = Object.freeze([
  {
    id: 'FS-W1-create',
    entry: 'write',
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'write', args: { file_path: 'inside/created.txt', content: 'ute-g1 create\n' } }],
    effects: ['inside/created.txt'],
    leaks: [],
    expect: { outcome: 'allow', refusal: null },
    note: 'a create inside the write lane really lands the bytes',
  },
  {
    id: 'FS-W2-overwrite-read',
    entry: 'write',
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/doc.txt', content: 'alpha beta\n' }],
    steps: [
      { tool: 'read', args: { file_path: 'inside/doc.txt' } },
      { tool: 'write', args: { file_path: 'inside/doc.txt', content: 'gamma delta\n' } },
    ],
    effects: ['inside/doc.txt'],
    leaks: [],
    expect: { outcome: 'allow', refusal: null },
    note: 'the observed read-then-write path changes exactly those bytes',
  },
  {
    id: 'FS-W3-unobserved-overwrite',
    entry: 'write',
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/unread.txt', content: `${UNREAD_TOKEN}\n` }],
    steps: [{ tool: 'write', args: { file_path: 'inside/unread.txt', content: 'replacement\n' } }],
    effects: ['inside/unread.txt'],
    leaks: [UNREAD_TOKEN],
    expect: { outcome: 'deny', refusal: 'write-requires-read' },
    note: 'an existing target that was not read is refused and its bytes stay put; the refusal must not echo them',
  },
  {
    id: 'FS-W4-outside-write',
    entry: 'write',
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'write', args: { file_path: 'outside/escape.txt', content: 'evil\n' } }],
    effects: ['outside/escape.txt'],
    leaks: [],
    expect: { outcome: 'deny', refusal: 'lane-deny' },
    note: 'the declared write lane is the upper bound; the target does not exist afterwards',
  },
  {
    id: 'FS-E1-edit-read',
    entry: 'edit',
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/edit.txt', content: 'alpha beta\n' }],
    steps: [
      { tool: 'read', args: { file_path: 'inside/edit.txt' } },
      { tool: 'edit', args: { file_path: 'inside/edit.txt', old_string: 'alpha', new_string: 'omega' } },
    ],
    effects: ['inside/edit.txt'],
    leaks: [],
    expect: { outcome: 'allow', refusal: null },
    note: 'a literal edit after an observed read lands the replacement',
  },
  {
    id: 'FS-E2-stale-edit',
    entry: 'edit',
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/stale.txt', content: 'one\n' }],
    steps: [
      { tool: 'read', args: { file_path: 'inside/stale.txt' } },
      { op: 'externalWrite', path: 'inside/stale.txt', content: 'two-changed-by-someone-else\n' },
      { tool: 'edit', args: { file_path: 'inside/stale.txt', old_string: 'one', new_string: 'three' } },
    ],
    effects: ['inside/stale.txt'],
    leaks: [],
    expect: { outcome: 'deny', refusal: 'stale-version' },
    note: 'an edit against a version observed before an external write is refused; the external bytes survive',
  },
  {
    id: 'FS-W5-write-axis',
    entry: 'write',
    lane: { read: INSIDE, write: BOUND },
    setup: [{ op: 'writeFile', path: 'inside/doc.txt', content: 'alpha beta\n' }],
    steps: [{ tool: 'write', args: { file_path: 'inside/doc.txt', content: 'nope\n' } }],
    effects: ['inside/doc.txt'],
    leaks: [],
    expect: { outcome: 'deny', refusal: 'lane-deny' },
    note: 'read coverage does not widen the write axis',
  },
  {
    id: 'FS-S1-symlink-escape',
    entry: 'write',
    lane: { read: INSIDE, write: INSIDE },
    setup: [
      { op: 'writeFile', path: 'outside/sym-target.txt', content: 'ORIGINAL\n' },
      { op: 'symlink', path: 'inside/escape-link.txt', target: 'outside/sym-target.txt' },
    ],
    steps: [{ tool: 'write', args: { file_path: 'inside/escape-link.txt', content: 'PWNED\n' } }],
    effects: ['outside/sym-target.txt'],
    leaks: [],
    expect: { outcome: 'deny', refusal: 'lane-deny' },
    note: 'an in-lane symlink to an out-of-lane file is refused on the RESOLVED path, not the authored one',
  },
  {
    id: 'FS-R1-outside-read-leak',
    entry: 'read',
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'outside/secret.txt', content: `${SECRET_TOKEN}\n` }],
    steps: [{ tool: 'read', args: { file_path: 'outside/secret.txt' } }],
    effects: ['outside/secret.txt'],
    leaks: [SECRET_TOKEN],
    expect: { outcome: 'deny', refusal: 'lane-deny' },
    note: 'the refusal must not carry the bytes; it does NOT prove no read syscall happened',
  },
  {
    id: 'FS-M1-mode-preserved',
    entry: 'write',
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/mode.txt', content: 'one\n', mode: 0o600 }],
    steps: [
      { tool: 'read', args: { file_path: 'inside/mode.txt' } },
      { tool: 'write', args: { file_path: 'inside/mode.txt', content: 'two\n' } },
    ],
    effects: ['inside/mode.txt'],
    leaks: [],
    expect: { outcome: 'allow', refusal: null },
    note: 'an overwrite preserves the target mode (0o600 stays 0o600), and the create vector records the umask default',
  },
])

