/**
 * refusal-categories.mjs — the CLOSED refusal-category vocabulary that the UTE
 * G1 owner ruling of 2026-11-20 adopts as the compatibility interface between
 * the legacy governed FS path and the native `FsError` path (the B+C route).
 *
 * WHAT THE RULING SAYS (verbatim intent, see
 * `docs/plans/memo/ute-g1-20261120/FS-ERROR-PROTOCOL.md` §1):
 *   (a) the new path keeps the host's native structured `FsError` codes
 *       (`FS_PERMISSION_DENIED`, …) instead of re-spelling them;
 *   (b) old/new compatibility is judged through a CLOSED refusal-category
 *       mapping — NOT literal text equality and NOT code equality;
 *   (c) every existing consumer/handler/test that keys on the OLD
 *       representation must be inventoried and adjudicated;
 *   (d) the mapping must not weaken a permission check, move a refusal's
 *       timing, or relax a file-effect negative control.
 *
 * This module is (b) made executable, and nothing else. It does not decide
 * admission, does not produce a refusal, and cannot widen a lane: it only
 * classifies a refusal that has ALREADY been produced by one of the two paths.
 * A category answers "why was this withheld?", never "should it be withheld?".
 *
 * WHY A CATEGORY AND NOT A STRING/CODE
 *   The two host generations own different refusal vocabularies: the legacy
 *   governed path raises typed `TeamIoDenial` codes (`IO_READ_DENIED`, …) or a
 *   compiled-lane prose sentence, while the next host raises `FsError` codes.
 *   Requiring equal text or equal codes would go red for reasons that are not
 *   behaviour changes (and, for the lane differ, would demand an upstream patch
 *   this repository's `CORE PATCH BUDGET = 0` forbids). Requiring the same
 *   CATEGORY keeps the behavioural claim ("the same kind of thing was
 *   withheld") while letting the surface differ — which is exactly the
 *   semantic change the owner approved as a technical route.
 *
 * THE TWO INVARIANTS THAT KEEP THE MAP HONEST
 *   1. TOTAL OR REFUSED. Every legacy value and every native code is either
 *      mapped explicitly or raises `REFUSAL_VOCABULARY_INCOMPLETE`. There is no
 *      default bucket: an unmapped value is never quietly called `unknown`,
 *      because a default bucket is how a new refusal reason becomes compatible
 *      with an old one without anyone deciding that it is.
 *   2. `unknown` IS A DECLARED VALUE, NOT A SINK. The residual corpus class
 *      `other` maps to `unknown` BY NAME (one entry, cited). A string that is
 *      not in the map does not reach `unknown`; it is refused.
 *
 * NOT A MODEL-FACING CONTRACT
 *   Category ids and definitions are engineering vocabulary. They are not the
 *   sentence a model sees, and this module deliberately owns no model-facing
 *   string: the host's `FsError` message remains the presentation, and the
 *   closed mapping only says which behavioural class it belongs to.
 *
 * @module tests/ute-g1-fs/lib/refusal-categories
 */

/**
 * The closed category vocabulary. Each category is defined by the CONDITION
 * that produced the refusal, never by the code or prose that spells it (a
 * definition that baked in a code would re-introduce the equality requirement
 * this interface exists to remove). `selfCheck()` enforces that.
 *
 * @typedef {'denied-by-lane'|'read-before-write'|'stale-version'|'missing-path'
 *   |'invalid-argument'|'unsupported-mode'|'route-unresolved'|'cancelled'|'unknown'} RefusalCategory
 */

/**
 * @type {Readonly<Record<RefusalCategory, Readonly<{id: RefusalCategory, definition: string}>>>}
 */
