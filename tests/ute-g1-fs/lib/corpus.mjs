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
 * target), stale edit, symlink escape, a content-leak check, and (FS-I*) the
 * `read_image` member: an in-lane image read whose committed attachment bytes
 * are digested, an out-of-lane image refusal with zero attachment bytes, a
 * lane-bound image refusal, a missing-target refusal, the image-capability route
 * refusal, cancellation before dispatch, and the PRODUCT route-C gap (PD-5).
 * NOT covered: delete/move (the FS tool family exposes no model-facing
 * delete/move tool — the provider-level operations exist but the old governed
 * path does not guard them at all, so there is no old-path effect to be
 * equivalent to); `read` confinement as a POSITIVE proof (the oracle can only
 * see the result text and the file's unchanged bytes, never the absence of an
 * `open()`); large-file streaming windows; a `read_image` ALLOW on the product
 * route-C composition (it throws before any image work — the allow vectors run
 * under the disclosed `post-gap-1` composition; see golden/COVERAGE.md).
 *
 * IMAGE VECTOR COMPOSITION. The product route-C composition cannot reach
 * `read_image` at all (`ROUTED_SERVICE_NAMES = ['tools','systemPrompt']` in
 * `packages/runtime/team-services/src/mount.ts:445` ⇒ GAP-FS-CONTRACT-1 / PD-5),
 * so `FS-I0-route-c-gap` records that product fact and the remaining image
 * vectors run the SAME legacy host, SAME real `@deepseek-ai/dsh-tool-fs`
 * module and SAME confined provider under the world factory's `post-gap-1`
 * composition (the one-line deferred-inject merge the FS face already uses to
 * pin the attachment contract). That composition is disclosed per vector here,
 * in `golden/old-path.meta.txt` and in `golden/COVERAGE.md`; it is NOT a claim
 * that the unpatched product route serves `read_image` today.
 *
 * @module tests/ute-g1-fs/lib/corpus
 */

/** The secret token the leak vectors plant outside the read lane. */
export const SECRET_TOKEN = 'UTE_G1_SECRET_DO_NOT_READ_7f3a'
/** A token that must never come back on an unobserved-overwrite refusal. */
export const UNREAD_TOKEN = 'UTE_G1_UNREAD_ORIGINAL_9c1d'

/**
 * A 1x1 RGBA PNG (70 bytes), the same bytes the FS face's own image arms use.
 * `read_image` observes the COMMITTED bytes, so the fixture must be a real
 * decodable PNG, not a text file with an image extension.
 */
