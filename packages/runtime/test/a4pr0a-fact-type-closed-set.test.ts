/**
 * A4-PR0a — the fact-type closed-set guard (ADR A4-4 + A5-16).
 *
 * WHY THIS EXISTS. `factType` is an OPEN hygienic string in storage
 * (`packages/storage/schema/ledger.ts` validates shape, not membership), while
 * the projection fold maps every root ledger entry to one of the EIGHT frozen
 * categories and THROWS `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` for
 * anything unmapped, on every projection read. So "someone added a fact type
 * and forgot the category map" is not a cosmetic omission: it breaks
 * `team.getProjection` for every Team that ever writes that fact. That is how
 * `artifact-read-granted` broke reads once before (the H1 repair in
 * `p8s7r2-disposed-history.test.ts`), and it is exactly how
 * `control-request-abandoned` breaks them today (see
 * `a4pr0a-abandon-projection-closure.test.ts`).
 *
 * WHY THE DERIVATION RESOLVES IDENTIFIERS (ADR A5-16). Production writes its
 * fact types almost never as inline literals: writers use module constants
 * (`FACT_ABANDONMENT`, `ARTIFACT_READ_GRANTED_FACT_TYPE`,
 * `MESSAGING_FACT_DELIVERED`, `POLICY_STATE_FACT_TYPE`), a lookup table
 * (`activity/facts.ts OP_TO_FACT_TYPE`), and a closed record of types
 * (`requirements/facts.ts REQUIREMENT_FACT_TYPES`). A scan for `factType:`
 * LITERALS therefore PASSES ON THE COMMIT THAT CONTAINS THE BUG and would miss
 * Alpha.4's own new types, which are constants by design. So the derivation
 * resolves identifiers against a global constant/table table built from every
 * tracked production source, and — because a derivation that silently
 * under-collects would police nothing — it ALSO (i) asserts positive
 * containment of the fact types it exists to protect, (ii) pins the set of
 * write sites it could NOT resolve (a new dynamic writer is a review-visible
 * edit here), and (iii) proves itself non-vacuous by deleting the abandonment
 * entry from a parsed copy of the map and requiring the check to catch it.
 *
 * Scoping discipline (plan A1.2.6): tracked sources only (`git ls-files`),
 * skipping tests, `dist`, `.d.ts`, and generated scratch — never a walk over
 * gitignored trees.
 *
 * Run it from the repo root (`pnpm vitest run packages/runtime/test/…`), like
 * every other suite here: the tracked-path lookups are repo-root-relative, and
 * a per-package invocation therefore fails LOUD ("the guard has no subject")
 * rather than passing on an empty file set — the safe direction for a guard.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

/** `noUncheckedIndexedAccess` makes every regex group `string | undefined`.
 *  These patterns are anchored and the files they read are ours, so a missing
 *  group means the PATTERN drifted — which for a guard is a silent loss of
 *  coverage. Fail loud instead of casting the hole away. */
function group(match: RegExpMatchArray, index: number): string {
  const value = match[index]
  if (value === undefined) {
    throw new Error(`guard regex lost group ${index} — the extraction pattern drifted`)
  }
  return value
}

function trackedSources(): string[] {
  const out = execFileSync('git', ['ls-files', 'packages'], { encoding: 'utf8' })
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .filter((f) => !f.includes('/test/') && !f.includes('/dist/'))
}

/** The files the derivation polices: anything that can put a fact on the
 *  ledger. Three independent shapes, because the review of the first version of
 *  this guard found the narrow version blind to two of them — gating only on a
 *  direct `putEntry` / `ledger.put` call skipped `action-router/work-execution.ts`
 *  and `root-initial-work.ts` (which append through the positional
 *  `commitDurableFact` funnel from another directory) and
 *  `admission/actions.ts` (which writes a labelled literal with no direct
 *  append call at all). Those were precisely the files holding the residual, so
 *  the gate now follows every route to the ledger:
 *    1. a direct ledger append,
 *    2. a call into the durable-fact funnel,
 *    3. a labelled `factType:` write site.
 *  Reader / type / validation noise still falls out mechanically: client,
 *  remote and the storage schema layer match none of the three. */