export const REFUSAL_CATEGORIES = Object.freeze({
  'denied-by-lane': Object.freeze({
    id: 'denied-by-lane',
    definition: 'A resolved lane or policy decision withheld the requested effect: the target is outside every allowed subtree, inside an explicit deny subtree, escapes through a symlink, or is withheld because the declared disposition requires an approval this plane cannot consume. The decision was taken before the effect ran.',
  }),
  'read-before-write': Object.freeze({
    id: 'read-before-write',
    definition: 'A mutation of an existing target was withheld because the caller had not observed that target first; the observation contract requires a prior successful read of the exact target.',
  }),
  'stale-version': Object.freeze({
    id: 'stale-version',
    definition: 'A mutation was withheld because the target changed after the observation the caller relied on, so the edit would apply to content the caller never saw.',
  }),
  'missing-path': Object.freeze({
    id: 'missing-path',
    definition: 'The addressed path, or the addressed literal inside an existing file, does not exist where the call says it does, so there is nothing to read, mutate or replace.',
  }),
  'invalid-argument': Object.freeze({
    id: 'invalid-argument',
    definition: 'The call\'s own arguments are malformed, out of range, or under-specified (for example a replacement that matches more than one place without an explicit whole-file instruction), so the operation cannot be executed as written.',
  }),
  'unsupported-mode': Object.freeze({
    id: 'unsupported-mode',
    definition: 'The requested operation, format/modality, or deployment capability is not supported by this host or by the route serving it, so the call is refused rather than approximated or silently widened.',
  }),
  'route-unresolved': Object.freeze({
    id: 'route-unresolved',
    definition: 'The call could not be routed to any execution backend able to serve it: this assembly has no provider row for the operation (the route itself is unresolved), so the refusal happens before any backend runs. Distinct from unsupported-mode, where a backend exists and answers by refusing the operation or its format.',
  }),
  cancelled: Object.freeze({
    id: 'cancelled',
    definition: 'The caller cancelled the operation before it completed; the refusal reports the cancellation rather than a policy or filesystem decision.',
  }),
  unknown: Object.freeze({
    id: 'unknown',
    definition: 'The evidence in hand does not determine which of the behavioural conditions above caused the refusal. DECLARED PER VALUE: it is reachable only through an explicit mapping entry, never by falling through an unclassified value.',
  }),
})

/** The closed category id set, in definition order. */
export const CATEGORY_IDS = Object.freeze(Object.keys(REFUSAL_CATEGORIES))

/**
 * Values that mean "there was no refusal at all" (an allow). An allow is graded
 * by `outcome`, not by this module; these values are skipped by the corpus
 * audit and are never mapped to a category.
 */
export const NO_REFUSAL_VALUES = Object.freeze(['-', '', null, undefined])

/** Raised whenever the map is asked about a value it does not explicitly know. */
export class RefusalVocabularyError extends Error {
  /**
   * @param {'REFUSAL_VOCABULARY_INCOMPLETE'|'REFUSAL_VOCABULARY_INVALID'|'REFUSAL_COMPARISON_INVALID'} code
   * @param {string} detail
   */
  constructor(code, detail) {
    super(`${code}: ${detail}`)
    this.name = 'RefusalVocabularyError'
    this.code = code
  }
}

/**
 * One legacy entry. `kind` distinguishes a class token, a typed code, and a
 * prose pattern, because the legacy surface really does contain all three and
 * collapsing them would hide which one a consumer keys on.
 *
 * @typedef {object} LegacyEntry
 * @property {'class'|'code'|'text'} kind
 * @property {string|RegExp} match - exact token for class/code; an ordered regex for text.
 * @property {RefusalCategory} category
 * @property {string} sample - a MEASURED legacy value this entry must classify (self-checked).
 * @property {string} source - where the sample/value is recorded in this tree.
 */

const laneDeny = 'denied-by-lane'
const readBeforeWrite = 'read-before-write'

/**
 * LEGACY REFUSAL CLASS / TEXT / CODE → CATEGORY.
 *
 * Order is significant for `text` entries: the stale-edit remedy
 * ("re-read the file, then retry") CONTAINS the read-before-write remedy
 * ("read the file, then retry"), so the staleness pattern must be tried first.
 * The `sample` of every entry is asserted to classify as its own category, so a
 * reordering that shadows an entry turns the integrity check red instead of
 * silently reclassifying a refusal.
 *
 * @type {readonly LegacyEntry[]}
 */
