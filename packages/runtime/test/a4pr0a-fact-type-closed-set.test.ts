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
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

function trackedSources(): string[] {
  const out = execFileSync('git', ['ls-files', 'packages'], { encoding: 'utf8' })
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter((f) => f.endsWith('.ts') && !f.endsWith('.d.ts'))
    .filter((f) => !f.includes('/test/') && !f.includes('/dist/'))
}

/** Files that actually append ledger rows. Restricting the derivation to these
 *  removes reader/type/validation noise mechanically instead of by allow-list:
 *  a writer is a file that calls a ledger append, nothing more subtle. */
function writerSources(files: readonly string[], sources: Map<string, string>): string[] {
  return files.filter((f) => {
    const src = sources.get(f) ?? ''
    return /\bputEntry\s*\(|\bledger\.put\s*\(|\.put\(\s*entry\b|appendLedger/.test(src)
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
    for (const m of src.matchAll(constRe)) if (!consts.has(m[1])) consts.set(m[1], m[2])
  }

  const registries = new Map<string, Set<string>>()
  const unresolvedRegistries = new Set<string>()
  const tableRe = /const\s+([A-Z_][A-Z0-9_]*FACT_TYPE[A-Z0-9_]*)[^=\n]*=\s*\{([\s\S]*?)\n\}/g
  for (const src of sources.values()) {
    for (const m of src.matchAll(tableRe)) {
      const values = new Set<string>()
      for (const entry of m[2].matchAll(/:\s*('[a-z0-9-]+'|[A-Z_][A-Z0-9_]*)\s*,?\s*$/gm)) {
        const raw = entry[1]
        if (raw.startsWith("'")) {
          values.add(raw.replace(/'/g, ''))
          continue
        }
        const value = consts.get(raw)
        if (value !== undefined) {
          values.add(value)
          continue
        }
        unresolvedRegistries.add(`${m[1]}.${raw}`)
      }
      if (values.size > 0 && !registries.has(m[1])) registries.set(m[1], values)
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

/** Argument text `inner` of every `FUN(` call in `src`, balanced-scan based. */
function callArgumentTexts(src: string, fun: string): string[] {
  const out: string[] = []
  const needle = `${fun}(`
  let from = 0
  for (;;) {
    const start = src.indexOf(needle, from)
    if (start === -1) return out
    // A declaration (`function FUN(` / `const FUN = (`) is not a write.
    if (/(?:function|const|let)\s*$/.test(src.slice(Math.max(0, start - 20), start))) {
      from = start + needle.length
      continue
    }
    let depth = 0
    let quote: string | null = null
    let i = start + needle.length
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
    out.push(src.slice(start + needle.length, i))
    from = i + 1
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
    for (const inner of callArgumentTexts(src, 'commitDurableFact')) {
      const args = topLevelArgs(inner)
      const raw = args[3] ?? ''
      const literal = raw.match(/^'([a-z0-9-]+)'$/)
      if (literal) {
        values.add(literal[1])
        continue
      }
      const identifier = raw.match(/^([A-Za-z_][A-Za-z0-9_]*)$/)
      if (identifier && consts.has(identifier[1])) {
        values.add(consts.get(identifier[1]) as string)
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
      const raw = m[1].trim()
      const literal = raw.match(/^'([a-z0-9-]+)'$/)
      if (literal) {
        values.add(literal[1])
        continue
      }
      const identifier = raw.match(/^([A-Z_][A-Z0-9_]*)$/)
      if (identifier) {
        const name = identifier[1]
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
      if (registryAccess && registries.has(registryAccess[1])) {
        for (const value of registries.get(registryAccess[1]) as Set<string>) values.add(value)
        continue
      }
      // A dynamic write: the value comes from a variable, a call or a member
      // expression. It cannot be derived statically, so it must be named here.
      unresolved.add(`${file}::${raw.slice(0, 40)}`)
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
  for (const m of block[1].matchAll(/\[\s*('?[A-Za-z_][A-Za-z0-9_.]*'?)\s*,\s*'([a-z]+)'\s*\]/g)) {
    const rawKey = m[1]
    const category = m[2]
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
  for (const m of block[1].matchAll(/'([a-z0-9-]+)'\s*:/g)) keys.add(m[1])
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
  'packages/runtime/control/service.ts::string',
  'packages/runtime/requirements/facts.ts::RequirementFactType',
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
    // Table-mediated writers must be collected too (activity + requirements).
    expect(DERIVED.values.has('activity-progress-recorded')).toBe(true)
    expect(DERIVED.values.has('activity-interval-opened')).toBe(true)
    expect(DERIVED.values.has('optional-requirement-accepted')).toBe(true)
    // A sane floor: an under-collecting derivation is the failure mode.
    expect(DERIVED.values.size).toBeGreaterThanOrEqual(17)
  })

  it('C1b: the residual — host keys no derived writer produces — stays exactly pinned', () => {
    // Honest coverage statement: three registered types are written by paths
    // this file's derivation does not model — they reach the ledger through the
    // storage-side provisioning / root-admission paths rather than a
    // `factType:`-labelled site or the plugin's durable-fact funnel. If that list changes, either the
    // derivation got better (update the pin) or a writer moved silently
    // (investigate). Registered-but-never-derived is not a hazard; the hazard
    // this test exists for is derived-but-unregistered, policed by C2.
    const outside = [...HOST.keys()].filter((key) => !DERIVED.values.has(key)).sort()
    expect(outside.join(',')).toBe(
      'provision-member-instance,team-root-work-delivered,team-work-admitted',
    )
  })

  it('C2: every derived fact type has a host category (the defect this PR fixes)', () => {
    const missing = [...DERIVED.values].filter((value) => !HOST.has(value)).sort()
    expect(missing.join(', ')).toBe('')
  })

  it('C3: the host map is mirrored on the client (the ledger summary must classify identically)', () => {
    const missing = [...HOST.keys()].filter((value) => !CLIENT.has(value)).sort()
    expect(missing.join(', ')).toBe('')
  })

  it('C4: the eight frozen categories are exactly eight, and nothing maps outside them', () => {
    const used = [...new Set([...HOST.values()])].sort()
    expect(used).toEqual([...FROZEN_CATEGORIES].sort())
    // Abandonment lives in `control`, beside the request/decision rows it
    // closes — not in a new category (ADR A3-7).
    expect(HOST.get('control-request-abandoned')).toBe('control')
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
