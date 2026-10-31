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
 * THE LAW THE REVIEW ROUNDS BOILED OUT OF IT (issue #517, rounds 1-3). A check
 * that is satisfiable by something other than the thing it names is not a check,
 * and an unresolvable write is NAMED, never dropped. Three consequences run
 * through this file: every write shape and harvest mechanism is driven by a
 * plant through the same functions the census runs (C1d), with plants and
 * mechanisms pinned by two-directional set equality so neither side can be
 * shortened alone; every `factType` label and every funnel mention inside a
 * writer file is accounted for as a derived value or a named site (the
 * `labelMentions` / `identifierMentions` census), so a spelling no pattern
 * recognises costs a review line instead of a hole; and a writer the census
 * looks at and says nothing about is an enumerated, dated pass-through (C8),
 * never an absence.
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

/**
 * Recognition fragments, shared by the CLASSIFIER and by both HARVESTS.
 *
 * Shared deliberately. Round 2 of #517 (F-R2-5) caught the two halves disagreeing about what a call
 * looks like — the classifier matched `commitDurableFact (…)` and the harvest did not — and a guard
 * whose two halves disagree reports its own hole as a clean sweep. Round 3 (F-R3-5) found the same
 * disagreement on the label side, in three spellings that left a classified writer COMPLETELY
 * SILENT: `{ ['factType']: 'x' }`, `{ factType /* t *\/: 'x' }`, and a funnel call reached through
 * the comma operator, `(0, commitDurableFact)(…)`. Quote style, brackets and comments are
 * formatting choices, not properties of the value — the same argument that made the quote handling
 * accept a double-quoted fact type in round 1.
 *
 * `\x60` is the backtick written as an escape so it can sit in a character class: this file has to
 * be able to name every spelling of a write without becoming one, and a live backtick here would
 * close a template literal three lines from where it opened.
 */
const QUOTE = String.raw`['"\x60]`
/** A block comment, or a whole line comment, with the whitespace that follows it. */
const TRAILING_COMMENT = String.raw`(?:(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)\s*)?`
/**
 * `factType` in any property-label spelling TypeScript accepts: `factType:`, `'factType':`,
 * `['factType']:`, `` [`factType`]: ``, `factType /* t *\/:`, and any of those with the colon moved
 * to the next line. The label is the thing that makes a write a FACT-TYPE write, so reading it is
 * not optional and neither is reading it in the spelling the author happened to choose.
 */
const FACT_TYPE_LABEL =
  `${String.raw`(?:\[\s*)?`}${QUOTE}${String.raw`?\s*factType\s*`}${QUOTE}${String.raw`?\s*`}` +
  `${TRAILING_COMMENT}${String.raw`(?:\]\s*)?`}${TRAILING_COMMENT}${String.raw`\s*:`}`
/** The value text after the colon — group 1 of the harvest, the thing the closed set judges. */
const FACT_TYPE_VALUE = String.raw`\s*([^\n,}]+)`
const FACT_TYPE_SITE = new RegExp(`${FACT_TYPE_LABEL}${FACT_TYPE_VALUE}`, 'g')
const FACT_TYPE_WRITES_A_VALUE = new RegExp(`${FACT_TYPE_LABEL}${String.raw`\s*${QUOTE}`}`)
const FACT_TYPE_WRITES_A_COMPUTATION = new RegExp(
  `${FACT_TYPE_LABEL}${String.raw`\s*[A-Za-z_$][\w$.]*\s*[+?|]`}`,
)
/** `put({ factType, payload })` — a label carrying no value at all. */
const SHORTHAND_LABEL_SITE = 'shorthand-factType'
const SHORTHAND_LABEL_SOURCE = '[{,]\\s*factType\\s*[,}]'
const SHORTHAND_LABEL = new RegExp(SHORTHAND_LABEL_SOURCE)
const SHORTHAND_LABEL_SITES = new RegExp(SHORTHAND_LABEL_SOURCE, 'g')
/** A label the census can see and the harvest still cannot read. See `labelMentions` below. */
const UNREAD_LABEL_SITE = 'factType-label-the-harvest-cannot-read'
/** The funnel imported under another name, so the call harvest is reading the wrong identifier. */
const FUNNEL_ALIAS_SITE = 'durable-fact-funnel-imported-by-alias'
/** The funnel named in a writer file from a position that is not a call — `.bind`, `.then(f)`, a
 *  held reference. Whatever it is, it reaches the ledger and this harvest cannot follow it. */
const FUNNEL_UNFOLLOWED_SITE = 'durable-fact-funnel-mention-without-a-call-site'

/**
 * A call to `fun`: `fun(…)`, `fun (…)`, `(fun)(…)`, `(0, fun)(…)` and `((0, fun))(…)`.
 *
 * The comma-operator forms are not a curiosity. `(0, fun)(…)` is how emitted and defensive code
 * reaches a function — `(0, commitDurableFact)(repos, root, now, 'sneaky-decoy-x', payload)` — and
 * TypeScript reads it as exactly the same call. Round 3 of #517 measured it leaving this guard
 * silent (F-R3-5): the identifier was there, the four arguments were there, and the needle stopped
 * at the `)` that closes the wrapping expression, so the file contributed neither a derived value
 * nor a named site while a readable decoy write in the same file kept the census quiet.
 */
function callSource(fun: string): string {
  return `\\b${fun}\\b\\s*(?:\\)\\s*)*\\(`
}

/**
 * Text that is not code, blanked to equal-length spaces so every remaining offset still points at
 * the same byte of the original file. The coverage census below compares OFFSETS, so a blank that
 * re-indexes the text would let a write hide behind a shifted match.
 *
 * Comments are blanked because prose about a write is not a write — `activity/ledger.ts` has
 * `` `ledger.put(...)` `` in a doc comment, and `host.ts` discusses the funnel in a `//` line.
 * Import and export specifier lists are blanked because NAMING the funnel is not CALLING it; the
 * alias rule above speaks for that case on its own terms, and double-counting the same line would
 * report an import statement as an unfollowed write. The three patterns are tight (`[^}]*` inside a
 * specifier list, `[^;{}]*` outside one) so a blank can never swallow a function body: a blank that
 * over-reaches would hide a write, which is the one direction this file must never move in.
 */
function blankNonCode(src: string): string {
  const space = (m: string): string => ' '.repeat(m.length)
  return src
    .replace(/\/\*[\s\S]*?\*\//g, space)
    .replace(/^[ \t]*\/\/[^\n]*$/gm, space)
    .replace(/\b(?:import|export)\b\s+type\s+(?:\{[^}]*\}|['"][^'"]*['"])/g, space)
    .replace(/\b(?:import|export)\b\s*(?:type\s+)?\{[^}]*\}(\s+from\s*['"][^'"]*['"])?/g, space)
    .replace(/\b(?:import|export)\b[^;{}]*?\bfrom\s*['"][^'"]*['"]/g, space)
}