export const LEGACY_REFUSAL_MAP = Object.freeze([
  // ── the closed refusal-observation classes recorded by the FS corpus ──────
  { kind: 'class', match: 'lane-read', category: laneDeny, sample: 'lane-read', source: 'tests/ute-g1-fs/lib/lane.mjs REFUSAL.LANE_READ' },
  { kind: 'class', match: 'lane-write', category: laneDeny, sample: 'lane-write', source: 'tests/ute-g1-fs/lib/lane.mjs REFUSAL.LANE_WRITE' },
  { kind: 'class', match: 'lane-deny', category: laneDeny, sample: 'lane-deny', source: 'tests/ute-g1-fs/golden/old-path.tsv refusal column (FS-W4/W5/S1/R1)' },
  { kind: 'class', match: 'write-requires-read', category: readBeforeWrite, sample: 'write-requires-read', source: 'tests/ute-g1-fs/golden/old-path.tsv refusal column (FS-W3); lane.mjs REFUSAL.WRITE_REQUIRES_READ' },
  { kind: 'class', match: 'stale-version', category: 'stale-version', sample: 'stale-version', source: 'tests/ute-g1-fs/golden/old-path.tsv refusal column (FS-E2); lane.mjs REFUSAL.STALE_VERSION' },
  // The read_image baselines (B1, PR #799) added four more recorded classes. They
  // are CLASS NAMES, not prose, so each needs its own explicit entry: a name that
  // no entry matches would be an unmapped value, which the map refuses on purpose.
  { kind: 'class', match: 'missing-path', category: 'missing-path', sample: 'missing-path', source: 'tests/ute-g1-fs/golden/old-path.tsv refusal column (FS-I4, a missing image target); lane.mjs REFUSAL.MISSING_PATH' },
  { kind: 'class', match: 'image-modality-denied', category: 'unsupported-mode', sample: 'image-modality-denied', source: 'tests/ute-g1-fs/golden/old-path.tsv refusal column (FS-I5, a text-only model route refused image input before any read); lane.mjs REFUSAL.IMAGE_MODALITY_DENIED' },
  { kind: 'class', match: 'route-unresolved', category: 'route-unresolved', sample: 'route-unresolved', source: 'tests/ute-g1-fs/golden/old-path.tsv refusal column (FS-I0, the product route-C composition cannot reach read_image at all: GAP-FS-CONTRACT-1 / PD-5); lane.mjs REFUSAL.ROUTE_UNRESOLVED' },
  { kind: 'class', match: 'cancelled', category: 'cancelled', sample: 'cancelled', source: 'tests/ute-g1-fs/golden/old-path.tsv refusal column (FS-I6, cancelled before dispatch); lane.mjs REFUSAL.CANCELLED' },
  { kind: 'class', match: 'other', category: 'unknown', sample: 'other', source: 'tests/ute-g1-fs/lib/lane.mjs REFUSAL.OTHER (declared residual class; explicit, not a sink)' },

  // ── the closed TeamIoDenial code set (`TEAM_IO_DENIAL_CODES`) ────────────
  { kind: 'code', match: 'IO_READ_DENIED', category: laneDeny, sample: 'IO_READ_DENIED', source: 'packages/runtime/team-services/src/types.ts TEAM_IO_DENIAL_CODES' },
  { kind: 'code', match: 'IO_WRITE_DENIED', category: laneDeny, sample: 'IO_WRITE_DENIED', source: 'packages/runtime/team-services/src/types.ts TEAM_IO_DENIAL_CODES' },
  { kind: 'code', match: 'IO_ASK_REQUIRES_APPROVAL', category: laneDeny, sample: 'IO_ASK_REQUIRES_APPROVAL', source: 'packages/runtime/team-services/src/types.ts TEAM_IO_DENIAL_CODES' },
  { kind: 'code', match: 'IO_WRITE_REQUIRES_READ', category: readBeforeWrite, sample: 'IO_WRITE_REQUIRES_READ', source: 'packages/runtime/team-services/src/types.ts TEAM_IO_DENIAL_CODES' },
  { kind: 'code', match: 'IO_POLICY_UNSUPPORTED', category: 'unsupported-mode', sample: 'IO_POLICY_UNSUPPORTED', source: 'packages/runtime/team-services/src/types.ts TEAM_IO_DENIAL_CODES' },

  // ── the compiled path-decision codes that PRODUCE the legacy prose ──────
  { kind: 'code', match: 'PATH_NOT_ALLOWED', category: laneDeny, sample: 'PATH_NOT_ALLOWED', source: 'packages/runtime/member-io-policy/src/provider-capabilities.ts refusePath' },
  { kind: 'code', match: 'PATH_EXPLICITLY_DENIED', category: laneDeny, sample: 'PATH_EXPLICITLY_DENIED', source: 'packages/runtime/member-io-policy/src/provider-capabilities.ts refusePath' },
  { kind: 'code', match: 'PATH_SYMLINK_ESCAPE', category: laneDeny, sample: 'PATH_SYMLINK_ESCAPE', source: 'packages/runtime/member-io-policy/src/provider-capabilities.ts refusePath' },
  { kind: 'code', match: 'PATH_NOT_FOUND', category: 'missing-path', sample: 'PATH_NOT_FOUND', source: 'packages/runtime/member-io-policy/src/provider-capabilities.ts refusePath' },
  { kind: 'code', match: 'PATH_RESOLUTION_UNSUPPORTED', category: 'unsupported-mode', sample: 'PATH_RESOLUTION_UNSUPPORTED', source: 'packages/runtime/member-io-policy/src/provider-capabilities.ts refusePath' },

  // ── MEASURED legacy prose (the old path's actual model-facing surface) ───
  {
    kind: 'text',
    match: /changed since it was read|has been modified since/u,
    category: 'stale-version',
    sample: 'cannot edit "/w/inside/stale.txt": file changed since it was read — re-read the file, then retry',
    source: 'tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md §2 (measured legacy stale-edit message)',
  },
  {
    kind: 'text',
    match: /has not been read|not been observed|read the file, then retry/u,
    category: readBeforeWrite,
    sample: 'cannot modify "/w/inside/unread.txt": file has not been read — read the file, then retry',
    source: 'tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md §2 (measured legacy unread-write message)',
  },
  {
    kind: 'text',
    match: /must read .+ before rewriting it/u,
    category: readBeforeWrite,
    sample: "native writeText must read '/w/b.txt' before rewriting it, but the Member read axis does not cover it; write does not imply read",
    source: 'packages/runtime/team-services/src/fs.ts:171-186 (write⇒read coupling prose, both branches)',
  },
  {
    kind: 'text',
    match: /outside every allow subtree of the lane/u,
    category: laneDeny,
    sample: "authored locator '/w/outside/escape.txt' is outside every allow subtree of the lane",
    source: 'packages/runtime/member-io-policy/src/provider-capabilities.ts:319 (measured legacy lane-denial prose)',
  },
  {
    kind: 'text',
    match: /is inside an explicit deny subtree/u,
    category: laneDeny,
    sample: "authored locator '/w/inside/denied.txt' is inside an explicit deny subtree",
    source: 'packages/runtime/member-io-policy/src/provider-capabilities.ts:306 (explicit-deny prose)',
  },
  {
    kind: 'text',
    match: /has the disposition 'ask'/u,
    category: laneDeny,
    sample: "authored locator '/w/inside/a.txt' has the disposition 'ask', but this admission plane has no approval consumer; refusing rather than auto-approving",
    source: 'packages/runtime/member-io-policy/src/provider-capabilities.ts:311-317 (ask-prose)',
  },
  {
    kind: 'text',
    match: /dangling symlink/u,
    category: laneDeny,
    sample: "'/w/inside/link' is a dangling symlink whose target does not resolve; a write through it would leave the authorized subtree",
    source: 'packages/runtime/member-io-policy/src/provider-capabilities.ts:343-347 (symlink-escape prose)',
  },
  {
    kind: 'text',
    match: /read target '.+' does not exist/u,
    category: 'missing-path',
    sample: "read target '/w/inside/absent.txt' does not exist",
    source: 'packages/runtime/member-io-policy/src/provider-capabilities.ts:350 (missing-read-target prose)',
  },
  {
    kind: 'text',
    match: /no such file or directory|file not found|ENOENT|not found/iu,
    category: 'missing-path',
    sample: 'Error: ENOENT: no such file or directory, open \'/w/inside/absent.txt\'',
    source: 'the host read path\'s missing-target message (recorded in FS_NOT_FOUND evidence, dev/agent-workflow/evidence/a5sf-fs-face/README.md §2.1)',
  },
])

