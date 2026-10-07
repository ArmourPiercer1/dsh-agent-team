#!/usr/bin/env node
/**
 * verify-blueprint-version-clean.mjs — A4-PR7 Tasks 7.5 + 7.4-scope: the
 * v3-only fence, with TWO VERDICTS and ONE GATE.
 *
 * WHAT IT CHECKS. After the v3-only cutover (Task 7.3) a Blueprint document
 * that declares a schemaVersion this product no longer runs is a RETIRED
 * document: the product reads its identity and refuses it. So a fixture, a
 * harness, or a kit that still authors such a document is not "an old test" —
 * it is a live emitter of documents the product will refuse, i.e. a
 * maintenance lie that stays green forever because nothing reads it.
 * Alpha.4's ruling is that the tree must say so LOUDLY and BY PATH.
 * ADR A3-16 owns this scan; ADR A5-9 requires that PR7's gate invoke it BY
 * NAME, because nothing runs `scripts/*.mjs` implicitly (the wrapper is
 * `packages/testkit/test/a4p7-blueprint-version-clean.test.ts`, and
 * `verify-zero-core.mjs` — a script no test calls — is the cautionary
 * precedent this file exists to avoid repeating).
 *
 * THE PREDICATE (plan 7.4, both halves, unchanged): a file must be ABOUT a
 * Blueprint (it keys `blueprintId`) to host Blueprint-version sites, and the
 * literal must be a document key (`schemaVersion:` followed by a digit, also
 * in the quoted YAML form), not prose about versions.
 *
 * THE SCOPE (the plan's list, plus the 2026-10-08 measured third class):
 *   tests/kits/ · scripts/ · any `harness/` directory under packages/ ·
 *   packages/<pkg>/test/ · any `testdata/` directory under packages/ ·
 *   tests/mock/scripts/ · cordis.patch.yml. The last two are MEASURED
 *   additions recorded by the 7.4-scope task:
 *   tests/mock/scripts/boot.mjs:248 and cordis.patch.yml:60
 *   both emit YAML Blueprint documents and sat outside every prior scan.
 *   Excluded with the reason recorded: dev/agent-workflow/ (orchestration
 *   records are prose), any `dist/` (build output), and non-code extensions
 *   (prose documents — the retracted 217-inventory counted 8 Markdown files
 *   that were 8/8 non-migratable false alarms). Production `src/**` stays
 *   OUT: Task 7.3's flip and tsc own the production plane, and the plan's
 *   7.4 audit assigned `packages/legacy/teammates-adapter.ts` to the 7.3
 *   list, not to a fixture scan.
 *
 * THE TWO VERDICTS — WHICH ONES GATE, AND WHY (the sentence a future reader
 * quotes): **this fence gates on `dirty` plus UNADJUDICATED `unknown`:
 * Blueprint-version literals the type system structurally cannot see —
 * string/template carriers in .ts, every site in .mjs/.cjs/.js, and every
 * site in data files (.json/.yml/.yaml). An UNKNOWN whose line carries a
 * recorded human verdict (the adjudication ledger below) prints as the
 * sixth class `adjudicated` and does NOT gate: closure is defined as
 * "dirty empty AND no unadjudicated unknown", so §7.4 can actually close
 * without anyone widening a rule to silence other namespaces' version axes
 * (round 3, reviewer-ratified F4).** `advisory` — code-position TypeScript literals — is
 * printed by path but NEVER gates. NOT because tsc will catch those sites —
 * MEASURED otherwise: under the real §7.3 flip (types.ts:416 -> `readonly
 * schemaVersion: 3`, `pnpm -r --no-bail run typecheck`, 2026-10-08, evidence
 * 17) exactly 1 of the 18 advisory sites reddened. It stays ungated because
 * those lines are PROBE-dispatched, not tsc-dispatched — and every ADVISORY
 * line therefore prints its own caveat naming the laundering mechanism that
 * keeps the flip from reaching it.**
 *
 * The honesty limits of that split, MEASURED rather than asserted (2026-10-08
 * round-2 review): applying the real §7.3 flip (packages/domain/blueprint/
 * src/types.ts:416 -> `readonly schemaVersion: 3`) and running
 * `pnpm -r --no-bail run typecheck`, exactly ONE of the 18 advisory sites at
 * head reddened (packages/runtime/test/p5t5-helpers.ts:80 — the one literal
 * directly typed as TeamBlueprint); SEVENTEEN stayed green — `toEqual(...)`/
 * `toMatchObject(...)` arguments, `Record<string, unknown>` builders,
 * unannotated consts, and `as unknown as` casts, including the very literal
 * the probe caught lying at policy-state-multi-team-bound-blueprint.test.ts
 * :101. The flip also reddened six production-src version comparisons — the
 * production plane, not the scan's. So `advisory` claims only "this literal
 * is visible to TypeScript as code", NEVER "the flip will redden it", and
 * every ADVISORY line carries a per-site caveat naming its laundering
 * mechanism (advisoryCaveat below); the PROBE, not this scan, dispositions
 * those paths ("green after probe → live migration or a recorded strike").
 *  - `unknown` gates on purpose: it is the shape the classifier cannot
 *    decide (conflicting namespace signatures on one object, a line whose
 *    quotes never close). A scan that resolves ambiguity by silently
 *    dropping the site is the defect this whole phase keeps re-meeting —
 *    it shows the path and the reason and waits for a human.
 *  - `refused` is where a version digit belongs to ANOTHER schemaVersion
 *    namespace (this key belongs to at least eight of them — the 2026-10-08
 *    inventory audit — and a scan that flags them teaches people to mute
 *    the scan). Refusals are printed per line WITH the namespace and the
 *    deciding channel, so every drop is auditable; nothing is removed
 *    silently. After the 2026-10-08 review, refusal requires POSITIVE
 *    namespace evidence inside the SITE'S OWN LITERAL: a namespace name on
 *    the site's own line or inside its own carrier string, or a signature
 *    completed by the site's own keys (the carrier string's keys for a
 *    string carrier; the object literal's depth-1 keys for code/data). The
 *    enclosing object's keys never refuse a string-carried site; head-line
 *    and function-signature text never refuses anything — it becomes a
 *    visible UNKNOWN for human adjudication. So does ctx evidence on a
 *    SPREAD-assisted literal, whose hidden keys cannot be certified
 *    document-free. No evidence, no refusal; wrong-literal evidence, no
 *    refusal. Each namespace entry below cites the tree evidence
 *    hand-verified on 2026-10-08.
 *
 * WHY `git ls-files` AND NOT A FILESYSTEM WALK. `tests/homes/` (DSH_HOME
 * worlds) and any `dist/` tree hold STORE COPIES and build output: a
 * filesystem walk reports a fixture's durable residue as a source finding,
 * and both trees churn between runs, which turns a fence into noise. Tracked
 * files are the sources this repository owns. WHY NOT `rg`: ripgrep is not
 * installed in this environment, and an `rg`-based scan here returns an
 * all-zero result rather than an error — a silent false negative, the worst
 * failure a gate can have.
 *
 * HOW IT FAILS. It prints every offending site and exits 1. It NEVER
 * compares against a remembered count: a count in a document is not the
 * contract (plan X10), and the pre-flight's own counts were wrong twice. The
 * DEFERRAL list — the paths knowingly still retired-version while Task 7.4
 * migrates them lane by lane — lives in the wrapper test, where each entry
 * is reviewable and where a path that became clean must be REMOVED. So the
 * set is honest in both directions: a new offending path fails, and a stale
 * deferral entry fails.
 *
 * Exit codes: 0 clean (no dirty, no unknown) · 1 dirty or unknown sites
 * found · 2 the scan could not run (no git, no output) — "could not run" is
 * never reported as "clean". Advisory, refused and prose never move the exit
 * code.
 */

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

/** The document version this product runs (plan §14: no v4 placeholder). */
export const SUPPORTED_DOCUMENT_VERSION = 3

// --- scope -------------------------------------------------------------------

/** Exact paths that are emitters but sit outside every directory rule. */
const SCOPE_EXACT = new Set(['cordis.patch.yml'])
/** Plan-named prefixes, plus the measured mock-boot emitter pocket. */
const SCOPE_PREFIXES = ['tests/kits/', 'scripts/', 'tests/mock/scripts/']
/** packages/<pkg>/(test|harness)/ and packages/**\/testdata/. */
const SCOPE_PATTERNS = [
  /^packages\/[^/]+\/(test|harness)\//,
  /^packages\/[^/]+\/(?:[^/]+\/)*testdata\//,
]
/** The harness segment from the original scope rule (any depth). */
const SCOPE_SEGMENTS = ['/harness/']

/** Excluded, with the reason recorded rather than assumed. */
const EXCLUDED_PREFIXES = ['dev/agent-workflow/']
const EXCLUDED_SEGMENTS = ['/dist/']

