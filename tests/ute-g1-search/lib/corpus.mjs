/**
 * corpus.mjs — the G1-SEARCH golden-vector corpus (grep + glob).
 *
 * One vector = one declared read lane + one fixture pre-state + one ordered
 * invocation + the claims the old path must satisfy. The corpus is executed by
 * `capture-old-path.mjs` through the PRODUCT route-C composition (see
 * `lib/world.mjs`) and recorded into `golden/old-path.tsv`.
 *
 * `entry` is the member that produced the effect (`grep` or `glob`), so the
 * retirement unit's member coverage is machine-derivable from the fixture's
 * `entry` column (see scripts/ute-retirement-gate.mjs).
 *
 * `expect` is the DESIGN CLAIM, checked against the captured old path: a claim
 * the old path does not satisfy is a CORPUS BUG (reported RED), never a green.
 * It is never checked against the tool's own prose — see `lib/effect-oracle.mjs`
 * for the witnesses each field is derived from.
 *
 * COVERAGE, and the gaps stated:
 *   grep: in-lane match, the path-less stdin arm (the measured product
 *   behaviour, see SR-G2), out-of-lane denial, a bound-subtree denial, a
 *   missing target, an invalid pattern, cancellation before dispatch, the
 *   retention/limit boundary (250 of 300), and a binary-file arm.
 *   glob: a known in-lane path set, out-of-lane denial, a bound-subtree denial,
 *   a missing target, an invalid pattern, cancellation before dispatch.
 *   NOT covered: multi-line/context/case-mode flags (the host `grep` schema has
 *   none), `head_limit`-style caller caps (the host schema has none: the cap is
 *   the deployment's `grepMaxMatches`, exercised by SR-G8), stream-drain
 *   truncation of the raw stdout (no reachable cap on this fixture), glob's
 *   over-cap sampling (`sampleOverCapGlobResults`, not configured on the
 *   product route — the shadow takes the host default), symlink escapes (the
 *   confined face refuses the locator lexically; no search-specific vector),
 *   and any LIVE boot.
 *
 * @module tests/ute-g1-search/lib/corpus
 */

/** The secret token planted outside the read lane. */
export const SEARCH_SECRET = 'UTE3_SEARCH_OUTLANE_SECRET_5be1'
/** The token planted inside the lane. */
export const SEARCH_NEEDLE = 'UTE3_SEARCH_INLANE_NEEDLE'
/** A token that is never present anywhere (the zero-result arm). */
export const SEARCH_ABSENT = 'UTE3_SEARCH_ABSENT_NEEDLE_0c7d'

/** The agent's cwd token (resolved by the harness to an absolute path). */
const CWD = 'inside'

/** Lane tokens are resolved to absolute paths by each harness. */
const INSIDE = ['inside']
const BOUND = ['inside/bound']

/** SR-G8's fixture: 300 matching lines, above the host's 250-match retention cap. */
const MANY_MATCHES = Array.from({ length: 300 }, (_, index) => `${SEARCH_NEEDLE} line ${index}`).join('\n') + '\n'