export const PIXEL_PNG_BASE64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

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

  // ── read_image (the fourth member of the indivisible FS assembly) ─────────
  // Every row's `effects` also carries a synthetic `@result:…` entry written by
  // the oracle from what the ATTACHMENT STORE received (byte length + sha256 of
  // the committed image bytes) and the model-facing block shape — never from
  // the path string or the tool's self-report. See golden/COVERAGE.md.
  {
    id: 'FS-I0-route-c-gap',
    entry: 'read_image',
    // PR B2 flips this: the prototype provider has no image support yet, so the
    // new-path run cannot reproduce these baselines. Declared, not skipped.
    newPathPending: true,
    composition: 'route-c',
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/pixel.png', base64: PIXEL_PNG_BASE64 }],
    steps: [{ tool: 'read_image', args: { file_path: 'inside/pixel.png' } }],
    effects: ['inside/pixel.png'],
    leaks: [],
    expect: { outcome: 'deny', refusal: 'other' },
    note: 'the PRODUCT route-C composition cannot reach read_image at all (GAP-FS-CONTRACT-1 / PD-5): refused before any image work, zero attachment bytes. Recorded as the route product fact, NOT as a lane refusal',
  },
  {
    id: 'FS-I1-inlane-image',
    entry: 'read_image',
    // PR B2 flips this: the prototype provider has no image support yet, so the
    // new-path run cannot reproduce these baselines. Declared, not skipped.
    newPathPending: true,
    composition: 'post-gap-1',
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/pixel.png', base64: PIXEL_PNG_BASE64 }],
    steps: [{ tool: 'read_image', args: { file_path: 'inside/pixel.png' } }],
    effects: ['inside/pixel.png'],
    leaks: [],
    expect: { outcome: 'allow', refusal: null },
    note: 'an in-lane image read commits EXACTLY ONE attachment; the recorded digest is over the bytes the store received (70-byte PNG), and the model-facing shape must be one text block plus one image block',
  },
  {
    id: 'FS-I2-outside-image-denied',
    entry: 'read_image',
    // PR B2 flips this: the prototype provider has no image support yet, so the
    // new-path run cannot reproduce these baselines. Declared, not skipped.
    newPathPending: true,
    composition: 'post-gap-1',
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'outside/secret.png', base64: PIXEL_PNG_BASE64 }],
    steps: [{ tool: 'read_image', args: { file_path: 'outside/secret.png' } }],
    effects: ['outside/secret.png'],
    leaks: [],
    expect: { outcome: 'deny', refusal: 'lane-deny' },
    note: 'an out-of-lane image read is refused by the lane; the out-of-lane file is unchanged and ZERO attachment bytes were materialised',
  },
  {
    id: 'FS-I3-lane-bound-image',
    entry: 'read_image',
    // PR B2 flips this: the prototype provider has no image support yet, so the
    // new-path run cannot reproduce these baselines. Declared, not skipped.
    newPathPending: true,
    composition: 'post-gap-1',
    lane: { read: BOUND, write: BOUND },
    setup: [{ op: 'writeFile', path: 'inside/pixel.png', base64: PIXEL_PNG_BASE64 }],
    steps: [{ tool: 'read_image', args: { file_path: 'inside/pixel.png' } }],
    effects: ['inside/pixel.png'],
    leaks: [],
    expect: { outcome: 'deny', refusal: 'lane-deny' },
    note: 'the read lane is a bound subtree: a path inside the world but outside every declared read root is refused before bytes or attachment work',
  },
  {
    id: 'FS-I4-missing-image',
    entry: 'read_image',
    // PR B2 flips this: the prototype provider has no image support yet, so the
    // new-path run cannot reproduce these baselines. Declared, not skipped.
    newPathPending: true,
    composition: 'post-gap-1',
    lane: { read: INSIDE, write: INSIDE },
    setup: [],
    steps: [{ tool: 'read_image', args: { file_path: 'inside/absent.png' } }],
    effects: ['inside/absent.png'],
    leaks: [],
    expect: { outcome: 'deny', refusal: 'other' },
    note: 'a missing target is a typed refusal, not an empty image: the file is still absent and no attachment is created',
  },
  {
    id: 'FS-I5-route-unresolved',
    entry: 'read_image',
    // PR B2 flips this: the prototype provider has no image support yet, so the
    // new-path run cannot reproduce these baselines. Declared, not skipped.
    newPathPending: true,
    composition: 'post-gap-1',
    llmModalities: ['text'],
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/pixel.png', base64: PIXEL_PNG_BASE64 }],
    steps: [{ tool: 'read_image', args: { file_path: 'inside/pixel.png' } }],
    effects: ['inside/pixel.png'],
    leaks: [],
    expect: { outcome: 'deny', refusal: 'other' },
    note: 'the image-capability route gate refuses a text-only model BEFORE any fs read or attachment write; zero attachment bytes',
  },
  {
    id: 'FS-I6-cancel-before-dispatch',
    entry: 'read_image',
    // PR B2 flips this: the prototype provider has no image support yet, so the
    // new-path run cannot reproduce these baselines. Declared, not skipped.
    newPathPending: true,
    composition: 'post-gap-1',
    lane: { read: INSIDE, write: INSIDE },
    setup: [{ op: 'writeFile', path: 'inside/pixel.png', base64: PIXEL_PNG_BASE64 }],
    steps: [{ tool: 'read_image', args: { file_path: 'inside/pixel.png' }, abort: true }],
    effects: ['inside/pixel.png'],
    leaks: [],
    expect: { outcome: 'deny', refusal: 'other' },
    note: 'cancellation is expressible only BEFORE dispatch on this path (an aborted signal is refused by the registry); the image is unchanged and no attachment is created. A mid-read cancellation arm is not claimed',
  },
])