/** Extensions whose CONTENT is scanned; anything else is prose by role. */
const UNCHECKED_CODE_EXT = ['.mjs', '.cjs', '.js']
const TYPED_CODE_EXT = ['.ts', '.tsx', '.mts']
const DATA_EXT = ['.json', '.yml', '.yaml']
const CODE_EXTENSIONS = [...UNCHECKED_CODE_EXT, ...TYPED_CODE_EXT, ...DATA_EXT]

function extOf(path) {
  const i = path.lastIndexOf('.')
  return i < 0 ? '' : path.slice(i)
}

/** TRUE iff this tracked path belongs to the fence's universe. */
export function isScanScopePath(path) {
  if (EXCLUDED_PREFIXES.some((prefix) => path.startsWith(prefix))) return false
  if (EXCLUDED_SEGMENTS.some((seg) => `/${path}`.includes(seg))) return false
  if (!CODE_EXTENSIONS.includes(extOf(path))) return false
  if (SCOPE_EXACT.has(path)) return true
  if (SCOPE_PREFIXES.some((prefix) => path.startsWith(prefix))) return true
  if (SCOPE_PATTERNS.some((re) => re.test(path))) return true
  return SCOPE_SEGMENTS.some((seg) => `/${path}`.includes(seg))
}

// --- the literal ---------------------------------------------------------------

/**
 * The document key, in the forms this tree actually uses: bare
 * (`schemaVersion:` followed by a digit), value-quoted (a quoted digit value —
 * fixtures.ts:286 is that shape, where a probe that only rewrites numeric
 * literals edits nothing), and KEY-quoted the way JSON writes it (quoted key,
 * quoted or bare digit value). None of these example spellings matches the
 * hunt pattern itself: the scan's own prose never emits what it hunts for.
 *
 * ONE READING DECISION, recorded rather than buried: the plan states the
 * predicate as "`schemaVersion: <digit>`", which read literally also flags
 * the SUPPORTED version and would fail every correctly migrated fixture once
 * Task 7.4 lands — which cannot be what a fence named "version-clean" means
 * after a cutover TO v3. So the predicate is the plan's shape restricted to
 * `version !== SUPPORTED_DOCUMENT_VERSION`, pinned by the wrapper's f21
 * fixture. Multi-digit stamps (9, 99, ...) are unsupported versions of this
 * product exactly like 1 and 2, so they count.
 */