/**
 * NATIVE `FsError` CODE → CATEGORY.
 *
 * Every code here is recorded in this tree as a host `FsError` code (never a
 * Team binding code: `FS_BINDING_*` are the Team assembly's own refusals and
 * are deliberately absent — they are not `FsError`s and never travel the
 * model-facing FS surface).
 *
 * @type {Readonly<Record<string, RefusalCategory>>}
 */
export const NATIVE_FS_ERROR_MAP = Object.freeze({
  FS_SANDBOX_DENIED: laneDeny,
  FS_PERMISSION_DENIED: laneDeny,
  FS_NOT_OBSERVED: readBeforeWrite,
  FS_STALE_VERSION: 'stale-version',
  FS_NOT_FOUND: 'missing-path',
  FS_EDIT_NOT_FOUND: 'missing-path',
  FS_AMBIGUOUS_EDIT: 'invalid-argument',
  FS_ABORTED: 'cancelled',
})

/**
 * The corpus vocabulary as ENUMERATED from the corpus and its recorded evidence
 * on 2026-11-20 (the seven refusal classes include the four the B1 read_image
 * baselines added: missing-path, image-modality-denied, route-unresolved, cancelled). This is the exhaustiveness baseline: `auditCorpus` accepts
 * exactly these values, and the test re-derives the corpus values from the
 * files so that a NEW corpus value is caught rather than absorbed.
 *
 * `legacyCodes` is empty ON PURPOSE: every `codes` cell in
 * `tests/ute-g1-fs/golden/old-path.tsv` is `-` (the legacy path refused in
 * prose), which is itself a measured fact this interface records.
 */