export const CORPUS = Object.freeze([
  // ── grep ─────────────────────────────────────────────────────────────────
  {
    id: 'SR-G1-inlane-match',
    entry: 'grep',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [
      { op: 'writeFile', path: 'inside/a.txt', content: `${SEARCH_NEEDLE} alpha\nplain line\n` },
      { op: 'writeFile', path: 'inside/sub/b.txt', content: `${SEARCH_NEEDLE} beta\n` },
    ],
    steps: [{ tool: 'grep', args: { pattern: SEARCH_NEEDLE, path: 'inside' } }],
    expect: {
      outcome: 'allow',
      refusal: null,
      matches: { count: 2, paths: ['a.txt', 'sub/b.txt'] },
      fsUnchanged: true,
    },
    note: 'an in-lane grep finds both matching lines; the match set is the observed effect and the tree is untouched',
  },
  {
    id: 'SR-G2-no-path-stdin',
    entry: 'grep',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [
      { op: 'writeFile', path: 'inside/a.txt', content: `${SEARCH_NEEDLE} alpha\nplain line\n` },
    ],
    steps: [{ tool: 'grep', args: { pattern: SEARCH_NEEDLE } }],
    expect: {
      outcome: 'allow',
      refusal: null,
      matches: { count: 0, paths: [] },
      fsUnchanged: true,
    },
    note: 'MEASURED PRODUCT FACT: the host `grep` description says a missing `path` defaults to the session workspace, but on the confined face the path operand is omitted from argv and the child\'s fd 0 is a readable socket, so ripgrep searches stdin and answers ZERO matches. Recorded as the product behaviour (a semantic difference from the governed plane, which always passes `.`), never as a lane refusal',
  },
  {
    id: 'SR-G3-outside-denied',
    entry: 'grep',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'outside/secret.txt', content: `${SEARCH_SECRET}\n` }],
    steps: [{ tool: 'grep', args: { pattern: SEARCH_SECRET, path: 'outside' } }],
    expect: { outcome: 'deny', refusal: 'denied-by-lane', matches: null, fsUnchanged: true },
    note: 'the read lane is the upper bound: the out-of-lane root is refused before any spawn, and no out-of-lane byte reaches the model',
  },
  {
    id: 'SR-G4-lane-bound',
    entry: 'grep',
    cwd: 'inside/bound',
    lane: { read: BOUND, write: BOUND },
    setup: [{ op: 'writeFile', path: 'inside/a.txt', content: `${SEARCH_NEEDLE} outside-the-bound-subtree\n` }],
    steps: [{ tool: 'grep', args: { pattern: SEARCH_NEEDLE, path: 'inside' } }],
    expect: { outcome: 'deny', refusal: 'denied-by-lane', matches: null, fsUnchanged: true },
    note: 'the declared read lane is a bound subtree: a directory inside the world but outside every declared read root is refused',
  },
  {
    id: 'SR-G5-missing-target',
    entry: 'grep',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'grep', args: { pattern: SEARCH_NEEDLE, path: 'inside/absent' } }],
    expect: { outcome: 'deny', refusal: 'missing-path', matches: null, fsUnchanged: true },
    note: 'a missing search root is refused; the class is derived from the observed deny locator NOT EXISTING on disk (the confined face reports IO_READ_DENIED for it, so the code alone would be ambiguous)',
  },
  {
    id: 'SR-G6-invalid-pattern',
    entry: 'grep',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/a.txt', content: `${SEARCH_NEEDLE} alpha\n` }],
    steps: [{ tool: 'grep', args: { pattern: 'UTE3_[unclosed', path: 'inside' } }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', matches: null, fsUnchanged: true },
    note: 'ripgrep rejects the regex (exit 2); the tool reports a pattern rejection, not an empty result',
  },
  {
    id: 'SR-G7-cancel-before-dispatch',
    entry: 'grep',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/a.txt', content: `${SEARCH_NEEDLE} alpha\n` }],
    steps: [{ tool: 'grep', args: { pattern: SEARCH_NEEDLE, path: 'inside' }, abort: true }],
    expect: { outcome: 'deny', refusal: 'cancelled', matches: null, fsUnchanged: true },
    note: 'cancellation is expressible only BEFORE dispatch on this path (a pre-aborted signal is refused by the registry); a mid-search cancellation arm is not claimed',
  },
  {
    id: 'SR-G8-retention-limit',
    entry: 'grep',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/many.txt', content: MANY_MATCHES }],
    steps: [{ tool: 'grep', args: { pattern: SEARCH_NEEDLE, path: 'inside/many.txt' } }],
    expect: {
      outcome: 'allow',
      refusal: null,
      matches: { count: 300, paths: ['many.txt'], retained: 250 },
      fsUnchanged: true,
    },
    note: 'the retention boundary is real: the tool observed 300 matches but presents 250 (the host GREP_MAX_MATCHES default) and says so; no spillStore is mounted in this world, so the complete result cannot be saved and the text says that instead of inventing a locator',
  },
  {
    id: 'SR-G9-binary-file',
    entry: 'grep',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/bin.dat', base64: 'AAECAABVVEUzX1NFQVJDSF9JTkxBTkVfTkVFRExFCg==' }],
    steps: [{ tool: 'grep', args: { pattern: SEARCH_NEEDLE, path: 'inside/bin.dat' } }],
    expect: { outcome: 'allow', refusal: null, matches: { count: 1, paths: ['bin.dat'] }, fsUnchanged: true },
    note: 'MEASURED, not assumed: a binary file is SEARCHED (one match whose line carries the file\'s NUL bytes), not skipped. The byte-level line is digested, never embedded in the fixture',
  },

  // ── glob ─────────────────────────────────────────────────────────────────
  {
    id: 'SR-L1-inlane-known-set',
    entry: 'glob',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [
      { op: 'writeFile', path: 'inside/a.txt', content: 'alpha\n' },
      { op: 'writeFile', path: 'inside/sub/b.txt', content: 'beta\n' },
      { op: 'writeFile', path: 'inside/sub/c.md', content: 'gamma\n' },
    ],
    steps: [{ tool: 'glob', args: { pattern: '**/*.txt', path: 'inside' } }],
    expect: {
      outcome: 'allow',
      refusal: null,
      matches: { count: 2, paths: ['a.txt', 'sub/b.txt'] },
      fsUnchanged: true,
    },
    note: 'an in-lane glob lists the known .txt set through the same confined face; the walk ORDER is not claimed (the digest is over the canonical sorted set)',
  },
  {
    id: 'SR-L2-outside-denied',
    entry: 'glob',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'outside/secret.txt', content: `${SEARCH_SECRET}\n` }],
    steps: [{ tool: 'glob', args: { pattern: '**/*.txt', path: 'outside' } }],
    expect: { outcome: 'deny', refusal: 'denied-by-lane', matches: null, fsUnchanged: true },
    note: 'glob rides the SAME confined face: an out-of-lane root is refused before any spawn and no out-of-lane path is listed',
  },
  {
    id: 'SR-L3-lane-bound',
    entry: 'glob',
    cwd: 'inside/bound',
    lane: { read: BOUND, write: BOUND },
    setup: [{ op: 'writeFile', path: 'inside/a.txt', content: 'alpha\n' }],
    steps: [{ tool: 'glob', args: { pattern: '**/*.txt', path: 'inside' } }],
    expect: { outcome: 'deny', refusal: 'denied-by-lane', matches: null, fsUnchanged: true },
    note: 'the bound subtree is the upper bound for the walk too',
  },
  {
    id: 'SR-L4-missing-target',
    entry: 'glob',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'glob', args: { pattern: '**/*.txt', path: 'inside/absent' } }],
    expect: { outcome: 'deny', refusal: 'missing-path', matches: null, fsUnchanged: true },
    note: 'a missing walk root is refused, classified by the observed deny locator not existing on disk',
  },
  {
    id: 'SR-L5-invalid-pattern',
    entry: 'glob',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/a.txt', content: 'alpha\n' }],
    steps: [{ tool: 'glob', args: { pattern: 'UTE3_[unclosed', path: 'inside' } }],
    expect: { outcome: 'deny', refusal: 'invalid-argument', matches: null, fsUnchanged: true },
    note: 'ripgrep rejects the glob (`error parsing glob`), so an invalid pattern is a typed refusal, not an empty listing',
  },
  {
    id: 'SR-L6-cancel-before-dispatch',
    entry: 'glob',
    cwd: CWD,
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/a.txt', content: 'alpha\n' }],
    steps: [{ tool: 'glob', args: { pattern: '**/*.txt', path: 'inside' }, abort: true }],
    expect: { outcome: 'deny', refusal: 'cancelled', matches: null, fsUnchanged: true },
    note: 'cancellation before dispatch, the same arm as grep; a mid-walk cancellation is not claimed',
  },
])