function writerSources(files: readonly string[], sources: Map<string, string>): string[] {
  const WRITER_SHAPES = [
    /\bputEntry\s*\(|\bledger\.put\s*\(|\.put\(\s*entry\b|appendLedger/,
    /\bcommitDurableFact\s*\(/,
    // Importing the durable-fact funnel reaches the ledger through it even when the importer renames it on the
    // way in. Round 2 of #517 planted `import { commitDurableFact as commit }` and this census did not merely
    // fail to judge the file — it never classified it as a writer at all, so no other rule looked at it either
    // (F-R2-5). The call-site harvest cannot follow an alias, so the file is pulled in and forced to speak.
    /\bimport\b[^;\n]*\bcommitDurableFact\b/,
    // Any quoted label, not only a single-quoted one, and any computed label expression: a writer that spells
    // its fact type with double quotes or builds it from a concatenation is still writing a fact type, and
    // gating the CLASSIFICATION on one quote style made the whole guard blind to such a file at once (round 1
    // of #517, F2). Measured on this tree: the widening adds no new file today.
    /factType:\s*['"`]/,
    /factType:\s*[A-Za-z_$][\w$.]*\s*[+?|]/,
  ]
  return files.filter((f) => {
    const src = sources.get(f) ?? ''
    return WRITER_SHAPES.some((shape) => shape.test(src))
  })
}

function buildSources(files: readonly string[]): Map<string, string> {
  const map = new Map<string, string>()
  for (const f of files) {
    try {
      map.set(f, readFileSync(f, 'utf8'))
    } catch {
      /* untracked or unreadable: not a production source we police */
    }
  }
  return map
}

/** `const NAME = 'literal'` and `const NAME = { k: 'literal', ... }` across
 *  EVERY production source — the resolution the literal-only scan lacked.
 *
 *  Built in two passes: the first collects plain constants, the second
 *  harvests the CLOSED REGISTRIES (`*_FACT_TYPE*` records), whose members are
 *  themselves constants (`REQUIREMENT_FACT_TYPES.optionalRequirementAccepted:
 *  OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE`). A one-level scan of those
 *  records would see identifiers and collect nothing — the same blind spot,
 *  one level up. */
function buildConstTables(sources: ReadonlyMap<string, string>): {
  readonly consts: Map<string, string>
  readonly registries: Map<string, Set<string>>
  readonly unresolvedRegistries: Set<string>
} {
  const consts = new Map<string, string>()
  const constRe = /const\s+([A-Z_][A-Z0-9_]*)\s*(?::[^=]+)?=\s*'([^']+)'/g
  for (const src of sources.values()) {
    for (const m of src.matchAll(constRe)) {
      const name = group(m, 1)
      if (!consts.has(name)) consts.set(name, group(m, 2))
    }
  }

  const registries = new Map<string, Set<string>>()
  const unresolvedRegistries = new Set<string>()
  const tableRe = /const\s+([A-Z_][A-Z0-9_]*FACT_TYPE[A-Z0-9_]*)[^=\n]*=\s*\{([\s\S]*?)\n\}/g
  for (const src of sources.values()) {
    for (const m of src.matchAll(tableRe)) {
      const tableName = group(m, 1)
      const values = new Set<string>()
      for (const entry of group(m, 2).matchAll(/:\s*('[a-z0-9-]+'|[A-Z_][A-Z0-9_]*)\s*,?\s*$/gm)) {
        const raw = group(entry, 1)
        if (raw.startsWith("'")) {
          values.add(raw.replace(/'/g, ''))
          continue
        }
        const value = consts.get(raw)
        if (value !== undefined) {
          values.add(value)
          continue
        }
        unresolvedRegistries.add(`${tableName}.${raw}`)
      }
      if (values.size > 0 && !registries.has(tableName)) registries.set(tableName, values)
    }
  }
  return { consts, registries, unresolvedRegistries }
}

/** Every fact type a closed registry names, plus every plain `*_FACT_TYPE*`
 *  constant. These are producers by declaration, whatever their call sites
 *  look like — which is what makes a writer-position scan insufficient. */
function registryFactTypes(
  sources: ReadonlyMap<string, string>,
  consts: ReadonlyMap<string, string>,
  registries: ReadonlyMap<string, Set<string>>,
): Set<string> {
  const values = new Set<string>()
  for (const members of registries.values()) for (const value of members) values.add(value)
  for (const [name, value] of consts) if (name.includes('FACT_TYPE')) values.add(value)
  void sources
  return values
}

/** `const NAME = 'literal'` and `const NAME = { k: 'literal', ... }` across
 *  EVERY production source — the resolution the literal-only scan lacked. */

/** Split a call's argument list at top-level commas (paren/brace/bracket and
 *  string aware), so the fact-type POSITION can be read out of a multi-line
 *  call without a parser dependency. */
function topLevelArgs(inner: string): string[] {
  const args: string[] = []
  let depth = 0
  let quote: string | null = null
  let current = ''
  for (let i = 0; i < inner.length; i += 1) {
    const ch = inner[i] as string
    if (quote !== null) {
      current += ch
      if (ch === quote && inner[i - 1] !== '\\') quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      current += ch
      continue
    }
    if (ch === '(' || ch === '{' || ch === '[') depth += 1
    if (ch === ')' || ch === '}' || ch === ']') depth -= 1
    if (ch === ',' && depth === 0) {
      args.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  args.push(current.trim())
  return args
}

/**
 * Argument text `inner` of every call to `FUN` in `src`, balanced-scan based.
 *
 * The call site is located with `\s*(` rather than an `indexOf` of the literal `FUN(`. `commitDurableFact (repos,
 * …)` — one space — is the same call to TypeScript, and the literal needle meant the funnel harvest never ran for
 * it, so the fact type travelling in its fourth argument was neither derived nor forced to be named (round 2 of
 * #517, F-R2-5). The CLASSIFIER above already matched with the space; a guard whose two halves disagree about
 * what a call looks like reports its own hole as a clean sweep.
 */
function callArgumentTexts(src: string, fun: string): string[] {
  const out: string[] = []
  const call = new RegExp(`\\b${fun}\\s*\\(`, 'g')
  for (;;) {
    const hit = call.exec(src)
    if (hit === null) return out
    const start = hit.index
    // A declaration (`function FUN(` / `const FUN = (`) is not a write.
    if (/(?:function|const|let)\s*$/.test(src.slice(Math.max(0, start - 20), start))) continue
    let depth = 0
    let quote: string | null = null
    let i = start + hit[0].length
    for (; i < src.length; i += 1) {
      const ch = src[i] as string
      if (quote !== null) {
        if (ch === quote && src[i - 1] !== '\\') quote = null
        continue
      }
      if (ch === "'" || ch === '"' || ch === '`') {
        quote = ch
        continue
      }
      if (ch === '(' || ch === '{' || ch === '[') depth += 1
      else if (ch === ')' || ch === '}' || ch === ']') {
        depth -= 1
        if (depth === 0) break
      }
    }
    out.push(src.slice(start + hit[0].length, i))
    // Resume after the balanced argument region, as the literal-needle scan did: a nested call inside an
    // argument is part of this site, not a second site.
    call.lastIndex = i + 1
  }
}

/** The durable-fact funnel writes its fact type as the FOURTH positional
 *  argument (`commitDurableFact(repos, root, now, factType, payload)`), so a
 *  `factType:`-keyed scan never sees that family at all
 *  (`member-lifecycle-changed`, `team-root-work-delivered`, …). */
function harvestFunnelSites(
  writers: readonly string[],
  sources: ReadonlyMap<string, string>,
  consts: ReadonlyMap<string, string>,
  values: Set<string>,
  unresolved: Set<string>,
): void {
  for (const file of writers) {
    const src = sources.get(file) ?? ''
    const sites = callArgumentTexts(src, 'commitDurableFact')
    // The funnel arrives under another name and no recognisable call site exists, so this harvest is looking at
    // the wrong identifier. Unresolvable is not the same as absent: the file must name what it writes, exactly
    // as a concatenation does.
    if (sites.length === 0 && /\bimport\b[^;\n]*\bcommitDurableFact\b/.test(src)) {
      unresolved.add(`${file}::durable-fact-funnel-imported-by-alias`)
    }
    for (const inner of sites) {
      const args = topLevelArgs(inner)
      const raw = args[3] ?? ''
      const literal = resolvedLiteralText(raw)
      if (literal !== undefined) {
        values.add(literal)
        continue
      }
      const identifier = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)$/)
      const constName = identifier === null ? undefined : group(identifier, 1)
      if (constName !== undefined && consts.has(constName)) {
        values.add(consts.get(constName) as string)
        continue
      }
      unresolved.add(`${file}::commitDurableFact arg4 ${raw.slice(0, 24)}`)
    }
  }
}

type Derived = {
  /** Every fact type the writers can produce, resolved through constants. */
  readonly values: Set<string>
  /** Write sites the derivation could not resolve — pinned in a test. */
  readonly unresolved: Set<string>
}

/**
 * The text of a quoted string literal, in any of the three quote styles, or `undefined`.
 *
 * Round 1 of #517 found the derivation recognising only the single-quoted style, which made "closed set" mean
 * "closed over the spellings this scanner happens to read". Quote style is a formatting choice, not a property
 * of the value.
 */
function stringLiteralText(raw: string): string | undefined {
  const single = raw.match(/^'([^']*)'$/)
  if (single !== null) return group(single, 1)
  const double = raw.match(/^"([^"]*)"$/)
  if (double !== null) return group(double, 1)
  const backtick = raw.match(/^`([^`]*)`$/)
  if (backtick !== null) return group(backtick, 1)
  return undefined
}

/**
 * Resolve a fact-type expression that is made only of string literals — including a concatenation of them.
 *
 * A value written as `'sneaky' + '-fact-x'` is fully determined at compile time: leaving it in `unresolved`
 * hides an unwritten-in-registry fact type behind a name nobody reads, while resolving it puts the value in
 * front of the closed-set assertion, which is the whole point of the guard. Anything that is not literals all
 * the way down still stays unresolved, because that is the truth.
 */
function resolvedLiteralText(raw: string): string | undefined {
  const direct = stringLiteralText(raw)
  if (direct !== undefined) return direct
  const parts = raw.split('+').map((part) => part.trim())
  if (parts.length < 2) return undefined
  const pieces: string[] = []
  for (const part of parts) {
    const text = stringLiteralText(part)
    if (text === undefined) return undefined
    pieces.push(text)
  }
  return pieces.join('')
}

function deriveWrittenFactTypes(
  writers: readonly string[],
  sources: ReadonlyMap<string, string>,
  consts: ReadonlyMap<string, string>,
  registries: ReadonlyMap<string, Set<string>>,
): Derived {
  const values = new Set<string>()
  const unresolved = new Set<string>()
  for (const file of writers) {
    const src = sources.get(file) ?? ''
    for (const m of src.matchAll(/factType:\s*([^\n,}]+)/g)) {
      const raw = group(m, 1).trim()
      const literal = resolvedLiteralText(raw)
      if (literal !== undefined) {
        values.add(literal)
        continue
      }
      const identifier = raw.match(/^([A-Z_][A-Z0-9_]*)$/)
      if (identifier) {
        const name = group(identifier, 1)
        if (consts.has(name)) {
          values.add(consts.get(name) as string)
          continue
        }
        if (registries.has(name)) {
          for (const value of registries.get(name) as Set<string>) values.add(value)
          continue
        }
        unresolved.add(`${file}::${name}`)
        continue
      }
      const registryAccess = raw.match(/^([A-Z_][A-Z0-9_]*)\[/)
      const registryName = registryAccess === null ? undefined : group(registryAccess, 1)
      if (registryName !== undefined && registries.has(registryName)) {
        for (const value of registries.get(registryName) as Set<string>) values.add(value)
        continue
      }
      // A dynamic write: the value comes from a variable, a call or a member
      // expression. It cannot be derived statically, so it must be named here.
      unresolved.add(`${file}::${raw.slice(0, 40)}`)
    }
    // A shorthand property is the same problem with the value removed rather than indirected: `put({ factType,
    // payload })` carries no text to derive from at all. Round 2 of #517 measured the worst available outcome —
    // the file WAS classified as a writer (the `.put(` shape matched), was judged to write nothing, and was
    // forced into nothing either, so the fact type travelled through the census unjudged while the census
    // reported a clean sweep (F-R2-5). Nothing static can read the value here; what the scan can do is refuse to
    // let the site pass unremarked, which is what "must be named" has always meant.
    // One entry per FILE rather than per site: a byte offset would drift with every unrelated edit to a hot
    // file, and a check that goes red on an innocent reflow trains nobody to read it. Which file hides a
    // shorthand label is the reviewable fact; how many labels it hides is visible in the file itself.
    if (/[{,]\s*factType\s*[,}]/.test(src)) unresolved.add(`${file}::shorthand-factType`)
  }
  return { values, unresolved }
}

/** Parse the host's `FACT_TYPE_CATEGORY` map, resolving its key constants. */
function parseHostMap(
  sources: ReadonlyMap<string, string>,
  consts: ReadonlyMap<string, string>,
): Map<string, string> {
  const src = sources.get('packages/runtime/src/plugin/projection-source.ts') ?? ''
  const block = src.match(/FACT_TYPE_CATEGORY[\s\S]*?=\s*new Map\(\[([\s\S]*?)\n\]\)/)
  if (block === null) throw new Error('FACT_TYPE_CATEGORY block not found — the guard has no subject')
  const globalConsts = new Map(consts)
  // The map's own file declares most of its keys; consts already covers it.
  const entries = new Map<string, string>()
  const mapBody = group(block, 1)
  for (const m of mapBody.matchAll(/\[\s*('?[A-Za-z_][A-Za-z0-9_.]*'?)\s*,\s*'([a-z]+)'\s*\]/g)) {
    const rawKey = group(m, 1)
    const category = group(m, 2)
    if (rawKey.startsWith("'")) {
      entries.set(rawKey.replace(/'/g, ''), category)
      continue
    }
    const value = globalConsts.get(rawKey)
    if (value === undefined) {
      throw new Error(`FACT_TYPE_CATEGORY key '${rawKey}' resolves to no constant — unpoliceable`)
    }
    entries.set(value, category)
  }
  return entries
}

/** Parse the client's category map (the mirror the ledger summary computes over). */
function parseClientMap(sources: ReadonlyMap<string, string>): Set<string> {
  const src = sources.get('packages/client/src/model/ledger-adapter.ts') ?? ''
  const block = src.match(/[A-Z_]*CATEGORY[A-Za-z_]*[^\n]*=[^\n]*\{([\s\S]*?)\n\}/)
  if (block === null) throw new Error('the client category map was not found — the guard has no subject')
  const keys = new Set<string>()
  for (const m of group(block, 1).matchAll(/'([a-z0-9-]+)'\s*:/g)) keys.add(group(m, 1))
  return keys
}

const FILES = trackedSources()
const SOURCES = buildSources(FILES)
const WRITERS = writerSources(FILES, SOURCES)
const { consts: CONSTS, registries: REGISTRIES, unresolvedRegistries: UNRESOLVED_REGISTRIES } =
  buildConstTables(SOURCES)
const DERIVED = deriveWrittenFactTypes(WRITERS, SOURCES, CONSTS, REGISTRIES)
// Closed registries are producers by declaration: union them in so the guard
// covers the families whose call sites pass the type through a variable.
for (const value of registryFactTypes(SOURCES, CONSTS, REGISTRIES)) DERIVED.values.add(value)
// …and the positional durable-fact funnel, which has no `factType:` label.
harvestFunnelSites(WRITERS, SOURCES, CONSTS, DERIVED.values, DERIVED.unresolved)
const HOST = parseHostMap(SOURCES, CONSTS)
const CLIENT = parseClientMap(SOURCES)

/** The eight frozen categories (`packages/contracts/src/projection/states.ts`).
 *  A ninth is not an option: the projection contract is byte-frozen. */
const FROZEN_CATEGORIES = [
  'compatibility',
  'control',
  'lifecycle',
  'member',
  'message',
  'policy',
  'progress',
  'team',
] as const

/** Dynamic write sites the static derivation cannot resolve. Every entry is a
 *  reviewed decision, and a new dynamic writer fails this test until it is
 *  reviewed here — which is the point. */
const PINNED_UNRESOLVED = [
  // Type annotations and pass-throughs in writer files. The value is supplied
  // by a caller, and every constant any caller can pass is resolved above
  // (control/service.ts defines FACT_REQUEST / FACT_DECISION / FACT_CONSUMPTION
  // / FACT_ABANDONMENT; requirements/facts.ts forwards a RequirementFactType,
  // whose closed registry is harvested). They stay listed because a NEW
  // unresolvable write must be a review-visible edit, not a silent gap.
  'packages/runtime/action-router/effects.ts::string',
  // The action-router's durable-fact funnel forwards its own `factType`
  // parameter; its callers write through the `factType:`-keyed paths this
  // derivation already resolves.
  'packages/runtime/action-router/effects.ts::commitDurableFact arg4 factType',
  // Shorthand labels — `put({ factType, payload })` — which carry no text to derive from at all. Found by the
  // widening round 2 of #517 asked for (F-R2-5): before it, a file in this shape was classified as a writer,
  // judged to write nothing, and forced into nothing either. All three forward a value a caller supplied, and
  // each is one of the sites the entry above already describes as a pass-through; they are listed because a NEW
  // unresolvable write must be a review-visible edit. `review-assignment/writer.ts` is this PR's own governed
  // writer, and its one shorthand label is `factType`, bound two lines above from
  // `REVIEW_ASSIGNMENT_FACT_TYPES[command.kind]` — the kernel's closed map, not a producer of a new one.
  'packages/runtime/action-router/effects.ts::shorthand-factType',
  'packages/runtime/requirements/facts.ts::shorthand-factType',
  'packages/runtime/review-assignment/writer.ts::shorthand-factType',
  'packages/runtime/control/service.ts::string',
  'packages/runtime/requirements/facts.ts::RequirementFactType',
  // A4-PR0's proposal store: the ledger-row PORT type and the corrupt-outcome
  // type both annotate the member as a plain `string` (the port is structural,
  // so it must not name a fact-type literal it does not own). Its one real
  // write site is `factType: GOVERNANCE_PROPOSAL_FACT_TYPE`, which resolves
  // through the constant table above — this entry is a type annotation, not a
  // dynamic write.
  'packages/runtime/governance/proposal-store.ts::string',
  // Alpha.6 PR-I1a's governed ReviewAssignment writer (#507, user ruling of 2026-10-31: one durable writer,
  // reusing the existing TeamDomain ledger). Six entries, and none of them is a fact-type PRODUCER, which is the
  // distinction the whole list exists to keep honest:
  //  - `::string` is the port and row annotations (`readonly factType: string`) — the structural ledger-row
  //    shape must not name a fact-type literal it does not own, exactly as in proposal-store.ts above;
  //  - `::string; ledgerSequence: number` and `::string; readonly payload: ReviewAssignme` are the same
  //    annotations written INLINE in a parameter type, which the line-based regex sweeps up as one match. They
  //    are scanner artefacts, named rather than worked around: a workaround here (reformatting the annotation to
  //    slip past the regex) would teach the next writer to hide from this guard;
  //  - `::row.factType`, `::replay.factType` and `::reread.factType` pass through a fact type that came BACK
  //    FROM THE LEDGER (fold input, replay short-circuit, read-back comparison). The writer cannot mint a value
  //    at those sites, in the same way `journal.ts::row.intent.type` cannot.
  // The one place this writer DOES mint a fact type is the kernel's `encodeAssignmentFact`, whose registry
  // REVIEW_ASSIGNMENT_FACT_TYPES is a closed registry harvested by this file — pinned below in C1, and covered
  // on the registration side by C1b's residual, which is still exactly one entry wide.
  'packages/runtime/review-assignment/writer.ts::row.factType',
  'packages/runtime/review-assignment/writer.ts::replay.factType',
  'packages/runtime/review-assignment/writer.ts::reread.factType',
  'packages/runtime/review-assignment/writer.ts::string',
  'packages/runtime/review-assignment/writer.ts::string; ledgerSequence: number',
  'packages/runtime/review-assignment/writer.ts::string; readonly payload: ReviewAssignme',
  'packages/storage/operations/journal.ts::row.intent.type',
] as const

describe('A4-PR0a: every fact type production can write is registered in the ledger category maps', () => {
  it('C1: the derivation really sees the constant-mediated writers (a literal-only scan does not)', () => {
    // These four are written ONLY through constants — the exact blind spot of
    // a `factType: '...'` scan, and the reason A5-16 exists.
    for (const factType of [
      'control-request-recorded',
      'control-decision-recorded',
      'control-allow-consumed',
      'control-request-abandoned',
    ]) {
      expect(DERIVED.values.has(factType), `derived set is missing ${factType}`).toBe(true)
    }
    // A4-PR0's proposal writer is constant-mediated in the same way
    // (`factType: GOVERNANCE_PROPOSAL_FACT_TYPE` in
    // `runtime/governance/proposal-store.ts`), so it must be in the derived set
    // the moment it becomes a tracked source: that is what makes C2's
    // derived-but-unregistered check cover the new lane at all. If this ever
    // goes red while the lane still appends, the guard stopped seeing a writer.
    expect(DERIVED.values.has('governance-proposal-recorded')).toBe(true)
    // Table-mediated writers must be collected too (activity + requirements).
    expect(DERIVED.values.has('activity-progress-recorded')).toBe(true)
    expect(DERIVED.values.has('activity-interval-opened')).toBe(true)
    expect(DERIVED.values.has('optional-requirement-accepted')).toBe(true)
    // Alpha.6 PR-I1a's governed ReviewAssignment writer mints its fact type only through the closed registry
    // below, so the family is a producer BY DECLARATION for this guard: read the registry out of the source with
    // this file's own machinery (no import, no literal copy — a rename removes the entry and turns this red),
    // then require every member to be derived and registered on both sides. This is what makes the six
    // PINNED_UNRESOLVED entries named above about annotations and ledger pass-throughs rather than about an
    // unpoliced writer: if the family ever stops being derived, C1b's residual widens and C1 names it here.
    const reviewAssignment = REGISTRIES.get('REVIEW_ASSIGNMENT_FACT_TYPES')
    expect(reviewAssignment, 'the review-assignment registry stopped being a closed registry this file can read').toBeDefined()
    expect([...(reviewAssignment ?? [])].sort()).toEqual([
      'review-assignment-created',
      'review-assignment-retired',
      'review-assignment-transferred',
    ])
    for (const factType of reviewAssignment ?? []) {
      const hostKeys = [...HOST.keys()]
      const clientKeys = [...CLIENT.keys()]
      expect(DERIVED.values.has(factType), `derived set is missing ${factType}`).toBe(true)
      expect(hostKeys, `${factType} is not registered in the ledger category map`).toContain(factType)
      expect(clientKeys, `${factType} is missing from the client category mirror`).toContain(factType)
    }
    // A sane floor: an under-collecting derivation is the failure mode.
    // 20 of the 21 registered types are reachable by the derivation (the count
    // includes A4-PR0's proposal fact); the one that is not is named by C1b, so
    // the floor is exact rather than approximate.
    expect(DERIVED.values.size).toBeGreaterThanOrEqual(19)
  })

  it('C1b: the residual — host keys no derived writer produces — stays exactly pinned', () => {
    // Honest coverage statement: exactly one registered type is outside the
    // derivation, and it is named so that drift turns red instead of silent.
    // An earlier version of this comment claimed
    // these types reach the ledger by some path outside both a `factType:` label
    // and the durable-fact funnel: WRONG, and the review caught it —
    // `admission/actions.ts` writes `team-work-admitted` at a labelled site and
    // the action-router writes `team-root-work-delivered` through the very
    // funnel this file harvests. They were missing only because the writer gate
    // was too narrow, which is why the gate now follows all three routes. If that list changes, either the
    // derivation got better (update the pin) or a writer moved silently
    // (investigate). Registered-but-never-derived is not a hazard; the hazard
    // this test exists for is derived-but-unregistered, policed by C2.
    const outside = [...HOST.keys()].filter((key) => !DERIVED.values.has(key)).sort()
    expect(outside.join(',')).toBe('provision-member-instance')
  })

  it('C1c: every closed-registry member resolved to a fact type', () => {
    // The registries name their members through constants
    // (`REQUIREMENT_FACT_TYPES.optionalRequirementAccepted:
    // OPTIONAL_REQUIREMENT_ACCEPTED_FACT_TYPE`). If a member ever references
    // something this file cannot resolve, the derivation would silently
    // under-collect exactly the family the registry exists to close — so an
    // unresolved member is red here, not dropped.
    expect([...UNRESOLVED_REGISTRIES].sort()).toEqual([])
  })

  it('C1d: the harvest convicts the write shapes that left it green in round 1 (plants through the real functions)', () => {
    // Round 1 of #517 planted second writers into a copied tree and reported two shapes that left this guard
    // green: a family name reaching the ledger as a POSITIONAL argument of the durable-fact funnel, and a fact
    // type written as a COMPUTED concatenation. The plants are driven here, through the same three functions
    // the derivation above calls, rather than by dropping files into a copy of the repository: this guard reads
    // `git ls-files`, so a planted file's visibility is a property of the checkout, not of the detector, and a
    // green run in a scratch tree proves nothing either way.
    const PLANTS: Readonly<Record<string, string>> = {
      'funnel-positional.ts': "await commitDurableFact(repos, root, now, 'review-assignment-created', payload)\n",
      'funnel-computed.ts': "await commitDurableFact(repos, root, now, 'sneaky' + '-fact-x', payload)\n",
      'label-double.ts': 'return { factType: "governance-proposal-created", payload: p }\n',
      'label-const-concat.ts': 'return { factType: FACT_PREFIX + FACT_SUFFIX, payload: p }\n',
      // The three shapes round 2 measured escaping this guard, each through a different hole: a label that
      // carries no value (shorthand), a call the harvest could not locate (one space), and an import alias the
      // census never even classified as a writer.
      'label-shorthand.ts':
        "const factType = 'review-assignment-created'\nreturn ledger.put({ factType, payload: p })\n",
      'funnel-spaced.ts': "await commitDurableFact (repos, root, now, 'spaced-funnel-x', payload)\n",
      'funnel-alias.ts':
        "import { commitDurableFact as commit } from '../storage/repositories/facts.js'\n" +
          "await commit(repos, root, now, 'aliased-funnel-x', payload)\n",
      'reader-only.ts':
        "import { isReviewAssignmentFactType } from '../review-assignment/index.js'\nconst rows = ledger.list()\n",
    }
    const plants = new Map(Object.entries(PLANTS))
    const classified = writerSources(Object.keys(PLANTS), plants)
    // Four write shapes are writers, and the file that only reads is not. Written out, because a classification
    // rule nobody can diff against a list is a rule that drifts.
    expect(classified.sort()).toEqual([
      'funnel-alias.ts',
      'funnel-computed.ts',
      'funnel-positional.ts',
      'funnel-spaced.ts',
      'label-const-concat.ts',
      'label-double.ts',
      'label-shorthand.ts',
    ])
    const derived = deriveWrittenFactTypes(classified, plants, CONSTS, REGISTRIES)
    harvestFunnelSites(classified, plants, CONSTS, derived.values, derived.unresolved)
    // The positional funnel argument is derived (this half already worked; it is pinned so it cannot regress),
    expect(derived.values.has('review-assignment-created')).toBe(true)
    // the concatenation is a VALUE rather than a shrug, which is the fix, and
    expect(derived.values.has('sneaky-fact-x')).toBe(true)
    // a double-quoted label is the same fact type as a single-quoted one.
    expect(derived.values.has('governance-proposal-created')).toBe(true)
    // Because the computed value is a value, the closed set can judge it: 'sneaky-fact-x' has no host category,
    // so C2 above is the leg that would convict it in the real tree. Before this fix it never reached C2.
    expect(HOST.has('sneaky-fact-x')).toBe(false)
    // And what genuinely cannot be resolved is NAMED rather than dropped: a concatenation of two constants has
    // no static value here, and the site shows up in the set C5 pins.
    expect([...derived.unresolved].some((site) => site.includes('label-const-concat.ts::'))).toBe(true)

    // Round 2's three escapes, each pinned at the hole it fell through. The spaced call is now a site like any
    // other, so its fact type is DERIVED — the space was never a barrier to the language, only to an `indexOf`.
    expect(derived.values.has('spaced-funnel-x')).toBe(true)
    // The shorthand label and the aliased import cannot be derived from, and that is exactly why they must not
    // pass silently: each shows up as a named site for a human to resolve. `aliased-funnel-x` is NOT in `values`
    // by design — inventing a derivation for a call the harvest cannot see would be the same lie in the other
    // direction.
    expect([...derived.unresolved].some((site) => site.includes('label-shorthand.ts::shorthand-factType'))).toBe(true)
    expect(
      [...derived.unresolved].some((site) => site.includes('funnel-alias.ts::durable-fact-funnel-imported-by-alias')),
    ).toBe(true)
    expect(derived.values.has('aliased-funnel-x')).toBe(false)
    // And a file that only reads stays out of the census entirely, so "wider" has not become "useless".
    expect(classified).not.toContain('reader-only.ts')
  })

  it('C2: every derived fact type has a host category (the defect this PR fixes)', () => {
    const missing = [...DERIVED.values].filter((value) => !HOST.has(value)).sort()
    expect(missing.join(', ')).toBe('')
  })

  it('C3: the host map is mirrored on the client (the ledger summary must classify identically)', () => {
    const missing = [...HOST.keys()].filter((value) => !CLIENT.has(value)).sort()
    expect(missing.join(', ')).toBe('')
    // A4-PR3, plan Task 3 "Test update": POSITIVE CONTAINMENT for
    // `control-escalation-recorded` (A4-4/A5-16). C1 is a floor plus a `.has()`
    // list that never named the escalation row, and C2/C3 compare KEY SETS — so
    // this guard is green whether or not the row is registered, which is precisely
    // why containment is asserted positively here: the writer of a fact type owns
    // BOTH maps in the same commit (X8-R1), and a missing mirror files the row in
    // the wrong Events category with nothing red (A5-6 / X8-R3).
    expect(HOST.has('control-escalation-recorded')).toBe(true)
    expect(CLIENT.has('control-escalation-recorded')).toBe(true)
  })

  it('C4: the eight frozen categories are exactly eight, and nothing maps outside them', () => {
    const used = [...new Set([...HOST.values()])].sort()
    expect(used).toEqual([...FROZEN_CATEGORIES].sort())
    // Abandonment lives in `control`, beside the request/decision rows it
    // closes — not in a new category (ADR A3-7).
    expect(HOST.get('control-request-abandoned')).toBe('control')
    // A4-PR3: the same rule for the escalation leg fact, asserted as a VALUE —
    // key presence would pass a row filed under `policy` or `team` (X8-R3). The
    // client mirror's VALUE is pinned in the client suite
    // (`packages/client/test/ledger-adapter.test.ts`), because C3 above compares
    // key sets only.
    expect(HOST.get('control-escalation-recorded')).toBe('control')
  })

  it('C5: unresolved dynamic writers stay exactly the reviewed set', () => {
    expect([...DERIVED.unresolved].sort()).toEqual([...PINNED_UNRESOLVED].sort())
  })

  it('C6: the guard is non-vacuous — removing the abandonment entry is caught', () => {
    // In-process mutation: delete the entry PR0a added and require the C2
    // check to report it. A guard that cannot fail is not a guard.
    const mutated = new Map(HOST)
    mutated.delete('control-request-abandoned')
    const caught = [...DERIVED.values].filter((value) => !mutated.has(value))
    expect(caught).toContain('control-request-abandoned')
    // And the reverse control: the unmutated map reports nothing.
    expect([...DERIVED.values].filter((value) => !HOST.has(value))).toEqual([])
  })

  it('C7: the writer surface the guard polices is non-trivial', () => {
    // If ledger appends ever move behind a single funnel, this list shrinks in
    // review and the guard narrows deliberately — never silently.
    expect(WRITERS.length).toBeGreaterThanOrEqual(6)
    expect(WRITERS).toContain('packages/runtime/control/service.ts')
  })
})