const VERSION_LITERAL = /schemaVersion["']?\s*:\s*(?:"(\d+)"|'(\d+)'|(\d+))/g
/** Both-halves key half: the file is ABOUT a Blueprint. */
const BLUEPRINT_KEY = /blueprintId/

// --- non-blueprint schemaVersion namespaces --------------------------------------
// Every entry cites verification made against source on 2026-10-08.
// `ctx` patterns run against the match line, the enclosing-scope head chain
// and the function-signature line. `sibling` entries are all-required key-name
// sets among the enclosing object's depth-1 keys. A refusal REQUIRES a
// positive match on one of these; with no match the site keeps its carrier
// verdict.

const NON_BLUEPRINT_NAMESPACES = [
  {
    name: 'projection-envelope',
    // SUPPORTED_PROJECTION_SCHEMA_VERSIONS = [1, 2] (a separate frozen axis).
    // Envelope READS are runtime indexings with no digit literal at all —
    // packages/remote/src/handlers/team.ts:164/:192 and
    // packages/runtime/src/plugin/s6-remote.ts:4529 (verified: that file
    // carries no digit form) — which is WHY the 2026-10-08 probe stayed
    // green there. Digit-stamped fixtures:
    // packages/runtime/test/p01-team-scoped-overlay.test.ts:211 via
    // createProjectionService, and wire frames' sibling set
    // (teamSessionId + generation + ...), e.g.
    // packages/remote/test/p8t3-helpers.ts:94 P8T3_PROJECTION.
    ctx: /\bprojection\s*[:({]|\bPROJECTION\b|createProjectionService\(|projectionSource\(|readProjectionSource\(|RemoteMethodProjection|RemoteProjectionValue|TeamProjectionDto|RemoteSafeRecord|appliedIdentityFromV6\(|ProjectionDto\b|ProjectionValue\b/,
    sibling: [
      ['generation', 'teamSessionId'],
      ['generation', 'generatedAt'],
      ['generation', 'templates'],
      ['generation', 'ledger'],
      ['generation', 'durableGeneration'],
    ],
  },
  {
    name: 'session-binding',
    // SessionBindingDto is its own version axis. Rows are written through
    // repositories.sessionBindings.put (packages/runtime/test/
    // d1-team-ownership-index.test.ts:219) and built for parseSessionBinding
    // (packages/storage/test/p4-helpers.ts:415). TeamBlueprint documents have
    // no kind/sessionId sibling keys.
    ctx: /parseSessionBinding\(|SessionBindingDto|sessionBindings\.put\(|teamMemberBinding\(|teamRootBinding\(|ordinaryBinding\(/,
    sibling: [['kind', 'sessionId'], ['kind', 'sessionKey']],
  },
  {
    name: 'team-session-record',
    // The TeamSessionRecordDto stamp — NOT the bound document's version: the
    // nested `blueprint:` value is an anchor ref {blueprintId, revision,
    // contentHash} with no version of its own. This is why
    // packages/runtime/test/policy-state-multi-team-bound-blueprint.test.ts
    // (the file the 2026-10-08 probe stayed GREEN on) is correctly refused,
    // exactly as the coordinator ruled for p01: "the number is another
    // namespace's". Rows: :140 and p8s7r2-disposed-history.test.ts:87.
    ctx: /TeamSessionRecordDto|parseTeamSessionRecord\(|sessions\.put\(|sessionRecords\.put\(/,
    sibling: [['rootSessionId', 'blueprint'], ['blueprint', 'createdAt', 'generation']],
  },
  {
    name: 'member-instance-record',
    // The MemberInstance discriminator the coordinator named at
    // packages/runtime/src/plugin/host.ts:2539 — there it is a runtime
    // COMPARISON (`raw.schemaVersion === 2`), no digit literal, invisible to
    // the scan by construction (plan 7.4 audit reason (2)). Digit-bearing ROW
    // form: packages/runtime/test/p8s7r2-disposed-history.test.ts:109
    // (instanceId + templateId/lifecycle siblings).
    ctx: /parseMemberInstanceRecord\(|MemberInstanceRecord|MemberInstanceDto|member-instance/,
    sibling: [['instanceId', 'templateId'], ['instanceId', 'lifecycle']],
  },
  {
    name: 'registry-row',
    // F1's lesson from the horse's mouth (packages/storage/schema/
    // blueprint-registry.ts:131-139): a BlueprintRegistryRecord's
    // schemaVersion is TEAM_DOMAIN_SCHEMA_VERSION, "the TeamDomain schema
    // version that shaped the row, L3 discipline" — the ROW stamp, a
    // different concept from a document version
    // (packages/storage/schema/stores.ts:61). Digit-bearing test forms:
    // packages/storage/test/bp1-blueprint-registry.test.ts:146/:159 and the
    // BlueprintRegistryRecordView rows. NO sibling signature: a row shares
    // blueprintId/revision/contentHash with documents, so only the named
    // context may refuse it.
    ctx: /BlueprintRegistryRecord|blueprintRegistryKey|TEAM_DOMAIN_SCHEMA_VERSION/,
    sibling: [],
  },
  {
    name: 'ledger-row',
    // Governance/artifact ledger row stamp. The production form
    // (packages/runtime/src/plugin/host.ts:2837) stamps
    // `schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION` — a constant, no digit,
    // invisible by construction. Digit-bearing rows:
    // packages/runtime/test/p6t4-helpers.ts:458,
    // packages/remote/test/p8t4-engine.test.ts:122.
    ctx: /ledger\.put\(|ledger\.allocate|RemoteLedgerEntryValue|LedgerEntryValue|appendGranted\(/,
    sibling: [['factType', 'sequence'], ['factType', 'payload']],
  },
  {
    name: 'artifact-grant-payload',
    // The artifact-read-granted payload's own schemaVersion, distinct from
    // the ledger row stamp (packages/client/test/ledger-adapter.test.ts
    // :433/:450; the host stamps the ROW separately).
    ctx: /artifact-read-granted/,
    sibling: [['targetKeyDigest', 'versionDigest'], ['targetKeyDigest', 'locator']],
  },
  {
    name: 'governance-override',
    // GovernanceOverrideRecord's own axis (packages/runtime/test/
    // p8s7r2-effective-config.test.ts:848, packages/storage/test/p4-helpers
    // .ts:435/:456).
    ctx: /parseGovernanceOverride\(|GovernanceOverrideRecord|overrides\.put\(|humanOverride/,
    sibling: [['recordId', 'scope'], ['kind', 'scope', 'values']],
  },
  {
    name: 'governance-ledger',
    // The approval-case row and the operation row of the governance ledger
    // (packages/storage/test/p4-helpers.ts:475/:505).
    ctx: /ApprovalCase|approval-case|OperationRecord\b|operations\.put\(|governanceLedger/,
    sibling: [
      ['outcomes', 'fingerprint'],
      ['acknowledgements', 'outcomes'],
      ['intent', 'phase'],
      ['intent', 'operationId'],
    ],
  },
  {
    name: 'compatibility-record',
    // The legacy-S6 compatibility namespace (runtime tests write rows through
    // repos.compatibility.put).
    ctx: /compatibility\.put\(|CompatibilityRecord|SUPPORTED_COMPATIBILITY/,
    sibling: [],
  },
]

/**
 * Document-only TeamBlueprint field names (the closed interface at
 * packages/domain/blueprint/src/types.ts:405-488 minus schemaVersion,
 * blueprintId, revision, contentHash — the four keys row DTOs legitimately
 * share — and minus `members`, which the 2026-10-08 audit measured on the
 * PROJECTION DTO (packages/remote/src/contracts/types.ts:65
 * `readonly members: readonly RemoteSafeRecord[]`): a key a row family
 * carries cannot discriminate a document, and keeping `members` here turned
 * 15 genuine wire frames into false conflicts. A complete TeamBlueprint
 * smuggled into row vocabulary still conflicts through displayName /
 * requirements / policyStates (fixtures f25/f26 pin exactly that).
 * Their presence in the SITE'S OWN literal against a namespace signature is
 * a genuine conflict — UNKNOWN, never a guess (fixtures f18/f26 pin this).
 * The old three-name set ({leader, memberEnvelopes, policyStates}) was a
 * coverage lie: a document written with displayName/teamHardEnvelope (legal
 * v3) could not even raise the conflict (2026-10-08 review, BLOCKING 1c) —
 * fixture f26 was REFUSED that way before the set was widened.
 */
/** The identity triple a TeamBlueprint document carries (excluded from the
 *  doc-only set itself: row DTOs legitimately share these four keys with
 *  documents — schemaVersion, blueprintId, revision, contentHash). V3
 *  counts `members` only when >= 2 of these sit in the site's own literal. */
const VERSION_LITERAL_TEST = /schemaVersion["']?\s*:\s*\d/
// Round 4 item 2: the numeric-form family the TEXT predicate does not read —
// `+1` (unary plus), `0x` hex, template/computed digits. Measured, never
// gated: see countNumericFormVariants and the SCOPE-NOTE for the doctrine.
const NUMERIC_FORM_VARIANTS = /\bschemaVersion["']?\s*:\s*(?:\+\s*\d|0[xX][0-9a-fA-F]|\$\{|`)/g
function countNumericFormVariants(result, text) {
  const hits = text.match(NUMERIC_FORM_VARIANTS)
  if (hits !== null) result.blindNumericForms += hits.length
}
const DOC_SHAPE_MARKERS = /displayName|policyStates|teamEnvelope|teamHardEnvelope|requirements/
const IDENTITY_TRIPLE = ['blueprintId', 'revision', 'contentHash']
// DOC_ONLY_KEYS is a CLASSIFIER input (refusal evidence below); the witness
// rule that consumed a forbidden-key SET is retired with the class (R3).
const DOC_ONLY_KEYS = new Set([
  'displayName',
  'description',
  'leader',
  'requirements',
  'teamRequirements',
  'teamEnvelope',
  'memberEnvelopes',
  'permissionMutationEnvelope',
  'teamHardEnvelope',
  'policyStates',
  'quotas',
  'capabilityPolicy',
  'metadata',
])

// Round 4 FIX 1 (adversarial review of 70745ef7): a hand-typed allowlist of
// keys is a snapshot of what the author thought of — mine was 9/9 correct
// and THREE keys short (`members`, `templateId`, `persona`), and every short
// key was load-bearing. The forbidden-witness set is therefore DERIVED from
// the schema at run time: every key in BLUEPRINT_TOP_LEVEL_FIELDS* /
// BLUEPRINT_TEMPLATE_FIELDS* (spreads followed) is a key a schema-valid
// TeamBlueprint document can carry, and is forbidden as a foreign witness BY
// CONSTRUCTION. Fail-closed: if schema.ts moved or the extractor's shape
// assumption breaks, the fence refuses to run — an admission rule that
// cannot enumerate the document keys must not admit anything.
const ADJ_MAX_RANGE_LINES = 12
// (R3 retirement): the witness-key extraction (deriveSchemaWitnessForbidden,
// R=40 radius constants) left with the class. The completeness invariant it
// enforced was SELF-REFERENTIAL — it demanded that the sets its own regex
// found be found — see FINDINGS section 10 for the fail-open demonstration
// (six sets behind a behaviour-identical second validator helper: 16 sets to
// 10, no error, suite green). ADJ_MAX_RANGE_LINES stays: the 12-line evidence
// window is the UNKNOWN-row rule, independent of the retired class.

// --- the line state machine -------------------------------------------------------
// Tracks line/block comments, single/double-quoted strings (terminated at
// EOL) and template literals ACROSS lines, including `${ ... }`
// interpolation returning to code (with nested-brace balance). A match whose
// offset falls in a string segment is a STRING CARRIER: TypeScript never
// sees its digits, whatever the surrounding declaration says. KNOWN
// LIMITATION, stated rather than hidden: this is a scanner, not a parser — a
// regex literal containing quotes or braces can mislead it. The direction of
// that error is conservative for the GATED class: a code match mis-seen as
// string becomes DIRTY (printed, argued, migrated), never the other way in a
// way that hides a string carrier as advisory.

const K_CODE = 0
const K_STRING = 1
const K_COMMENT = 2

/**
 * Per-line byte kinds (code/string/comment) PLUS the string literal segments
 * of the whole text ({sl, sc, el, ec} inclusive). Segments matter because a
 * serialized record can be carried INSIDE a TS string with its own namespace
 * keys (contracts/test/serialization.test.ts:93/:207 is the measured case):
 * refusing that class requires reading the keys the string itself contains.
 */
/** Regex-vs-division at a code-position `/`: decided by the previous
 *  significant character (classic heuristic, deliberately conservative —
 *  `>` is DELIBERATELY division-side so JSX `</div>` closes are never read
 *  as regex starts; an unclassifiable candidate falls through as ordinary
 *  code, which is the direction that can only ADD string reading, and the
 *  string-reading errors of this machine are documented above). */
function regexPosition(lines, li, i, kinds) {
  const l = lines[li]
  let k = i - 1
  while (k >= 0 && (l[k] === ' ' || l[k] === '\t')) k -= 1
  if (k < 0) return true // start of line (or of a continued expression)
  if (kinds[k] !== K_CODE) return false // after a string/comment: division
  const prev = l[k]
  if ('=({[,;:!&|?+-*%~^'.includes(prev)) return true
  if (/[\w$]/.test(prev)) {
    // keyword before: `return /re/`, `typeof /re/` are regex positions
    let s = k
    while (s >= 0 && /[\w$]/.test(l[s])) s -= 1
    const word = l.slice(s + 1, k + 1)
    return ['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'case', 'do', 'else'].includes(word)
  }
  return false // ), ], quote, dot: division
}

function lineStates(text) {
  const lines = text.split('\n')
  const carry = { template: false, interp: [], blockComment: false, lineString: null, lineSeg: null }
  const states = []
  const segments = []
  const openSegs = []
  lines.forEach((line, li) => {
    const kinds = new Array(line.length).fill(K_CODE)
    let i = 0
    let openQuote = false
    // A quoted string that CONTINUED from the previous line via a trailing
    // backslash (legal JS line continuation): this line is inside that
    // string until its quote closes (BLOCKING 2, demotion #2 — without
    // this, continuation lines restarted at CODE state and turned carried
    // documents into advisory).
    if (carry.lineString !== null) {
      const q = carry.lineString
      const seg = carry.lineSeg
      let cont = false
      let closedAt = -1
      for (let j = 0; j < line.length; j += 1) {
        kinds[j] = K_STRING
        if (line[j] === '\\') {
          if (j === line.length - 1) {
            cont = true
            break
          }
          j += 1
          kinds[j] = K_STRING
          continue
        }
        if (line[j] === q) {
          closedAt = j
          break
        }
      }
      // Round 3 D: this branch was DEAD — the guard below was tautological
      // because the scan loop never cleared the carry, so a string that
      // CLOSED mid-line was still reported as unterminated (whole line
      // string, openQuote true). The closed case now falls through: the
      // line tail after the quote is CODE again (fixture f35).
      if (closedAt === -1) {
        if (!cont) {
          // EOL without backslash and without the quote: genuinely
          // unterminated — visible through the openQuote unknown rule.
          openQuote = true
          seg.el = li
          seg.ec = line.length - 1
          segments.push(seg)
          carry.lineString = null
          carry.lineSeg = null
        }
        states.push({ kinds, openQuote })
        return
      }
      carry.lineString = null
      carry.lineSeg = null
      seg.el = li
      seg.ec = closedAt
      segments.push(seg)
      i = closedAt + 1
    }
    while (i < line.length) {
      const c = line[i]
      const c2 = line[i + 1]
      if (carry.blockComment) {
        kinds[i] = K_COMMENT
        if (c === '*' && c2 === '/') {
          carry.blockComment = false
          i += 2
          continue
        }
        i += 1
        continue
      }
      if (carry.template) {
        kinds[i] = K_STRING
        if (c === '\\') {
          if (i + 1 < line.length) kinds[i + 1] = K_STRING
          i += 2
          continue
        }
        if (c === '`') {
          carry.template = false
          const top = openSegs.pop()
          if (top !== undefined) {
            top.el = li
            top.ec = i
            // BLOCKING 2: PUBLISH closed template segments. The old machine
            // pushed only the openSegs leftovers (unclosed templates), so
            // segmentAt was undefined for every CLOSED template and the
            // carrier's own keys were unread — equivalent spellings of one
            // payload got three verdicts (f27/f28 red first).
            segments.push(top)
          }
          i += 1
          continue
        }
        if (c === '$' && c2 === '{') {
          carry.template = false
          carry.interp.push(0)
          i += 2
          continue
        }
        i += 1
        continue
      }
      if (c === '/' && c2 === '/') {
        for (let j = i; j < line.length; j += 1) kinds[j] = K_COMMENT
        break
      }
      if (c === '/' && c2 === '*') {
        carry.blockComment = true
        kinds[i] = K_COMMENT
        if (i + 1 < line.length) kinds[i + 1] = K_COMMENT
        i += 2
        continue
      }
      if (c === '/' && c2 !== '/' && c2 !== '*' && regexPosition(lines, li, i, kinds)) {
        // A REGEX LITERAL occupies code and may contain quotes AND backticks:
        // /[`]/ is not a template opener (BLOCKING 2, demotion #1 — the old
        // machine opened a phantom template whose parity flip turned a
        // following YAML document into advisory). Class-aware, escape-aware;
        // an unterminated candidate falls through as ordinary code (division).
        let j = i + 1
        let inClass = false
        let closed = false
        while (j < line.length) {
          const rc = line[j]
          if (rc === '\\') {
            j += 2
            continue
          }
          if (rc === '[') inClass = true
          else if (rc === ']') inClass = false
          else if (rc === '/' && !inClass) {
            closed = true
            break
          }
          j += 1
        }
        if (closed) {
          kinds[i] = K_CODE
          for (let z = i + 1; z <= j && z < line.length; z += 1) kinds[z] = K_CODE
          let t = j + 1
          while (t < line.length && /[gimsuyd]/.test(line[t])) {
            kinds[t] = K_CODE
            t += 1
          }
          i = t
          continue
        }
        i += 1
        continue
      }
      if (c === '`') {
        carry.template = true
        kinds[i] = K_STRING
        openSegs.push({ sl: li, sc: i, el: -1, ec: 0 })
        i += 1
        continue
      }
      if (c === '"' || c === "'") {
        const q = c
        kinds[i] = K_STRING
        let j = i + 1
        let closed = false
        let continues = false
        for (; j < line.length; j += 1) {
          kinds[j] = K_STRING
          if (line[j] === '\\') {
            if (j === line.length - 1) {
              // trailing backslash at EOL inside an open string: the string
              // CONTINUES on the next line (legal JS). Not an unknown
              // unterminated line — the carrier survives the newline.
              continues = true
              break
            }
            j += 1
            if (j < line.length) kinds[j] = K_STRING
            continue
          }
          if (line[j] === q) {
            closed = true
            break
          }
        }
        if (continues) {
          const seg = { sl: li, sc: i, el: li, ec: line.length - 1 }
          segments.push(seg) // partial segment so THIS line's sites read as string
          carry.lineString = q
          carry.lineSeg = { sl: li, sc: i, el: -1, ec: 0 }
          i = line.length
          continue
        }
        if (!closed) openQuote = true
        segments.push({ sl: li, sc: i, el: li, ec: closed ? j : line.length - 1 })
        i = closed ? j + 1 : line.length
        continue
      }
      if (c === '{' && carry.interp.length > 0) {
        carry.interp[carry.interp.length - 1] += 1
        i += 1
        continue
      }
      if (c === '}' && carry.interp.length > 0) {
        const top = carry.interp.length - 1
        if (carry.interp[top] === 0) {
          carry.interp.pop()
          carry.template = true
        } else {
          carry.interp[top] -= 1
        }
        i += 1
        continue
      }
      i += 1
    }
    states.push({ kinds, openQuote })
  })
  for (const seg of openSegs) {
    seg.el = lines.length - 1
    seg.ec = Math.max(0, (lines[lines.length - 1] ?? '').length - 1)
  }
  segments.push(...openSegs)
  return { states, segments }
}

/** The segment most tightly containing (li, col), or undefined. */
function segmentAt(segments, li, col) {
  let best
  for (const seg of segments) {
    const after = li > seg.sl || (li === seg.sl && col >= seg.sc)
    const before = li < seg.el || (li === seg.el && col <= seg.ec)
    if (after && before && (best === undefined || seg.sl > best.sl || (seg.sl === best.sl && seg.sc >= best.sc))) {
      best = seg
    }
  }
  return best
}

function segmentText(lines, seg) {
  if (seg.sl === seg.el) return (lines[seg.sl] ?? '').slice(seg.sc, seg.ec + 1)
  return [
    (lines[seg.sl] ?? '').slice(seg.sc),
    ...lines.slice(seg.sl + 1, seg.el),
    (lines[seg.el] ?? '').slice(0, seg.ec + 1),
  ].join('\n')
}

/** Key-like tokens (`name:` or `"name":`) inside a carried string. For a
 *  string carrier these ARE the site's own keys — the only pool a string-
 *  carried site's refusal may rest on (serialization JSON is written with
 *  quoted keys; refusing that class means reading keys inside the string,
 *  and NOTHING outside it: BLOCKING 1a pool split, 2026-10-08 review). */
function stringKeyCandidates(str) {
  const keys = []
  const re = /([A-Za-z_$][\w$]*)["']?\s*:/g
  let m
  while ((m = re.exec(str)) !== null) keys.push(m[1])
  return keys
}

// --- enclosing-scope context ---------------------------------------------------------

/**
 * Chain of enclosing `{` heads, innermost first. Braces are counted only at
 * code positions (a `{` inside a string or comment cannot scope an object),
 * and only positions BEFORE the match are scanned (a brace after the match
 * belongs to something the match cannot be inside).
 */
function headChain(lines, states, idx, matchCol) {
  const chain = []
  let depth = 0
  for (let j = idx; j >= 0 && idx - j <= 60; j -= 1) {
    const l = lines[j]
    const kinds = states === null ? undefined : states[j]?.kinds
    const startK = j === idx ? matchCol - 1 : l.length - 1
    for (let k = startK; k >= 0; k -= 1) {
      if (kinds !== undefined && kinds[k] !== K_CODE) continue
      const c = l[k]
      if (c === '}') depth += 1
      else if (c === '{') {
        if (depth > 0) depth -= 1
        // The COLUMN of the opening brace travels with the head: a head line
        // may open TWO literals (`= { kind, sessionId, document: {`) and the
        // site's literal is the INNER one (round-3 F1 — restarting the key
        // scan at the line's first character read the ROW's depth-1 keys as
        // the nested document's own, and machine-refused it).
        else chain.push({ line: l.trim(), idx: j, col: k })
      }
    }
  }
  return chain
}

/** Depth-1 key names of the object literal opened at headIdx (bounded),
 *  PLUS whether the literal is SPREAD-assisted (`{...X, k: v}`): a spread can
 *  hide document keys behind visible ones, so the classifier must never
 *  machine-refuse a ctx-named site whose own literal spreads (2026-10-08
 *  review BLOCKING 1c — the tree builds documents as `...BOILERPLATE` /
 *  `jsDoc(overrides)`, and the spread-built registry rows at
 *  packages/storage/test/bp1-blueprint-registry.test.ts:146 proves the
 *  row-side too: hidden keys cannot be certified document-free). */
function siblingKeys(lines, states, headIdx, headCol = 0) {
  const keys = []
  let spread = false
  let depth = 0
  let opened = false
  for (let j = headIdx; j < Math.min(lines.length, headIdx + 60); j += 1) {
    const l = lines[j]
    const kinds = states?.[j]?.kinds
    // Start AT the head brace, not at the line's first character: the
    // literal whose keys we read opens at headCol (see headChain).
    for (let k = j === headIdx ? headCol : 0; k < l.length; k += 1) {
      if (kinds !== undefined && kinds[k] !== K_CODE) {
        // Quoted keys: `"kind":` puts the KEY token inside a string, but it
        // is still a key of the literal (BLOCKING 2 parity — bare keys were
        // visible, quoted ones were not; the carrier decision moved to the
        // digit, and the key pools must see both spellings). Only a
        // string-START position preceded by code can be a key.
        if (depth === 1 && (l[k] === '"' || l[k] === "'") && (k === 0 || kinds[k - 1] === K_CODE)) {
          const mq = /^(["'])([A-Za-z_$][\w$]*)\1\s*:/.exec(l.slice(k))
          const prefixQ = l.slice(0, k)
          if (mq !== null && (prefixQ.trim() === '' || /[{,]\s*$/.test(prefixQ))) {
            keys.push(mq[2])
            k += mq[0].length - 1
          }
        }
        continue
      }
      const c = l[k]
      if (c === '{') {
        depth += 1
        opened = true
      } else if (c === '}') {
        depth -= 1
        if (opened && depth === 0) return { keys, spread }
      } else if (depth === 1) {
        if (c === '.' && l.slice(k, k + 3) === '...') {
          spread = true
          k += 2
          continue
        }
        const m = /^([A-Za-z_$][\w$]*)\s*:/.exec(l.slice(k))
        const prefix = l.slice(0, k)
        if (m !== null && (prefix.trim() === '' || /[{,]\s*$/.test(prefix))) {
          keys.push(m[1])
          k += m[0].length - 1
        }
      }
    }
  }
  return { keys, spread }
}

/** The nearest plausible declaration line above the object head (function
 *  signature / const binding). A context channel only: an fn-name match
 *  with document siblings present becomes UNKNOWN, never a silent refusal. */
function funcContext(lines, states, headIdx) {
  for (let j = headIdx; j >= 0 && headIdx - j <= 8; j -= 1) {
    const l = lines[j]
    if (l.trim() === '') continue
    if (states !== null && states[j] !== undefined) {
      const kinds = states[j].kinds
      let first = -1
      for (let i = 0; i < kinds.length; i += 1) {
        if (kinds[i] !== K_COMMENT) {
          first = i
          break
        }
      }
      if (first === -1) continue // whole line is comment
    }
    if (/^\s*(export\s+)?(async\s+)?function\s+|^\s*(export\s+)?const\s+[A-Za-z0-9_$]+|^\s*[A-Za-z0-9_$]+\s*\([^)]*\)\s*\{?\s*$/.test(l)) {
      return l.trim()
    }
  }
  return ''
}

// --- YAML context (no JS machine runs on data files; the whole file is data) ----

function leadingSpaces(l) {
  const m = /^\s*/.exec(l)
  return m === null ? 0 : m[0].length
}

function yamlParentKey(lines, idx) {
  const indent = leadingSpaces(lines[idx])
  for (let j = idx - 1; j >= 0 && idx - j <= 40; j -= 1) {
    const l = lines[j]
    if (l.trim() === '' || l.trim().startsWith('#')) continue
    if (leadingSpaces(l) < indent) return l.trim()
  }
  return ''
}

function yamlSiblings(lines, idx) {
  const indent = leadingSpaces(lines[idx])
  const keys = []
  const collect = (l) => {
    const m = /^\s*-?\s*([A-Za-z_][\w-]*)\s*:/.exec(l)
    if (m !== null) keys.push(m[1])
  }
  for (let j = idx; j >= 0; j -= 1) {
    const l = lines[j]
    if (l.trim() === '' || l.trim().startsWith('#')) continue
    const li = leadingSpaces(l)
    if (li < indent) break
    if (li === indent) collect(l)
  }
  for (let j = idx + 1; j < lines.length; j += 1) {
    const l = lines[j]
    if (l.trim() === '' || l.trim().startsWith('#')) continue
    const li = leadingSpaces(l)
    if (li < indent) break
    if (li === indent) collect(l)
  }
  return keys
}

/** Index of a `#` comment start with balanced quotes before it, or -1. */
function yamlCommentIndex(line) {
  let inS = false
  let inD = false
  for (let i = 0; i < line.length; i += 1) {
    const c = line[i]
    if (c === "'" && !inD) inS = !inS
    else if (c === '"' && !inS) inD = !inD
    else if (c === '#' && !inS && !inD) return i
  }
  return -1
}

// --- classification ---------------------------------------------------------------------

/**
 * The per-advisory-line caveat the 2026-10-08 round-2 review demanded
 * (dispatch condition #2): naming WHY the §7.3 narrowing will (almost never)
 * or will not reach this literal, measured under the real flip (evidence
 * 17-flip-73-exact-measurement.txt: 1/18 reddened). First match wins; the
 * search window is the site's line, the outer lines the classifier already
 * read (heads/fn), and up to 6 lines AFTER the site (the cast closing a
 * returned literal, `} as unknown as TeamBlueprint`, sits there).
 */
function advisoryCaveat(siteLine, outerTexts, lines, idx) {
  const window = [siteLine, ...outerTexts]
  for (let k = idx; k <= Math.min(lines.length - 1, idx + 6); k += 1) window.push(lines[k])
  const text = window.join('\n')
  if (/as unknown as/.test(text)) {
    return 'typed-code-position [as-unknown-as -> §7.3\'s narrowing will NOT catch it (measured: survivor of the real flip)]'
  }
  if (/: *TeamBlueprint\b/.test(text) && !/Record<string, *unknown>/.test(text)) {
    return 'typed-code-position [annotated TeamBlueprint -> the measured flip class that DOES redden (1/18)]'
  }
  if (/toEqual\(|toMatchObject\(/.test(text)) {
    return 'typed-code-position [toEqual/toMatchObject argument -> §7.3\'s narrowing will NOT catch it (measured: survivor)]'
  }
  if (/Record<string, *unknown>/.test(text)) {
    return 'typed-code-position [Record<string,unknown> builder -> §7.3\'s narrowing will NOT catch it (measured: survivor)]'
  }
  return 'typed-code-position [measured survivor of the real §7.3 flip (17/18 survived) — the probe, not tsc, dispositions this line]'
}

/**
 * Classify every version site of ONE file text into the five buckets.
 * Pure; exported so the wrapper pins each rule on a fixture text.
 */
export function classifyText(path, text) {
  const out = { dirty: [], advisory: [], unknown: [], refused: [], prose: [] }
  const ext = extOf(path)
  if (!CODE_EXTENSIONS.includes(ext)) return out
  if (!BLUEPRINT_KEY.test(text)) return out // both-halves key half
  const lines = text.split('\n')
  const isData = DATA_EXT.includes(ext)
  const isUnchecked = UNCHECKED_CODE_EXT.includes(ext)
  const isYaml = ext === '.yml' || ext === '.yaml'
  // YAML gets indent-based context only; everything else — JSON included,
  // since the brace machine reads its objects the same way — runs the line
  // state machine and its segment list.
  const parsed = isYaml ? { states: null, segments: [] } : lineStates(text)
  const states = parsed.states
  const segments = parsed.segments

  lines.forEach((line, idx) => {
    VERSION_LITERAL.lastIndex = 0
    let m
    while ((m = VERSION_LITERAL.exec(line)) !== null) {
      const version = Number(m[1] ?? m[2] ?? m[3])
      if (version === SUPPORTED_DOCUMENT_VERSION) continue
      const site = { path: String(path), line: idx + 1, version }

      // 1) carrier at the match position.
      let carrier
      if (isData) {
        if (isYaml) {
          const hash = yamlCommentIndex(line)
          carrier = hash >= 0 && m.index > hash ? 'comment' : 'data'
        } else {
          carrier = 'data'
        }
      } else {
        // Carrier is decided at the VERSION DIGIT, not at the match start:
        // the quoted-key spelling (a quoted key token followed by a digit)
        // puts only the KEY inside a string; the digit — the thing
        // TypeScript polices or does not — is at a code position. Deciding
        // by match start gave one typed-code position two classes (f31
        // parity, BLOCKING 2).
        const st = states[idx]
        const digitCol = m.index + m[0].length - String(m[1] ?? m[2] ?? m[3]).length
        const kind = st === undefined ? K_CODE : st.kinds[digitCol] ?? K_CODE
        carrier = kind === K_STRING ? 'string' : kind === K_COMMENT ? 'comment' : 'code'
      }
      if (carrier === 'comment') {
        // The predicate's prose half, applied inside a Blueprint file too.
        out.prose.push({ ...site, why: 'comment-carrier' })
        continue
      }

      // 2) evidence pools — SPLIT by the 2026-10-08 review (BLOCKING 1a/b).
      //    The site's OWN pool is the only thing a refusal may rest on:
      //     - string carrier: the keys inside the carried text (a serialized
      //       record carries its own namespace); the ENCLOSING code object
      //       may never refuse a string-carried site — that merge is how a
      //       document passed as an argument to a row-shaped call vanished.
      //     - code/data carrier: the depth-1 keys of the object literal the
      //     site
      //       sits in — same object, same literal.
      //    Head-line and function-signature text is OUTER evidence: always
      //    visible (UNKNOWN), never a refusal. A SPREAD in the site's own
      //    literal hides keys: ctx evidence on it becomes UNKNOWN too.
      let ownKeys = []
      let ownSpread = false
      let refuseCtx = [{ text: line, chan: 'same-line' }]
      let outerCtx = []
      if (isYaml) {
        // A data file IS one literal; its indent structure is its own text.
        ownKeys = yamlSiblings(lines, idx)
        const parent = yamlParentKey(lines, idx)
        if (parent !== '') refuseCtx.push({ text: parent, chan: 'parent-key' })
      } else {
        const chain = headChain(lines, states, idx, m.index)
        const head = chain[0]
        const enclosing =
          head === undefined ? { keys: [], spread: false } : siblingKeys(lines, states, head.idx, head.col)
        const fn = head === undefined ? '' : funcContext(lines, states, head.idx)
        outerCtx = chain.slice(0, 3).map((h, i) => ({ text: h.line, chan: `head${String(i)}` }))
        if (fn !== '') outerCtx.push({ text: fn, chan: 'fn' })
        if (carrier === 'string') {
          const seg = segmentAt(segments, idx, m.index)
          if (seg !== undefined) {
            const ctext = segmentText(lines, seg)
            ownKeys = stringKeyCandidates(ctext)
            refuseCtx.push({ text: ctext, chan: 'carrier-text' })
          }
        } else {
          ownKeys = enclosing.keys
          ownSpread = enclosing.spread
        }
        // The spread guard belongs to the LITERAL, not to the digit's
        // carrier: a quoted digit VALUE inside a SPREAD-built record still
        // hides keys (contracts/test/negative.test.ts:157 — the C2 diff
        // caught this hole).
        if (carrier === 'string') ownSpread = enclosing.spread
      }

      // 3) the namespace ladder — a refusal requires a POSITIVE match on the
      //    site's own literal: a namespace name inside the site's own line /
      //    carrier text, or a signature completed by the site's own keys.
      //    Evidence with document-only keys present in the own literal is a
      //    CONFLICT; on a spread-assisted literal, ctx evidence is not
      //    certifiable; outer-line evidence alone is UNKNOWN. Never a guess.
      // V3 (round 3 F2): `members` was excluded from DOC_ONLY_KEYS because
      // RemoteProjectionValue.members collides on wire frames
      // (packages/remote/src/contracts/types.ts:65) — but that made the old
      // guard a provable NO-OP: a members-only-alongside-another-doc-key
      // document already conflicts via the other key. The reviewer's variant
      // matrix, adopted as V3: members counts as document-only ONLY when the
      // site's own literal also carries >= 2 of the IDENTITY triple — the
      // triple is what distinguishes "partial document" from "projection
      // value with a member list". Measured cost at head: zero new unknowns
      // (f32/f32b pin both edges: members+triple under a row -> UNKNOWN;
      // members WITHOUT the triple stays a refused wire frame).
      const identityHits = IDENTITY_TRIPLE.filter((k) => ownKeys.includes(k)).length
      const ownDocKeys = ownKeys.filter(
        (k) => DOC_ONLY_KEYS.has(k) || (k === 'members' && identityHits >= 2),
      )
      const hits = []
      let sigHit = false
      for (const ns of NON_BLUEPRINT_NAMESPACES) {
        for (const c of refuseCtx) {
          if (ns.ctx.test(c.text)) {
            hits.push({ ns: ns.name, channel: c.chan })
            break
          }
        }
        for (const sig of ns.sibling) {
          if (sig.every((k) => ownKeys.includes(k))) {
            hits.push({ ns: ns.name, channel: carrier === 'string' ? 'carrier-sibling' : 'sibling' })
            sigHit = true
            break
          }
        }
      }
      if (hits.length > 0 && ownDocKeys.length > 0) {
        out.unknown.push({
          ...site,
          why: `namespace-signature(${[...new Set(hits.map((h) => h.ns))].join('+')}) conflicts with document siblings (${ownDocKeys.join(',')})`,
        })
        continue
      }
      if (hits.length > 0 && ownSpread && !sigHit) {
        out.unknown.push({
          ...site,
          why: `named-namespace(${hits[0].ns}/${hits[0].channel}) on SPREAD-assisted literal — hidden keys cannot be certified document-free; adjudicate by hand`,
        })
        continue
      }
      if (hits.length > 0) {
        out.refused.push({ ...site, ns: hits[0].ns, why: `${hits[0].ns}/${hits[0].channel}` })
        continue
      }
      const outerHits = []
      for (const ns of NON_BLUEPRINT_NAMESPACES) {
        for (const c of outerCtx) {
          if (ns.ctx.test(c.text)) {
            outerHits.push({ ns: ns.name, channel: c.chan })
            break
          }
        }
      }
      if (outerHits.length > 0) {
        out.unknown.push({
          ...site,
          why: `outer-line-evidence(${outerHits[0].ns}/${outerHits[0].channel}) — deciding text is not in the site's own literal; adjudicate by hand, never machine-refused`,
        })
        continue
      }

      // 4) a code-position match on a line whose quotes never close is not
      //    classifiable (JSX apostrophes, malformed continuations): UNKNOWN.
      if (states !== null && carrier === 'code' && states[idx]?.openQuote === true) {
        out.unknown.push({ ...site, why: 'unterminated-string-on-line' })
        continue
      }

      // 5) the carrier verdict — THE GATE LIVES HERE.
      if (isData) {
        out.dirty.push({ ...site, why: 'data-file' })
      } else if (isUnchecked) {
        out.dirty.push({ ...site, why: carrier === 'string' ? 'untyped-file+string' : 'untyped-file' })
      } else if (carrier === 'string') {
        out.dirty.push({ ...site, why: 'string-carrier-in-typed-file' })
      } else {
        out.advisory.push({
          ...site,
          why: advisoryCaveat(line, outerCtx.map((c) => c.text), lines, idx),
        })
      }
    }
  })
  return out
}

// --- the scan -------------------------------------------------------------------------

/** Scan the tracked tree. NEVER throws; a failure to read the tree is
 *  `ran: false` with the reason, which the report prints as not-run and the
 *  CLI exits 2 for — "could not run" is never "clean". */
/**
 * The adjudication ledger (round 3 Part C, reviewer-ratified F4). Unknowns
 * GATE by design; every one of them must carry a human, path-named verdict.
 * The ledger therefore lives in a FILE THE FENCE READS —
 * dev/agent-workflow/evidence/a4-pr7/scan-scope/unknown-adjudications.json —
 * keyed `<path>::L<line>` -> evidence. Ledgered sites print as a sixth,
 * NON-GATING class ADJUDICATED with their evidence; closure is defined as
 * "dirty empty AND no unadjudicated unknown", so §7.4's end state is
 * reachable WITHOUT anyone widening a rule for other namespaces' version
 * axes that must never migrate. The soft edge the reviewer found — an empty
 * justification string kept the whole suite green — is closed by refusing to
 * run: keys are THREE-PART "<path>::L<line>::v<version>" — a two-part key
 * lets ONE row adjudicate EVERY literal on the line, and a second literal
 * must cost its own row like everything else; every value must cite
 * `hand-verified <the key's FULL path>:<line[-range]>`, the cited range
 * must exist in that tracked file and CONTAIN the site's line (round 3.5:
 * the fence had run with `hand-verified packages/nowhere/deeper/x.ts:94`
 * and `:99999-100000` — basename+any-digit checked nothing checkable);
 * any violation names the offending keys and exits 2. Silence keeps
 * costing a written, path-named, VERIFIABLE row.
 * THE `intentionally-dirty` CLASS IS RETIRED (R3 decision, 2026-10-08; the
 * full reasoning in 7-4-cdom/FINDINGS.md section 10). It was a seventh,
 * non-gating class: a ledger row could annotate a DIRTY site on a foreign
 * version axis and move it out of the gated set, with an ADMISSION RULE
 * requiring a witness key no Blueprint document may carry. Four rounds of
 * adversarial review ended the same way each round — every tightening moved
 * the cost of laundering, none raised it above a ledger row. The measurement
 * that decided it (scan-scope/60-witness-census-transcript.txt): 59 of 87
 * dirty sites admitted SOME witness under the final rule (reviewer's
 * independent census: 63 of 87), including the SHIPPED COMPOSITION —
 * cordis.patch.yml::L60::v1 admitted via an ordinary sibling key. Two of this
 * file's own sentences are kept HERE, QUOTED AND REFUTED, not softened:
 *   (1) "A literal someone merely FINDS INCONVENIENT has no such witness:
 *        its enclosing object is keyed by Blueprint's own fields" — FALSE on
 *        the census: the ordinary keys of a document's own file (`source:`,
 *        `items:`, `code:`) were admissible witnesses in 59+ of 87 sites.
 *   (2) "laundering requires a source edit in the same diff as the row" —
 *        TRUE of the GATE only because a wrapper assertion pinned the class's
 *        population to p7t6, and that pin was never stated beside it. A
 *        mechanism whose safety rests on pinning its own population is not
 *        enforcing anything; the pin is enforcing it, and relaxing the pin is
 *        the same single edit that opens the trapdoor.
 * The retirement condition this file wrote in round 5 is now the reason this
 * paragraph exists instead of a fifth fix: "if a future round decides that
 * guarantee is not worth having, the correct move is to RETIRE THE CLASS AND
 * KEEP THOSE SITES DIRTY". A mechanism with a stated retirement condition is
 * a tool; the clause did its job, which is the whole point of writing one.
 * The row kind is therefore REFUSED as not-run (not silently ignored): old
 * rows must fail loudly, and every former dirty-class site — all 9 of p7t6's,
 * which were its entire honest population — is DIRTY again, gated, with its
 * DEFERRALS row and executable retirement check as the honest state. The
 * attack corpus that produced this decision lives on WITHOUT an admission
 * path: scan-scope/61-fence-attack-suite.mjs.
 *
 * The ledger file itself must be GIT-TRACKED (round 3.5 G4: the override
 * is the mute with a name on it — with dirty suppressed post-§7.4, a
 * scratch ledger + suppression measured `verdict: clean`, exit 0), so the
 * resolved path is printed in every report header and an untracked ledger
 * is refused unless DSH_SCAN_TEST_MODE=1 — which only the wrapper's own
 * falsification legs set.
 */
const ADJUDICATIONS_FILE =
  'dev/agent-workflow/evidence/a4-pr7/scan-scope/unknown-adjudications.json'

function loadAdjudications(cwd) {
  const override = process.env.DSH_SCAN_ADJUDICATIONS
  const testMode = process.env.DSH_SCAN_TEST_MODE === '1'
  const file = override === undefined ? resolve(cwd, ADJUDICATIONS_FILE) : resolve(cwd, override)
  // G4: the override is the mute with a name on it. Today dirty(120)
  // dominates so no false green is reachable through it; the day §7.4
  // closes, a scratch ledger + suppressed dirty is exactly `verdict:
  // clean`, exit 0 — measured by the reviewer. So the ledger the fence
  // reads must be GIT-TRACKED unless the wrapper's falsification legs
  // explicitly say otherwise (DSH_SCAN_TEST_MODE=1), and every report
  // prints the resolved path it read.
  if (!testMode) {
    const tracked = spawnSync('git', ['ls-files', '--error-unmatch', file], { cwd, encoding: 'utf8' })
    if (tracked.status !== 0) {
      return {
        error: `adjudication ledger ${file} is not git-tracked; the fence reads only reviewed, committed ledgers (DSH_SCAN_TEST_MODE=1 is for the wrapper's own falsification legs)`,
      }
    }
  }
  let raw
  try {
    raw = readFileSync(file, 'utf8')
  } catch (e) {
    return { error: `adjudication ledger unreadable at ${file}: ${String(e)}` }
  }
  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (e) {
    return { error: `adjudication ledger is not valid JSON (${file}): ${String(e)}` }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { error: `adjudication ledger must be an object keyed "<path>::L<line>::v<version>" (${file})` }
  }
  // Fix 5b: every defect prints ITS OWN reason. "fail the hand-verified rule"
  // for no-such-file, no-such-line and not-a-version-site alike is a not-run
  // the operator has to debug by reading the fence's source.
  const bad = []
  for (const [key, ev] of Object.entries(parsed)) {
    // G2: identity is path::L<line>::v<version> — the report already prints
    // `L6=v1`; a two-part key let ONE row adjudicate EVERY literal on the
    // line (v1's verdict laundered v2). Each literal costs its own row.
    const m = /^(.+)::L(\d+)::v(\d+)$/.exec(key)
    if (m === null || typeof ev !== 'string') {
      bad.push(`${key} — key is not "<path>::L<line>::v<version>" or value is not a string`)
      continue
    }
    const sitePath = m[1]
    const siteLine = Number(m[2])
    // G3: the citation must name the key's FULL path, and the cited range
    // must exist in that tracked file and contain the site's line —
    // "silence costs a written row" only if the row can be CHECKED.
    const cite = new RegExp(
      `hand-verified ${sitePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}:(\\d+)(?:-(\\d+))?`,
    ).exec(ev)
    if (cite === null) {
      bad.push(`${key} — no "hand-verified <key's own full path>:<line-range>" citation in the value`)
      continue
    }
    let text
    try {
      text = readFileSync(resolve(cwd, sitePath), 'utf8')
    } catch {
      bad.push(`${key} — no such file for the cited path (${sitePath})`)
      continue
    }
    const a = Number(cite[1])
    const b = cite[2] === undefined ? a : Number(cite[2])
    const lines = text.split('\n')
    if (siteLine < 1 || siteLine > lines.length) {
      bad.push(`${key} — no such line: site is beyond file end (${String(lines.length)} lines in ${sitePath})`)
      continue
    }
    if (!(1 <= a && a <= b)) {
      bad.push(`${key} — cited range ${String(a)}-${String(b)} is malformed (need 1 <= from <= to)`)
      continue
    }
    if (b > lines.length) {
      bad.push(`${key} — cited range ${String(a)}-${String(b)} is beyond file end (${String(lines.length)} lines)`)
      continue
    }
    // FIX 2: evidence is a WINDOW, not the file. `role:` four hundred lines
    // from the site says nothing ABOUT the site; unbounded width turns "the
    // range proves it" into "the file contains the word eventually". The
    // reviewer's Case P laundering (legitimate `role`, range 1-598) dies on
    // this clause alone.
    if (b - a + 1 > ADJ_MAX_RANGE_LINES) {
      bad.push(
        `${key} — cited range ${String(a)}-${String(b)} is wider than the ${String(ADJ_MAX_RANGE_LINES)}-line evidence window`,
      )
      continue
    }
    if (!(a <= siteLine && siteLine <= b)) {
      bad.push(`${key} — cited range ${String(a)}-${String(b)} does not contain the site line L${String(siteLine)}`)
      continue
    }
    // Round 4 item 1 + FIX 1/5: the dirty-class kind adds owner +
    // retirement-check + the ADMISSION RULE witness — a foreign key OUTSIDE
    // the schema-derived document key set, present in the cited window. An
    // invalid dirty row is as fatal to the run as an invalid unknown row:
    // same file, same proof standard, zero second tier.
    if (ev.trimStart().startsWith('intentionally-dirty:')) {
      // R3 (2026-10-08): the class is RETIRED — census in
      // scan-scope/60-witness-census-transcript.txt, reasoning in FINDINGS
      // section 10. A retired kind that silently tolerated its old rows
      // could be re-enabled by forgetting it was retired; so its rows fail
      // the run LOUDLY, and the site keeps its honest class: DIRTY, gated.
      bad.push(
        `${key} — the intentionally-dirty row kind is RETIRED (R3 2026-10-08): its witness rule admitted the majority of dirty sites (census 59-63 of 87, shipped composition included); delete this row — the site stays DIRTY with its DEFERRALS row and retirement-check`,
      )
      continue
    }
  }
  if (bad.length > 0) {
    return {
      error: `adjudication ledger rows rejected (${file}): ${bad.slice(0, 8).join(' | ')}${bad.length > 8 ? ` (+${String(bad.length - 8)} more)` : ''}`,
    }
  }
  return { ledger: new Map(Object.entries(parsed)), file, count: Object.keys(parsed).length }
}

export function scanBlueprintVersionSites() {
  const result = {
    ran: false,
    reason: null,
    scopeFiles: 0,
    dirty: [],
    advisory: [],
    unknown: [],
    adjudicated: [],
    blindKeyHalf: 0,
    blindDocMarked: 0,
    blindNonTyped: 0,
    blindNumericForms: 0,
    ledgerFile: '',
    ledgerCount: 0,
    refused: [],
    prose: [],
  }
  // Round 3 F3: every scope prefix and `git ls-files` below is cwd-relative,
  // so a run from any subdirectory used to see 0 files and print CLEAN,
  // exit 0, while the tree held 120 dirty files — a green handed to exactly
  // the lane worker typing `cd packages/client && node ../../scripts/...`.
  // The non-repo case was pinned (/tmp -> exit 2); this closes the likelier
  // mistake: only the repository TOPLEVEL is a valid cwd.
  const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' })
  if (top.status === 0) {
    const toplevel = String(top.stdout ?? '').trim()
    const here = resolve(process.cwd())
    if (toplevel !== '' && resolve(toplevel) !== here) {
      result.reason =
        `cwd ${here} is not the repository toplevel (${toplevel}); the fence gates on the WHOLE tree — run it from the toplevel`
      return result
    }
  }
  const adj = loadAdjudications(process.cwd())
  if ('error' in adj) {
    result.reason = adj.error
    return result
  }
  result.ledgerFile = adj.file
  result.ledgerCount = adj.count
  let out
  try {
    // maxBuffer: the tracked-file list is >1 MB NUL-separated at this base,
    // and the default 1 MB buffer kills the spawn with ENOBUFS — which this
    // scan would then (correctly, but confusingly) report as "not run".
    // Sized generously: the failure mode to avoid is a truncated list read
    // as a clean tree.
    out = spawnSync('git', ['ls-files', '-z'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  } catch (e) {
    result.reason = `git could not be spawned: ${String(e)}`
    return result
  }
  if (out.error !== undefined || out.status !== 0 || typeof out.stdout !== 'string') {
    result.reason = `git ls-files failed (status ${String(out.status)}): ${String(out.stderr ?? '').trim()}`
    return result
  }
  const paths = out.stdout.split('\0').filter((p) => p.length > 0)
  if (paths.length === 0) {
    result.reason = 'git ls-files returned an empty file list (an empty tree is not a clean tree)'
    return result
  }
  result.ran = true
  const inScope = paths.filter(isScanScopePath).sort()
  result.scopeFiles = inScope.length
  for (const p of inScope) {
    let text
    try {
      text = readFileSync(resolve(p), 'utf8')
    } catch (e) {
      // An unreadable in-scope file is treated as offending, not skipped.
      result.dirty.push({ path: p, line: 0, version: 0, why: `unreadable(${String(e)})` })
      continue
    }
    if (!BLUEPRINT_KEY.test(text)) {
      // Round 3 D: the both-halves rule (file needs a blueprintId text half
      // AND a version digit) is conservative by design — but its blind spot
      // was hand-reconstructed archaeology (36 files, 7 doc-marked, at the
      // round-1 audit; all read, zero documents lost). Compute it live.
      countNumericFormVariants(result, text)
      if (VERSION_LITERAL_TEST.test(text)) {
        result.blindKeyHalf += 1
        // The reviewer's narrower population: the typed half is safe by
        // construction (blueprintId is required on TeamBlueprint and tsc
        // enforces it), so only NON-typed files can hide a document the
        // fence never sees.
        if (!/\.(ts|tsx|mts|cts)$/.test(p)) {
          result.blindNonTyped += 1
          if (DOC_SHAPE_MARKERS.test(text)) result.blindDocMarked += 1
        }
      }
      continue
    }
    countNumericFormVariants(result, text)
    const c = classifyText(p, text)
    result.dirty.push(...c.dirty)
    result.advisory.push(...c.advisory)
    result.unknown.push(...c.unknown)
    result.refused.push(...c.refused)
    result.prose.push(...c.prose)
  }
  // Part C: ledgered unknowns leave the gated set for the ADJUDICATED class.
  for (const site of result.unknown) {
    const key = `${site.path}::L${String(site.line)}::v${String(site.version)}`
    const evidence = adj.ledger.get(key)
    if (evidence !== undefined) result.adjudicated.push({ ...site, evidence })
  }
  if (result.adjudicated.length > 0) {
    const done = new Set(
      result.adjudicated.map((a) => `${a.path}::L${String(a.line)}::v${String(a.version)}`),
    )
    result.unknown = result.unknown.filter(
      (u) => !done.has(`${u.path}::L${String(u.line)}::v${String(u.version)}`),
    )
  }
  const byLine = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : a.line - b.line)
  for (const k of ['dirty', 'advisory', 'unknown', 'adjudicated', 'refused', 'prose']) result[k].sort(byLine)
  return result
}

// --- reporting -------------------------------------------------------------------------

function groupByPath(sites, render) {
  const lines = []
  let cur = null
  let parts = []
  for (const s of sites) {
    if (s.path !== cur) {
      if (cur !== null) lines.push(render(cur, parts))
      cur = s.path
      parts = []
    }
    parts.push(s)
  }
  if (cur !== null) lines.push(render(cur, parts))
  return lines
}

const where = (s) => `L${String(s.line)}=v${String(s.version)}`
const whereWhy = (s) => `L${String(s.line)}=v${String(s.version)}(${s.why})`
const whereNs = (s) => `L${String(s.line)}(v${String(s.version)}) non-blueprint-namespace(${s.why})`

export function formatReport(result) {
  const lines = []
  lines.push('scan: blueprint document-version fence (A4-PR7 7.5 + 7.4-scope, ADR A3-16)')
  lines.push(
    'scope: tests/kits/, scripts/, packages/**/harness/, packages/*/test/, packages/**/testdata/, tests/mock/scripts/, cordis.patch.yml (dev/agent-workflow, dist and non-code extensions excluded)',
  )
  lines.push(`scanned-in-scope: ${String(result.scopeFiles)} tracked files`)
  lines.push(
    `SCOPE-NOTE blind spot: ${String(result.blindKeyHalf)} files (${String(result.blindNonTyped)} non-typed, ${String(result.blindDocMarked)} doc-marked where the fence is the only defence) — blueprintId is required on TeamBlueprint, so wherever tsc runs a schema-valid document cannot hide in a file with no blueprintId text; the non-typed half is the real exposure and prints live; numeric-form family the text predicate does NOT read: +N (unary plus), 0x hex, template-string, computed-key — ${String(result.blindNumericForms)} variant site(s) counted live today (template-carriers dominate; none was introduced by a named mutation): the fence is a SOURCE-TEXT scanner guarding a governance property (do not launder retired version digits into fixtures), while the SAFETY property is enforced by the parser refusing unsupported versions at runtime, which no textual form evades; widen red-first only if a named mutation shows a variant actually in use; named integrity case: pr-e-requirement-recovery-smoke asserts raw-byte equality of a saved v1 source under a pinned hash, where a numeric-form rewrite stays self-consistent (hashes cover the parsed projection) — "these exact bytes are historical" is guarded by that kit's byte assertion, not by this fence: kit-proof integrity, not runtime safety`,
  )
  lines.push(`adjudication-ledger: ${result.ledgerFile} (${String(result.ledgerCount)} entries)`)
  lines.push(
    'SCOPE-NOTE lineStates continuation: the closed backslash-newline branch was dead at merge (post-loop carry guard tautological; mid-line closes reported as unterminated — conservative); R3-D revived it, fixture f35 pins the closed-tail-is-code behavior',
  )
  if (!result.ran) {
    lines.push(`RESULT not-run :: ${result.reason ?? 'unknown reason'}`)
    return lines.join('\n')
  }
  const keyed = new Set(
    [...result.dirty, ...result.advisory, ...result.unknown, ...result.refused, ...result.prose].map(
      (s) => s.path,
    ),
  )
  lines.push(`blueprint-keyed files with version digits: ${String(keyed.size)}`)
  lines.push(
    'GATE: dirty + UNADJUDICATED unknown only. Closure = dirty empty AND no unadjudicated unknown. adjudicated/refused/prose print for dispatch and audit, never gated. (The seventh class intentionally-dirty was RETIRED in R3 2026-10-08 — its row kind is a not-run; FINDINGS section 10.)',
  )
  lines.push(...groupByPath(result.dirty, (p, ss) => `OFFENDING ${p} :: ${ss.map(where).join(', ')}`))
  lines.push(...groupByPath(result.unknown, (p, ss) => `UNKNOWN ${p} :: ${ss.map(whereWhy).join(', ')}`))
  lines.push(
    ...groupByPath(result.advisory, (p, ss) => `ADVISORY ${p} :: ${ss.map(whereWhy).join(', ')}`),
  )
  lines.push(
    ...groupByPath(
      result.adjudicated,
      (p, ss) =>
        `ADJUDICATED ${p} :: ${ss.map((s) => `L${String(s.line)}=v${String(s.version)} (${s.evidence})`).join(', ')}`,
    ),
  )
  lines.push(...groupByPath(result.refused, (p, ss) => `REFUSED ${p} :: ${ss.map(whereNs).join(', ')}`))
  lines.push(...groupByPath(result.prose, (p, ss) => `PROSE ${p} :: ${ss.map(where).join(', ')}`))
  const tally = (arr) =>
    `${String(new Set(arr.map((s) => s.path)).size)} files, ${String(arr.length)} sites`
  lines.push(`RESULT dirty(${tally(result.dirty)})`)
  lines.push(`RESULT unknown(${tally(result.unknown)})`)
  lines.push(`RESULT advisory(${tally(result.advisory)})`)
  lines.push(`RESULT refused(${tally(result.refused)})`)
  lines.push(`RESULT prose(${tally(result.prose)})`)
  lines.push(`RESULT adjudicated(${tally(result.adjudicated)})`)
  const gating = result.dirty.length + result.unknown.length
  lines.push(
    gating === 0
      ? 'RESULT verdict: clean (dirty 0, unadjudicated unknown 0)'
      : 'RESULT verdict: dirty-or-unknown (see the OFFENDING/UNKNOWN lines)',
  )
  return lines.join('\n')
}

// --- CLI (the wrapper test imports the functions above and also spawns this) ----------
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const result = scanBlueprintVersionSites()
  process.stdout.write(`${formatReport(result)}\n`)
  const gating = result.dirty.length + result.unknown.length
  process.exit(!result.ran ? 2 : gating > 0 ? 1 : 0)
}