export const CORPUS_VOCABULARY_BASELINE = Object.freeze({
  legacyClasses: Object.freeze([
    'lane-deny',
    'write-requires-read',
    'stale-version',
    'missing-path',
    'image-modality-denied',
    'route-unresolved',
    'cancelled',
  ]),
  legacyProse: Object.freeze([
    "authored locator '<abs path>' is outside every allow subtree of the lane",
    'cannot modify "<abs path>": file has not been read — read the file, then retry',
    'cannot edit "<abs path>": file changed since it was read — re-read the file, then retry',
  ]),
  legacyCodes: Object.freeze([]),
  corpusNativeCodes: Object.freeze(['FS_PERMISSION_DENIED', 'FS_NOT_OBSERVED']),
  recordedNativeCodes: Object.freeze([
    'FS_PERMISSION_DENIED',
    'FS_SANDBOX_DENIED',
    'FS_NOT_OBSERVED',
    'FS_STALE_VERSION',
    'FS_NOT_FOUND',
    'FS_EDIT_NOT_FOUND',
    'FS_AMBIGUOUS_EDIT',
    'FS_ABORTED',
  ]),
  sources: Object.freeze({
    legacyClasses: 'tests/ute-g1-fs/golden/old-path.tsv refusal column (non-`-` values)',
    legacyProse: 'tests/ute-g1-fs/golden/SEMANTIC-DIFFERENCES.md §2 + tests/ute-g1-fs/golden/old-path.meta.txt:43-44',
    legacyCodes: 'tests/ute-g1-fs/golden/old-path.tsv codes column (all `-`)',
    corpusNativeCodes: 'tests/ute-g1-fs/lib/prototype-provider.mjs:93',
    recordedNativeCodes: 'tests/ute1-fs/lib/fake-host.mjs, tests/world-factory/lib/a5sf-fs-contract-world.mjs, dev/agent-workflow/evidence/a5sf-fs-face/README.md §2.1',
  }),
})