/** Offsets at which `identifier` appears in already-blanked `code`, skipping its declarations. */
function identifierMentions(code: string, identifier: string): number[] {
  const out: number[] = []
  const re = new RegExp(`\\b${identifier}\\b`, 'g')
  for (;;) {
    const hit = re.exec(code)
    if (hit === null) return out
    const before = code.slice(Math.max(0, hit.index - 40), hit.index)
    if (!/(?:function|const|let|interface|type|declare)\s*$/.test(before)) out.push(hit.index)
    re.lastIndex = hit.index + 1
  }
}

/** Offsets of every `factType` written in a property-name position — the census of label sites the
 *  harvest is OBLIGED to account for, whether or not it can read what follows the colon. A label
 *  the harvest cannot read is named, never dropped: the same law the shorthand and the alias
 *  already obey, extended to spellings nobody has thought of yet. Round 3 of #517 found the guard
 *  dropping unrecognised label spellings in silence (F-R3-5); this census is what makes "I did not
 *  recognise it" cost something. */
function labelMentions(code: string): number[] {
  const out: number[] = []
  for (const m of code.matchAll(/(?:[{,[]\s*)['"\x60]?\s*factType\b/g)) {
    out.push(m.index + m[0].lastIndexOf('factType'))
  }
  return out
}

/**
 * The shapes that make a file a writer, keyed by NAME.
 *
 * The key is load-bearing, not documentation: C1d's plants cite the shape they drive and the
 * pass-through ledger cites the shape that classified each file, so a shape cannot be dropped while
 * something still names it. Round 3 of #517 (INFO-2) measured that the shorthand half of this guard
 * could be deleted whole — detector, pins and the plant's own assertion together — and nothing
 * convicted it, because a nameless array of regexes can be shortened one element at a time with
 * nothing to diff against.
 */
const WRITE_SHAPES: Readonly<Record<string, RegExp>> = {
  'direct-append': /\bputEntry\s*\(|\bledger\.put\s*\(|\.put\(\s*entry\b|appendLedger/,
  'funnel-call': new RegExp(callSource('commitDurableFact')),
  // Importing the durable-fact funnel reaches the ledger through it even when the importer renames it on the
  // way in. Round 2 of #517 planted `import { commitDurableFact as commit }` and this census did not merely
  // fail to judge the file — it never classified it as a writer at all, so no other rule looked at it either
  // (F-R2-5). The call-site harvest cannot follow an alias, so the file is pulled in and forced to speak.
  'funnel-import': /\bimport\b[^;\n]*\bcommitDurableFact\b/,
  // Any quoted label, not only a single-quoted one, and any computed label expression: a writer that spells
  // its fact type with double quotes or builds it from a concatenation is still writing a fact type, and
  // gating the CLASSIFICATION on one quote style made the whole guard blind to such a file at once (round 1
  // of #517, F2). Measured on this tree: the widening adds no new file today.
  'label-quoted-write': FACT_TYPE_WRITES_A_VALUE,
  'label-computed-write': FACT_TYPE_WRITES_A_COMPUTATION,
}

/** A named shape, looked up so a typo is a crash and not a silently missing check. */
function writeShape(name: string): RegExp {
  const shape = WRITE_SHAPES[name]
  if (shape === undefined) throw new Error(`no writer shape named '${name}' — the table drifted`)
  return shape
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
 *  ledger. The shapes are the named table above (`WRITE_SHAPES`), because the review of the first version of
 *  this guard found the narrow version blind to two of them — gating only on a
 *  direct `putEntry` / `ledger.put` call skipped `action-router/work-execution.ts`
 *  and `root-initial-work.ts` (which append through the positional
 *  `commitDurableFact` funnel from another directory) and
 *  `admission/actions.ts` (which writes a labelled literal with no direct
 *  append call at all). Those were precisely the files holding the residual, so
 *  the gate now follows every route to the ledger:
 *    1. a direct ledger append,
 *    2. a call into the durable-fact funnel, or an import of it,
 *    3. a labelled `factType` write site, in any spelling that carries a value.
 *  Reader / type / validation noise still falls out mechanically: client,
 *  remote and the storage schema layer match none of them. */
function writerSources(files: readonly string[], sources: Map<string, string>): string[] {
  const shapes = Object.values(WRITE_SHAPES)
  return files.filter((f) => {
    const src = sources.get(f) ?? ''
    return shapes.some((shape) => shape.test(src))
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

/** A located call: the offset of the callee's identifier, and the text of its arguments. */
type CallSite = {
  readonly start: number
  readonly inner: string
}

/**
 * Every call to `fun` in `src`, balanced-scan based, with the offset of the callee.
 *
 * The call site is located with `callSource(fun)` rather than an `indexOf` of the literal `FUN(`.
 * `commitDurableFact (repos, …)` — one space — is the same call to TypeScript, and the literal needle meant the
 * funnel harvest never ran for it, so the fact type travelling in its fourth argument was neither derived nor
 * forced to be named (round 2 of #517, F-R2-5). The CLASSIFIER above already matched with the space; a guard
 * whose two halves disagree about what a call looks like reports its own hole as a clean sweep. Round 3 widened
 * the same needle to the parenthesised forms `(fun)(…)` and `(0, fun)(…)` — see `callSource` — and returns the
 * OFFSET as well, because the coverage census needs to know which mentions of the funnel became calls.
 */
function callSites(src: string, fun: string): CallSite[] {
  const out: CallSite[] = []
  const call = new RegExp(callSource(fun), 'g')
  for (;;) {
    const hit = call.exec(src)
    if (hit === null) return out
    const start = hit.index
    // A declaration (`function FUN(` / `const FUN = (`) is not a write.
    if (/(?:function|const|let)\s*$/.test(src.slice(Math.max(0, start - 20), start))) continue
    // One deep already: `hit[0]` consumed the opening parenthesis, so the region being scanned is inside
    // exactly one open bracket and ends when the count returns to zero. Starting at zero closed the scan on
    // the FIRST nested call instead \u2014 `commitDurableFact(repos, pick(p), now, 'x', payload)` was read as
    // `repos, pick(p`, which lost the fourth argument and turned a derivable fact type into a name with
    // nothing in it. Measured on this tree: five writer files hit the truncation (nested calls in the payload
    // position), and arg4 was identical either way, so the fix moves nothing today; it moves the next writer.
    let depth = 1
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
    out.push({ start, inner: src.slice(start + hit[0].length, i) })
    // Resume after the balanced argument region, as the literal-needle scan did: a nested call inside an
    // argument is part of this site, not a second site.
    call.lastIndex = i + 1
  }
}

/** The durable-fact funnel writes its fact type as the FOURTH positional
 *  argument (`commitDurableFact(repos, root, now, factType, payload)`), so a
 *  `factType:`-keyed scan never sees that family at all
 *  (`member-lifecycle-changed`, `team-root-work-delivered`, …).
 *
 *  Two rules below fire PER FILE rather than per site, and neither of them waits for the file to be
 *  otherwise empty. Round 3 of #517 (F-R3-5) found both of them gated on `sites.length === 0`, which meant
 *  one readable decoy write was enough to silence the rule that should have spoken about the unreadable
 *  write next to it: masking a write became as easy as writing two. */
function harvestFunnelSites(
  writers: readonly string[],
  sources: ReadonlyMap<string, string>,
  consts: ReadonlyMap<string, string>,
  values: Set<string>,
  unresolved: Set<string>,
): void {
  for (const file of writers) {
    const src = sources.get(file) ?? ''
    const sites = callSites(src, 'commitDurableFact')
    // The funnel arrives under another name, so this harvest is looking at the wrong identifier. Two ways that
    // is true, and the second is the one round 2 could not see:
    //  - the file imports the funnel and has no readable call site at all (the round-2 plant);
    //  - the file imports the funnel UNDER ANOTHER NAME (`import { commitDurableFact as commit }`) and has a
    //    readable site too — the readable one is a decoy, and the aliased call beside it is invisible to
    //    `callSites` exactly as before. Firing only in the first case is what let `masked-alias-x` through.
    // Unresolvable is not the same as absent: the file must name what it writes, exactly as a concatenation does.
    if (writeShape('funnel-import').test(src)) {
      const aliased = /[{,]\s*commitDurableFact\s+as\s+/.test(src)
      if (aliased || sites.length === 0) unresolved.add(`${file}::${FUNNEL_ALIAS_SITE}`)
    }
    // Coverage census. Every mention of the funnel that is not a declaration, not an import specifier and not
    // inside a comment must have become a call site here; anything else reaches the ledger by a route this
    // harvest cannot follow (`const held = (0, commitDurableFact)` + `held(…)`, `.then(commitDurableFact)`,
    // `funnel.bind(null, repos)`) and is NAMED. Deliberately over-naming: the failure mode this file exists to
    // prevent is a write that is quietly invisible, and a spurious name costs one line of C5 review.
    const starts = new Set(sites.map((site) => site.start))
    for (const at of identifierMentions(blankNonCode(src), 'commitDurableFact')) {
      if (!starts.has(at)) unresolved.add(`${file}::${FUNNEL_UNFOLLOWED_SITE}`)
    }
    for (const site of sites) {
      const args = topLevelArgs(site.inner)
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
    // Offsets of the label sites this file's harvest actually read. The census at the bottom of the loop
    // compares them against every label site in the file, which is what turns "the harvest did not recognise
    // this spelling" from silence into a named review item.
    const read = new Set<number>()
    for (const m of src.matchAll(FACT_TYPE_SITE)) {
      const at = src.indexOf('factType', m.index)
      if (at >= 0) read.add(at)
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
      // expression. It cannot be derived statically, so it must be named here — and it is named with its
      // text, which is also what the census would have done had the label itself been unreadable.
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
    //
    // THE CREDIT IS EARNED BY THE NAME. A shorthand label is a `factType` mention, so the census below would
    // call it an unread label unless something marks it as accounted for; what marks it is the NAME on the
    // line above, not the pattern that produced it. Delete that line and the mention is no longer excused — it
    // resurfaces as `UNREAD_LABEL_SITE`, C5 goes red on a name mismatch, and every real file with a shorthand
    // label stays named either way. Round 3 of #517 (INFO-2) measured that a mechanism could be deleted
    // together with its own pins and its plant assertion and leave this file green; that path now costs a
    // different kind of red instead of a quiet one.
    if (SHORTHAND_LABEL.test(src)) unresolved.add(`${file}::${SHORTHAND_LABEL_SITE}`)
    if (unresolved.has(`${file}::${SHORTHAND_LABEL_SITE}`)) {
      for (const m of src.matchAll(SHORTHAND_LABEL_SITES)) {
        const at = src.indexOf('factType', m.index)
        if (at >= 0) read.add(at)
      }
    }
    // Coverage census, label half: every `factType` written in a property-name position must have been read
    // above — as a value, as a dynamic value, or as a shorthand label — or be named here. This is the rule
    // that makes the recognition patterns above *extensible* rather than load-bearing: a future spelling that
    // `FACT_TYPE_LABEL` does not cover costs a review line instead of a silent hole, exactly the trade the
    // shorthand and alias rules already make.
    //
    // Why there is no matching census on the `.put(` / `ledger.put` side, which the finding also invited: the
    // append call sites in this tree are held by the four files in `LEDGER_PASS_THROUGHS` below, none of
    // which names a fact type at all (each takes the entry as a parameter, and three of the four contain zero
    // occurrences of the text `factType`). Counting append SITES against harvested labels would therefore
    // name exactly those four files — replacing four entries that say WHY each file cannot mint a type with
    // four entries that say a call was not read. The file-granular law (C8: contribute, or be listed with a
    // reason) says more, so the per-site count is not run.
    for (const at of labelMentions(blankNonCode(src))) {
      if (!read.has(at)) unresolved.add(`${file}::${UNREAD_LABEL_SITE}`)
    }
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

/**
 * The writer files this census CLASSIFIES and can judge NOTHING about: classified by a write shape,
 * contributing neither a derived value nor a named site. Round 3 of #517 (F-R3-5) found four of them out
 * of eighteen, listed nowhere, and named by nothing — a writer the guard looks at and says nothing about
 * is indistinguishable from a writer the guard cannot see, which is the exact shape of the bug this file
 * exists to catch. Silence is allowed to exist and is not allowed to be implicit: C8 requires this list to
 * equal the silent set, so the fifth file that joins it is a red test and a decision.
 *
 * Each entry states the shape that classified it (`via`, checked against `WRITE_SHAPES` by C8) and the
 * reason it cannot mint a fact type, and C8 checks the reason mechanically: none of these files contains
 * the text `factType` or the text `commitDurableFact` at all, so no spelling this guard can ever read
 * would find a write in them. All four measurements are from 2026-10-31.
 */
const LEDGER_PASS_THROUGHS: Readonly<Record<string, { readonly via: string; readonly reason: string }>> = {
  'packages/runtime/activity/ledger.ts': {
    via: 'direct-append',
    reason:
      'appends the activity row at :368 (`await args.repositories.ledger.put(entry)`; the other match, :30, is a doc ' +
      'comment). The entry comes from `buildActivityEntry` in `activity/facts.ts`, whose ' +
      '`factType: OP_TO_FACT_TYPE[input.op]` is at facts.ts:187 — a file this census DOES judge, over a closed ' +
      'registry unioned into the derived set by `registryFactTypes` and pinned in C1. The ledger module forwards a ' +
      'built entry; it holds no fact type of its own, and contains no `factType` text at all.',
  },
  'packages/runtime/mutation/internal/mutation-service.ts': {
    via: 'direct-append',
    reason:
      'matches on `appendLedger` at :243, :295, :338, :385, the private helper at :504 and its ' +
      '`this.deps.store.appendLedger(\u2026)` at :511. That is the P7 MUTATION PROVENANCE ledger, not the TeamDomain ' +
      'fact ledger: `MutationLedgerEntry` (mutation/types.ts:276) has no `factType` field, and ' +
      '`packages/runtime/mutation` contains zero occurrences of the text `factType` in any file. The name ' +
      'collision with the TeamDomain append is what classifies it.',
  },
  'packages/runtime/mutation/types.ts': {
    via: 'direct-append',
    reason:
      'the port DECLARATION `appendLedger(teamSessionId, entry: MutationLedgerEntry): void` at :400 — a signature ' +
      'for the same provenance ledger as the entry above, in the same package, over the same entry type with no ' +
      '`factType` field. A declaration is not a write; the classifier cannot tell them apart by design, so the ' +
      'file is listed rather than special-cased.',
  },
  'packages/storage/repositories/ledger.ts': {
    via: 'direct-append',
    reason:
      'the ledger repository itself: `putEntry(entry, \u2026)` at :140 and :163, whose private body at :167 takes ' +
      '`entry: unknown`. This is the sink every writer above eventually reaches; the fact type arrives inside a ' +
      'caller-built object, is validated by SHAPE and not by membership (`packages/storage/schema/ledger.ts`, as ' +
      'this file\u2019s own header says), and is never minted here. Naming a type here would mean the caller named it.',
  },
}

/**
 * Does this classified writer contribute anything the census can judge \u2014 a derived value, or a name for a
 * site it cannot resolve? Run through the SAME functions the census runs, on a one-file slice: a file that
 * contributes nothing to its own slice contributes nothing to the census either, and this is the question
 * C8 asks of every writer.
 */
function contributes(file: string, sources: ReadonlyMap<string, string>): boolean {
  const slice = new Map([[file, sources.get(file) ?? '']])
  const own = deriveWrittenFactTypes([file], slice, CONSTS, REGISTRIES)
  harvestFunnelSites([file], slice, CONSTS, own.values, own.unresolved)
  return own.values.size > 0 || own.unresolved.size > 0
}

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

  it('C1d: the harvest convicts the write shapes that left it green (plants through the real functions)', () => {
    // Round 1 of #517 planted second writers into a copied tree and reported two shapes that left this guard
    // green: a family name reaching the ledger as a POSITIONAL argument of the durable-fact funnel, and a fact
    // type written as a COMPUTED concatenation. The plants are driven here, through the same three functions
    // the derivation above calls, rather than by dropping files into a copy of the repository: this guard reads
    // `git ls-files`, so a planted file's visibility is a property of the checkout, not of the detector, and a
    // green run in a scratch tree proves nothing either way.
    //
    // Every alternative below is NAMED, and every plant cites the alternatives it drives. Round 3 of #517
    // (INFO-2) measured that a mechanism could be deleted together with its pins and its own plant assertion
    // and leave the spec green; naming both sides means the deletion has to reach four places (the mechanism,
    // its entry in this table, the plant, and the C5 pins) before it is quiet, and the two directions are
    // pinned by equality rather than by prose. The `shape:` half is DERIVED from `WRITE_SHAPES` itself, so a
    // classifier arm cannot be dropped while a plant still names it. What remains deletable is the table plus
    // the plants plus the mechanism together — a test cannot convict the deletion of its own subject, and this
    // file says so rather than pretending otherwise.
    const ALTERNATIVES: Readonly<Record<string, string>> = {
      ...Object.fromEntries(
        Object.keys(WRITE_SHAPES).map((name) => [
          `shape:${name}`,
          `the classifier still treats the ${name} shape as a writer`,
        ]),
      ),
      'negative:reader-only': 'a file that only reads the ledger stays out, so "wider" has not become "useless"',
      'harvest:funnel-positional': "the fact type is the funnel's fourth positional argument",
      'harvest:funnel-literal-concat': "an 'a' + 'b' funnel argument resolves to the value it is",
      'harvest:funnel-constant-argument': 'a constant in the fourth position resolves through the constant table',
      'harvest:funnel-dynamic-argument': 'a fourth argument that is neither is named with its own text',
      'harvest:funnel-spaced-call': 'a space between the callee and its parentheses is still a call',
      'harvest:funnel-nested-argument': 'a nested call in an early argument does not end the argument list',
      'harvest:funnel-comma-operator': '(0, fun)(...) is the same call as fun(...) — round 3 of #517, F-R3-5',
      'harvest:funnel-import-alias': 'the funnel under another name is named, decoy sites or no decoy sites',
      'harvest:funnel-unfollowed-mention': 'a funnel mention that never became a call is named',
      'harvest:label-quoted-value': 'a double-quoted value is the same fact type as a single-quoted one',
      'harvest:label-literal-concat': "an 'a' + 'b' label value resolves to the value it is",
      'harvest:label-constant': 'a constant at a label resolves through the constant table',
      'harvest:label-registry-members': "REGISTRY[key] at a label contributes the registry's closed set",
      'harvest:label-unresolvable': 'a label whose value cannot be resolved is named, not dropped',
      'harvest:label-shorthand': 'put({ factType }) carries no value and is named for it',
      'harvest:label-computed-key': "a ['factType'] computed label is a fact-type write — F-R3-5",
      'harvest:label-commented': 'a comment between the label and its colon does not un-write the write',
      // Deliberate over-report, pinned so that tightening it stays a decision rather than a quiet
      // narrowing: a bracket-key read of a fact type is a READ, not a write, and the census names the file
      // for it anyway, because the census is what stops an unknown label spelling from being free.
      'harvest:label-unread': 'a label in a spelling the harvest cannot read is named by the census',
    }
    type Plant = {
      readonly drives: readonly string[]
      /** Fact types the plant writes that the census MUST arrive at. */
      readonly derives: readonly string[]
      /** Site names this plant must appear under in the unresolved set. */
      readonly names: readonly string[]
      /** Fact types the plant contains that must NOT be derived: inventing a value the harvest cannot
       *  see would be the same lie in the other direction. */
      readonly unreadable: readonly string[]
      readonly text: string
    }
    const PLANTS: Readonly<Record<string, Plant>> = {
      'funnel-positional.ts': {
        drives: ['shape:funnel-call', 'harvest:funnel-positional'],
        derives: ['review-assignment-created'],
        names: [],
        unreadable: [],
        text: "await commitDurableFact(repos, root, now, 'review-assignment-created', payload)\n",
      },
      'funnel-computed.ts': {
        drives: ['harvest:funnel-literal-concat'],
        derives: ['sneaky-fact-x'],
        names: [],
        unreadable: [],
        text: "await commitDurableFact(repos, root, now, 'sneaky' + '-fact-x', payload)\n",
      },
      'funnel-const.ts': {
        drives: ['harvest:funnel-constant-argument'],
        derives: ['governance-proposal-recorded'],
        names: [],
        unreadable: [],
        text: "await commitDurableFact(repos, root, now, GOVERNANCE_PROPOSAL_FACT_TYPE, payload)\n",
      },
      'funnel-dynamic.ts': {
        drives: ['harvest:funnel-dynamic-argument'],
        derives: [],
        names: ["commitDurableFact arg4 pick('dynamic-funnel-x')"],
        unreadable: ['dynamic-funnel-x'],
        text: "await commitDurableFact(repos, root, now, pick('dynamic-funnel-x'), payload)\n",
      },
      // A nested call in an EARLY argument. The balanced scan used to close on the nested call's own
      // parenthesis, so the fourth argument fell outside the region it read.
      'funnel-nested-argument.ts': {
        drives: ['harvest:funnel-nested-argument'],
        derives: ['nested-arg-x'],
        names: [],
        unreadable: [],
        text: "await commitDurableFact(repos, pick(p), now, 'nested-arg-x', payload)\n",
      },
      'funnel-spaced.ts': {
        drives: ['harvest:funnel-spaced-call'],
        derives: ['spaced-funnel-x'],
        names: [],
        unreadable: [],
        text: "await commitDurableFact (repos, root, now, 'spaced-funnel-x', payload)\n",
      },
      // Round 3 of #517, F-R3-5: the comma operator. `(0, fun)(...)` reaches the same function, and the
      // harvest used to stop at the `)` that closes the wrapping expression.
      'funnel-comma-operator.ts': {
        drives: ['harvest:funnel-comma-operator'],
        derives: ['comma-op-funnel-x'],
        names: [],
        unreadable: [],
        text: "await (0, commitDurableFact)(repos, root, now, 'comma-op-funnel-x', payload)\n",
      },
      // The same call with a readable decoy beside it, which is what made F-R3-5 MINOR rather than cosmetic:
      // every fallback that should have spoken about the unreadable write was gated on the file having NO
      // readable write at all. One decoy was enough to silence the whole census.
      'mask-funnel-comma-operator.ts': {
        drives: ['harvest:funnel-comma-operator', 'shape:direct-append'],
        derives: ['team-work-admitted', 'sneaky-decoy-x'],
        names: [],
        unreadable: [],
        text:
          "return ledger.put({ factType: 'team-work-admitted', payload: p })\n" +
          "(0, commitDurableFact)(repos, root, now, 'sneaky-decoy-x', payload)\n",
      },
      // A mention of the funnel that never becomes a call: `.bind` holds it, `held(...)` writes with it.
      // Nothing here can be derived, so the file must be NAMED even though a perfectly readable write sits
      // on the line above.
      'funnel-unfollowed.ts': {
        drives: ['harvest:funnel-unfollowed-mention'],
        derives: ['team-work-admitted'],
        names: [FUNNEL_UNFOLLOWED_SITE],
        unreadable: ['held-funnel-x'],
        text:
          "return ledger.put({ factType: 'team-work-admitted', payload: p })\n" +
          "const held = commitDurableFact.bind(null, repos)\n" +
          "await held(repos, root, now, 'held-funnel-x', payload)\n",
      },
      'funnel-alias.ts': {
        drives: ['shape:funnel-import', 'harvest:funnel-import-alias'],
        derives: [],
        names: [FUNNEL_ALIAS_SITE],
        unreadable: ['aliased-funnel-x'],
        text:
          "import { commitDurableFact as commit } from '../storage/repositories/facts.js'\n" +
          "await commit(repos, root, now, 'aliased-funnel-x', payload)\n",
      },
      // The alias with a readable decoy too — the same masking as above, one mechanism over.
      'funnel-alias-masked.ts': {
        drives: ['harvest:funnel-import-alias'],
        derives: ['team-work-admitted'],
        names: [FUNNEL_ALIAS_SITE],
        unreadable: ['masked-alias-x'],
        text:
          "import { commitDurableFact as commit } from '../storage/repositories/facts.js'\n" +
          "await commitDurableFact(repos, root, now, 'team-work-admitted', payload)\n" +
          "await commit(repos, root, now, 'masked-alias-x', payload)\n",
      },
      'label-double.ts': {
        drives: ['shape:label-quoted-write', 'harvest:label-quoted-value'],
        derives: ['governance-proposal-created'],
        names: [],
        unreadable: [],
        text: 'return { factType: "governance-proposal-created", payload: p }\n',
      },
      'label-concat.ts': {
        drives: ['harvest:label-literal-concat'],
        derives: ['sneaky-label-x'],
        names: [],
        unreadable: [],
        text: "return ledger.put({ factType: 'sneaky' + '-label-x', payload: p })\n",
      },
      'label-const.ts': {
        drives: ['harvest:label-constant'],
        derives: ['governance-proposal-recorded'],
        names: [],
        unreadable: [],
        text: 'return ledger.put({ factType: GOVERNANCE_PROPOSAL_FACT_TYPE, payload: p })\n',
      },
      'label-registry.ts': {
        drives: ['harvest:label-registry-members'],
        derives: ['review-assignment-created', 'review-assignment-retired', 'review-assignment-transferred'],
        names: [],
        unreadable: [],
        text: 'return ledger.put({ factType: REVIEW_ASSIGNMENT_FACT_TYPES[command.kind], payload: p })\n',
      },
      'label-const-concat.ts': {
        drives: ['shape:label-computed-write', 'harvest:label-unresolvable'],
        derives: [],
        names: ['FACT_PREFIX + FACT_SUFFIX'],
        unreadable: [],
        text: 'return { factType: FACT_PREFIX + FACT_SUFFIX, payload: p }\n',
      },
      'label-shorthand.ts': {
        drives: ['harvest:label-shorthand'],
        derives: [],
        names: [SHORTHAND_LABEL_SITE],
        unreadable: [],
        text:
          "const factType = 'review-assignment-created'\nreturn ledger.put({ factType, payload: p })\n",
      },
      // Round 3 of #517, F-R3-5, the other two spellings: a computed label, and a comment between the
      // label and its colon. Both were classified as writers and contributed NEITHER a value NOR a name.
      'label-computed.ts': {
        drives: ['harvest:label-computed-key'],
        derives: ['computed-label-x'],
        names: [],
        unreadable: [],
        text: "return ledger.put({ ['factType']: 'computed-label-x', payload: p })\n",
      },
      'mask-label-computed.ts': {
        drives: ['harvest:label-computed-key'],
        derives: ['team-work-admitted', 'sneaky-label-x'],
        names: [],
        unreadable: [],
        text:
          "return ledger.put({ factType: 'team-work-admitted', payload: p })\n" +
          "return ledger.put({ ['factType']: 'sneaky-label-x', payload: p })\n",
      },
      'label-commented.ts': {
        drives: ['harvest:label-commented'],
        derives: ['commented-label-x'],
        names: [],
        unreadable: [],
        text: "return ledger.put({ factType /* t */: 'commented-label-x', payload: p })\n",
      },
      'mask-label-commented.ts': {
        drives: ['harvest:label-commented'],
        derives: ['team-work-admitted', 'sneaky-cmt-x'],
        names: [],
        unreadable: [],
        text:
          "return ledger.put({ factType: 'team-work-admitted', payload: p })\n" +
          "return ledger.put({ factType /* t */: 'sneaky-cmt-x', payload: p })\n",
      },
      // Stacked comments, which is one block comment to a regex and two to a reader. The plant first written
      // for the census below aimed to be unreadable by the head and the head read it anyway, so it is kept as
      // a recognition plant instead: a fact type behind two comments is still derived, not named.
      'label-stacked-comments.ts': {
        drives: ['harvest:label-commented'],
        derives: ['team-work-admitted', 'unseen-cmt-x'],
        names: [],
        unreadable: [],
        text:
          "return ledger.put({ factType: 'team-work-admitted', payload: p })\n" +
          "return ledger.put({ factType /* a */ /* b */: 'unseen-cmt-x', payload: p })\n",
      },
      // The net under all of them: a `factType` in a position the census can see and the harvest cannot read.
      // A fact type reached through a BRACKET KEY is the reachable case — the key is a variable, so there is
      // nothing beside it to judge. Naming the file for it over-reports (a read is not a write), and that is
      // the accepted direction: this file would rather spend a line of C5 review than miss a write. The rule
      // matters less for this one case than for what it makes the recognition above: EXTENSIBLE. A spelling
      // `FACT_TYPE_LABEL` does not cover costs a review line instead of a silent hole, which is the difference
      // between a guard and a snapshot of today's parser.
      'label-bracket-read.ts': {
        drives: ['harvest:label-unread'],
        derives: ['team-work-admitted'],
        names: [UNREAD_LABEL_SITE],
        unreadable: [],
        text:
          "return ledger.put({ factType: 'team-work-admitted', payload: p })\n" +
          "const current = entry[factType]\n",
      },
      'reader-only.ts': {
        drives: ['negative:reader-only'],
        derives: [],
        names: [],
        unreadable: [],
        text:
          "import { isReviewAssignmentFactType } from '../review-assignment/index.js'\nconst rows = ledger.list()\n",
      },
    }
    const names = Object.keys(PLANTS)
    const texts = new Map(names.map((name) => [name, (PLANTS[name] as Plant).text]))
    const classified = writerSources(names, texts)
    // Every write shape is a writer, and the file that only reads is not. Written out, because a
    // classification rule nobody can diff against a list is a rule that drifts.
    expect(classified.sort()).toEqual(
      names.filter((name) => name !== 'reader-only.ts').sort(),
    )
    // ...and the list above is the plant table minus the reader, so a plant that silently stopped being
    // classified cannot pass by simply being absent from an expectations list that was also hand-written.
    const derived = deriveWrittenFactTypes(classified, texts, CONSTS, REGISTRIES)
    harvestFunnelSites(classified, texts, CONSTS, derived.values, derived.unresolved)

    for (const [name, plant] of names.map((n) => [n, PLANTS[n] as Plant] as const)) {
      // A plant that cites an alternative the guard does not have is a plant that proves nothing.
      for (const drive of plant.drives) {
        expect(ALTERNATIVES, `${name} drives '${drive}', which this guard does not offer`).toHaveProperty(drive)
      }
      if (!classified.includes(name)) continue
      // THE LAW, from round 3 of #517 (F-R3-5): a file the census classifies as a writer must contribute
      // a derived value or a named site. Not "usually", and not "unless a rule happens to be gated on the
      // file being otherwise empty" — a classified writer that contributes neither is invisible, and
      // invisible is the failure this whole file exists to prevent.
      expect(
        plant.derives.length > 0 || plant.names.length > 0,
        `${name} is planted as a writer with no expectation on it: it can only pass by being ignored`,
      ).toBe(true)
      for (const factType of plant.derives) {
        expect(
          derived.values.has(factType),
          `${name} writes ${factType} and the census derived nothing for it (drives: ${plant.drives.join(', ')})`,
        ).toBe(true)
      }
      for (const site of plant.names) {
        expect(derived.unresolved.has(`${name}::${site}`), `${name} is unreadable but was never named (${site})`).toBe(
          true,
        )
      }
      for (const factType of plant.unreadable) {
        expect(derived.values.has(factType), `${name} derived ${factType} from a site it cannot read`).toBe(false)
      }
    }
    // Every alternative is driven by something. A mechanism with no plant is a mechanism nothing can
    // prove, which is how the round-2 review found three of them.
    const driven = [...new Set(names.flatMap((n) => [...(PLANTS[n] as Plant).drives]))].sort()
    expect(driven).toEqual(Object.keys(ALTERNATIVES).sort())

    // Because a computed value is a VALUE rather than a shrug, the closed set can judge it: 'sneaky-fact-x'
    // has no host category, so C2 above is the leg that would convict it in the real tree. Before the round-1
    // fix it never reached C2 at all, and the same is now true of every spelling planted above.
    expect(HOST.has('sneaky-fact-x')).toBe(false)
    expect(HOST.has('sneaky-decoy-x')).toBe(false)
    expect(HOST.has('sneaky-label-x')).toBe(false)
    expect(HOST.has('sneaky-cmt-x')).toBe(false)
    expect(HOST.has('comma-op-funnel-x')).toBe(false)
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

  it('C8: a writer this census looks at and says nothing about is an enumerated pass-through, never a gap', () => {
    // F-R3-5, closed 2026-10-31. The asymmetry the finding named: a file whose ONLY write was unreadable was
    // caught, while the same unreadable write beside one readable one escaped. Half of that is fixed by
    // recognition (C1d's `mask-*` plants), and this leg closes the other half: whatever the reason a writer
    // teaches this guard nothing, that reason is on a list, the list is exactly the silent set, and the entry
    // says why.
    const silent = WRITERS.filter((file) => !contributes(file, SOURCES)).sort()
    expect(silent).toEqual(Object.keys(LEDGER_PASS_THROUGHS).sort())
    for (const [file, entry] of Object.entries(LEDGER_PASS_THROUGHS)) {
      const src = SOURCES.get(file) ?? ''
      // The reason names a shape; the shape still classifies the file. An entry whose `via` stopped being
      // true is a stale entry, not a harmless one — it means the file now reaches the ledger some other way.
      expect(writeShape(entry.via).test(src), `${file} no longer matches the '${entry.via}' shape its entry names`).toBe(true)
      // And the reason is mechanical, not prose: a file that carries no fact-type text and no funnel text
      // cannot write an unregistered fact type through any spelling this guard can ever learn. The day one of
      // them does, the entry is no longer a pass-through and this leg says so.
      expect(src.match(/factType/g), `${file} now mentions factType: it is no longer a pass-through`).toEqual(null)
      expect(src.match(/commitDurableFact/g), `${file} now calls the durable-fact funnel`).toEqual(null)
      expect(entry.reason.length, `${file} is listed without a reason`).toBeGreaterThan(80)
    }
  })
})