/** Is this legacy value the "no refusal" sentinel (an allow)? */
export function isNoRefusal(value) {
  return value === null || value === undefined || value === '-' || value === ''
}

/**
 * Classify a legacy refusal value (a class token, a typed code, or a prose
 * sentence).
 *
 * @param {unknown} value
 * @returns {{category: RefusalCategory, kind: 'class'|'code'|'text', matched: string}}
 * @throws {RefusalVocabularyError} `REFUSAL_VOCABULARY_INCOMPLETE` when the
 *   value is not explicitly mapped. There is deliberately no default.
 */
export function categoryOfLegacyRefusal(value) {
  return resolveLegacy(value, LEGACY_REFUSAL_MAP)
}

/**
 * Resolve a legacy value against an explicit map (the shipped map by default;
 * the integrity check passes its own so a reordered/dropped entry is visible).
 * @param {unknown} value
 * @param {readonly LegacyEntry[]} map
 * @returns {{category: RefusalCategory, kind: 'class'|'code'|'text', matched: string}}
 */
function resolveLegacy(value, map) {
  if (typeof value !== 'string' || value.length === 0) {
    throw new RefusalVocabularyError(
      'REFUSAL_VOCABULARY_INCOMPLETE',
      `legacy refusal ${JSON.stringify(value)} is not a non-empty string; a refusal that cannot be named cannot be compared (an unclassified value is never mapped to a category)`,
    )
  }
  if (isNoRefusal(value)) {
    throw new RefusalVocabularyError(
      'REFUSAL_VOCABULARY_INCOMPLETE',
      `legacy value ${JSON.stringify(value)} means "no refusal" (an allow); it has no refusal category and must be graded by outcome`,
    )
  }
  // Exact class/code first: a token is a token, never a prose search.
  for (const entry of map) {
    if (entry.kind !== 'text' && entry.match === value) {
      return Object.freeze({ category: entry.category, kind: entry.kind, matched: String(entry.match) })
    }
  }
  // Then the ordered prose patterns.
  for (const entry of map) {
    if (entry.kind !== 'text') continue
    if (entry.match.test(value)) {
      return Object.freeze({ category: entry.category, kind: 'text', matched: String(entry.match) })
    }
  }
  throw new RefusalVocabularyError(
    'REFUSAL_VOCABULARY_INCOMPLETE',
    `legacy refusal ${JSON.stringify(value.slice(0, 200))} is not mapped by the closed vocabulary; map it deliberately (with a citation) or the compatibility claim would silently absorb a new refusal reason`,
  )
}

/**
 * Classify a native `FsError` code.
 *
 * @param {unknown} code
 * @returns {{category: RefusalCategory}}
 * @throws {RefusalVocabularyError} `REFUSAL_VOCABULARY_INCOMPLETE` when the code
 *   is not explicitly mapped. There is deliberately no default.
 */
export function categoryOfNativeFsError(code) {
  if (typeof code !== 'string' || code.length === 0) {
    throw new RefusalVocabularyError(
      'REFUSAL_VOCABULARY_INCOMPLETE',
      `native FsError code ${JSON.stringify(code)} is not a non-empty string`,
    )
  }
  if (!Object.hasOwn(NATIVE_FS_ERROR_MAP, code)) {
    throw new RefusalVocabularyError(
      'REFUSAL_VOCABULARY_INCOMPLETE',
      `native FsError code ${JSON.stringify(code)} is not mapped by the closed vocabulary; map it deliberately (with a citation) rather than letting it fall into a default bucket`,
    )
  }
  return Object.freeze({ category: NATIVE_FS_ERROR_MAP[code] })
}

/**
 * Compare one legacy refusal against one native `FsError` code through the
 * closed categories.
 *
 * `compatible` means "both paths withheld the call for the same behavioural
 * class". It does NOT mean the text or the code is equal, and it does NOT say
 * the refusal happened at the same instant or that the effect oracle agreed —
 * those are separate claims graded by the corpus and the negative controls.
 *
 * @param {{legacy: unknown, native: unknown}} input
 * @returns {{compatible: boolean, category: RefusalCategory|null, legacyCategory: RefusalCategory, nativeCategory: RefusalCategory, reason: string}}
 * @throws {RefusalVocabularyError} on an unmapped value (never returns a default).
 */
export function compareRefusal({ legacy, native } = {}) {
  if (legacy === undefined || native === undefined) {
    throw new RefusalVocabularyError(
      'REFUSAL_COMPARISON_INVALID',
      'compareRefusal needs BOTH a legacy refusal and a native FsError code; comparing one side against nothing would be a vacuous compatibility claim',
    )
  }
  const left = categoryOfLegacyRefusal(legacy)
  const right = categoryOfNativeFsError(native)
  const compatible = left.category === right.category
  return Object.freeze({
    compatible,
    category: compatible ? left.category : null,
    legacyCategory: left.category,
    nativeCategory: right.category,
    reason: compatible
      ? `both refusals are category ${JSON.stringify(left.category)}; the surface (text/code) may differ, the withheld condition does not`
      : `legacy ${JSON.stringify(String(legacy).slice(0, 120))} is ${JSON.stringify(left.category)} but native ${JSON.stringify(native)} is ${JSON.stringify(right.category)} — different refusal conditions; calling them compatible would hide a behaviour change`,
  })
}

/**
 * Audit an observed corpus vocabulary against the closed map.
 *
 * This is the "refuse when the corpus gains an unmapped value" hook: it is
 * called with the values actually read from the corpus/evidence, and it returns
 * a finding for every value the map does not explicitly know. It does not throw
 * so a caller can report ALL gaps at once; `assertCorpusVocabularyComplete`
 * turns a non-empty finding list into a refusal.
 *
 * @param {{legacy?: readonly unknown[], native?: readonly unknown[]}} observed
 * @returns {{ok: boolean, findings: ReadonlyArray<{code: string, kind: string, value: unknown, detail: string}>}}
 */
export function auditCorpus({ legacy = [], native = [] } = {}) {
  const findings = []
  for (const value of legacy) {
    if (isNoRefusal(value)) continue
    try {
      categoryOfLegacyRefusal(value)
    } catch (error) {
      findings.push(Object.freeze({
        code: 'REFUSAL_VOCABULARY_INCOMPLETE',
        kind: 'legacy',
        value,
        detail: error instanceof Error ? error.message : String(error),
      }))
    }
  }
  for (const code of native) {
    try {
      categoryOfNativeFsError(code)
    } catch (error) {
      findings.push(Object.freeze({
        code: 'REFUSAL_VOCABULARY_INCOMPLETE',
        kind: 'native',
        value: code,
        detail: error instanceof Error ? error.message : String(error),
      }))
    }
  }
  return Object.freeze({ ok: findings.length === 0, findings: Object.freeze(findings) })
}

/**
 * Throw unless the observed corpus vocabulary is fully mapped.
 * @param {{legacy?: readonly unknown[], native?: readonly unknown[]}} observed
 * @returns {true}
 * @throws {RefusalVocabularyError} `REFUSAL_VOCABULARY_INCOMPLETE`
 */
export function assertCorpusVocabularyComplete(observed) {
  const audit = auditCorpus(observed)
  if (!audit.ok) {
    throw new RefusalVocabularyError(
      'REFUSAL_VOCABULARY_INCOMPLETE',
      audit.findings.map((finding) => `${finding.kind}=${JSON.stringify(finding.value)}`).join('; '),
    )
  }
  return true
}

/** Category definitions must describe behaviour, not spell a surface token. */
const MODEL_FACING_BAKE_IN = /\b(?:FS|IO|PATH)_[A-Z][A-Z0-9_]+\b|outside every allow subtree|has not been read|changed since it was read|re-read the file/u

/**
 * Integrity check of the vocabulary itself. Every failure is a finding, never a
 * warning: a silent vocabulary defect is exactly the default-bucket failure
 * this module exists to prevent.
 *
 * Checks:
 *   1. at least one category, ids unique and equal to their keys;
 *   2. every category has a non-empty definition with NO model-facing bake-in;
 *   3. every category is REACHABLE from at least one mapping entry (no dead
 *      category, so "drop a category" cannot be masked by the map);
 *   4. every legacy entry's `sample` classifies as its own category (catches a
 *      reordering that shadows an entry) and carries a `source` citation;
 *   5. every native map key is a non-empty `FS_*`-shaped code with a valid
 *      category.
 *
 * The three inputs are overridable ONLY so the integrity check itself can be
 * mutated in the test suite (a check that cannot be shown to bite is not
 * evidence). Production callers pass nothing and get the shipped vocabulary.
 *
 * @param {{categories?: Record<string, {id?: string, definition?: string}>, legacyMap?: readonly LegacyEntry[], nativeMap?: Record<string, string>}} [overrides]
 * @returns {{ok: boolean, findings: ReadonlyArray<{code: string, detail: string}>}}
 */
export function selfCheck({ categories = REFUSAL_CATEGORIES, legacyMap = LEGACY_REFUSAL_MAP, nativeMap = NATIVE_FS_ERROR_MAP } = {}) {
  const findings = []
  const ids = Object.keys(categories)
  if (ids.length === 0) findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: 'the category vocabulary is empty' })
  for (const [key, entry] of Object.entries(categories)) {
    if (entry === null || typeof entry !== 'object') {
      findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `category ${key} has no definition object` })
      continue
    }
    if (entry.id !== key) findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `category ${key} has id ${JSON.stringify(entry.id)}` })
    if (typeof entry.definition !== 'string' || entry.definition.trim().length === 0) {
      findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `category ${key} has no definition` })
    } else if (MODEL_FACING_BAKE_IN.test(entry.definition)) {
      findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `category ${key}'s definition bakes in a model-facing string/code token` })
    }
  }

  const reachable = new Set([
    ...legacyMap.map((entry) => entry.category),
    ...Object.values(nativeMap),
  ])
  for (const id of ids) {
    if (!reachable.has(id)) findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `category ${id} is unreachable: no mapping entry produces it` })
  }

  for (const entry of legacyMap) {
    if (!Object.hasOwn(categories, entry.category)) {
      findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `legacy entry ${JSON.stringify(String(entry.match))} names unknown category ${JSON.stringify(entry.category)}` })
      continue
    }
    if (typeof entry.source !== 'string' || entry.source.length === 0) {
      findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `legacy entry ${JSON.stringify(String(entry.match))} has no source citation` })
    }
    if (entry.kind === 'text' && !(entry.match instanceof RegExp)) {
      findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `text entry ${JSON.stringify(String(entry.match))} is not a RegExp` })
      continue
    }
    try {
      const resolved = resolveLegacy(entry.sample, legacyMap)
      if (resolved.category !== entry.category) {
        findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `legacy entry ${JSON.stringify(String(entry.match))} classifies its own sample as ${JSON.stringify(resolved.category)}, not ${JSON.stringify(entry.category)} (a shadowing entry reclassifies a refusal)` })
      }
    } catch (error) {
      findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `legacy entry ${JSON.stringify(String(entry.match))} cannot classify its own sample: ${error instanceof Error ? error.message : String(error)}` })
    }
  }

  for (const [code, category] of Object.entries(nativeMap)) {
    if (!/^FS_[A-Z][A-Z0-9_]+$/u.test(code)) {
      findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `native map key ${JSON.stringify(code)} is not an FsError-shaped code` })
    }
    if (!Object.hasOwn(categories, category)) {
      findings.push({ code: 'REFUSAL_VOCABULARY_INVALID', detail: `native code ${code} names unknown category ${JSON.stringify(category)}` })
    }
  }

  return Object.freeze({ ok: findings.length === 0, findings: Object.freeze(findings) })
}
