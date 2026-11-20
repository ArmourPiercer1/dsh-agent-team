#!/usr/bin/env node
/**
 * ute-family-inventory.mjs — the machine-checkable inventory of the LEGACY
 * execution plane, one entry per tool family (UTE-3).
 *
 * WHY THIS FILE EXISTS. UTE-4 may delete a family's old path only after the
 * retirement gate allows it, and the retirement licence is only as honest as the
 * `oldPath.files` list it grades (RETIREMENT.md §5.1: "an undeclared file is a
 * gap to be closed, not a pass"). Before this inventory, that list was written
 * by hand per family and nobody could mechanically answer:
 *
 *   - which files ARE a family's current implementation (as opposed to sharing a
 *     directory name with it);
 *   - which model-visible tool definitions that family contributes and where each
 *     is declared;
 *   - which host/sibling packages those files import;
 *   - how a call actually reaches an effect today;
 *   - where approval / Grant / Stop is enforced for that family;
 *   - what (if anything) already exists on the DSH-native side;
 *   - how ready the family is for retirement, derived from the measured
 *     retirement evidence rather than asserted.
 *
 * WHAT IS INDEPENDENT HERE (the reason this gate cannot grade itself green):
 *
 *   - the FAMILY SET and the MEMBERS come from the reviewed census
 *     `dev/agent-workflow/ledgers/arc-a-family-census.json`; the inventory may
 *     not add, drop, rename or shrink a family (both directions are refused);
 *   - the FILE UNIVERSE is derived from the tree (git ls-files), not from the
 *     ledger: every implementation file under a booked family lane, plus the
 *     family-body directory, must be CLAIMED by exactly one family or declared
 *     `shared` with a reason. A file the ledger forgot is a finding, not silence;
 *   - DEPENDENCIES are parsed from the declared files with a real tokenizer
 *     (strings and comments cannot fake an import), and compared in both
 *     directions: a declared dependency that no longer appears is stale
 *     inventory, an imported package that is not declared is an unauditable edge;
 *   - RETIREMENT READINESS is recomputed from `dev/agent-workflow/ledgers/
 *     ute-retirement.json` + the retirement gate's own coverage derivation (the
 *     baseline TSV's `entry` column and the new path's `NEW-PATH-VECTOR` lines),
 *     so a family cannot be declared ready by wishing;
 *   - every runtime-path step must name a tracked file this family owns, a
 *     declared shared file, or another family's file WITH that owner named.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT PROVE (stated so it is not oversold):
 *   - that a declared import is USED (only that it is imported);
 *   - that a family's authority is *effective*, only that the files named are
 *     the ones that implement it (ControlService / guard / kernel are read);
 *   - that the new native path is correct (that is the family's own evidence);
 *   - that the retirement gate allows the family (this gate grades the
 *     inventory's consistency with the measured readiness, not retirement).
 *
 * LEDGER: dev/agent-workflow/ledgers/ute-family-inventory.json
 * SCHEMA: ute-family-inventory/1 (see the ledger's `note` for the field law)
 *
 * NAMED REFUSALS (exit 1; each one has a mutation in the test suite):
 *   INVENTORY_FAMILY_MISSING        a census family is not booked in the inventory
 *   INVENTORY_FAMILY_UNKNOWN        the inventory books a family the census does not
 *   INVENTORY_MEMBER_DRIFT          members are not the census nativeNames (set)
 *   INVENTORY_LANE_DRIFT            the declared lane is not the census lane
 *   INVENTORY_TESTONLY_DRIFT        testOnly disagrees with the census mount
 *   INVENTORY_DEFINITION_DRIFT      definitions are not exactly the members / a
 *                                   bound-definition flag disagrees with the census /
 *                                   a declared symbol is not in its file
 *   INVENTORY_PATH_UNTRACKED        a declared file is not in the git index
 *   INVENTORY_PATH_MISSING          a declared file is tracked but absent on disk
 *   INVENTORY_DUPLICATE_CLAIM       one file claimed by two families (use `shared`)
 *   INVENTORY_FILE_UNOWNED          an implementation file in a family lane that no
 *                                   family claims and no `shared` entry explains
 *   INVENTORY_SHARED_UNREASONED     a `shared` entry without a reason (silence)
 *   INVENTORY_DEPENDENCY_UNKNOWN    a declared dependency/relative import that the
 *                                   declared files no longer contain
 *   INVENTORY_DEPENDENCY_UNDECLARED a declared file imports something undeclared
 *   INVENTORY_RUNTIME_PATH_BROKEN   a runtime-path step is not a tracked file the
 *                                   family owns / a shared file / an owned step, or
 *                                   the step metadata is missing
 *   INVENTORY_AUTHORITY_INVALID     authority is unnamed, names untracked files, or
 *                                   says UNKNOWN while naming files; a product
 *                                   family that does not name ControlService
 *   INVENTORY_NATIVE_DRIFT          nativePath status/files disagree
 *   INVENTORY_ROLE_UNKNOWN          a file role outside the closed set
 *   INVENTORY_READINESS_DRIFT       the declared readiness is not what the
 *                                   retirement ledger measures
 *   INVENTORY_RETIREMENT_PATH_DRIFT the retirement ledger declares an old-path file
 *                                   the inventory does not book for that family
 *   INVENTORY_SCHEMA (exit 2)       the inventory cannot be graded at all
 *
 * USAGE
 *   node scripts/ute-family-inventory.mjs [--json] [--ledger <path>]
 *
 * EXIT: 0 no findings | 1 findings | 2 could not grade (schema/IO).
 *
 * Exported for scripts/ute-family-inventory.test.mjs and
 * scripts/eb3-family-definitions.mjs (the required CI leg):
 *   LEDGER_REL, CENSUS_REL, RETIREMENT_LEDGER_REL, INVENTORY_SCHEMA, ROLES,
 *   READINESS_VALUES, REFUSAL_CODES, tokenizeJs, scanImports, resolveSpecifier,
 *   censusMembers, defaultTrackedPaths, loadInventory, checkInventory
 *
 * @module scripts/ute-family-inventory
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, normalize, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { checkRetirement } from './ute-retirement-gate.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

export const LEDGER_REL = 'dev/agent-workflow/ledgers/ute-family-inventory.json'
export const CENSUS_REL = 'dev/agent-workflow/ledgers/arc-a-family-census.json'
export const RETIREMENT_LEDGER_REL = 'dev/agent-workflow/ledgers/ute-retirement.json'
export const INVENTORY_SCHEMA = 'ute-family-inventory/1'

/** The closed role vocabulary. A role is "what this file does in the old path",
 *  never "which directory it happens to live in". */
export const ROLES = Object.freeze([
  'family-definition',
  'row-definition',
  'executor',
  'mechanics',
  'port',
  'normalizer',
  'contribution',
  'index',
  'test-only',
])

export const READINESS_VALUES = Object.freeze({
  baseline: Object.freeze(['none', 'partial', 'complete']),
  newPath: Object.freeze(['none', 'prototype', 'complete']),
  negativeControls: Object.freeze(['none', 'partial', 'complete']),
})
export const NATIVE_STATUS = Object.freeze(['none', 'prototype', 'product-module'])

export const REFUSAL_CODES = Object.freeze([
  'INVENTORY_FAMILY_MISSING',
  'INVENTORY_FAMILY_UNKNOWN',
  'INVENTORY_MEMBER_DRIFT',
  'INVENTORY_LANE_DRIFT',
  'INVENTORY_TESTONLY_DRIFT',
  'INVENTORY_DEFINITION_DRIFT',
  'INVENTORY_PATH_UNTRACKED',
  'INVENTORY_PATH_MISSING',
  'INVENTORY_DUPLICATE_CLAIM',
  'INVENTORY_FILE_UNOWNED',
  'INVENTORY_SHARED_UNREASONED',
  'INVENTORY_DEPENDENCY_UNKNOWN',
  'INVENTORY_DEPENDENCY_UNDECLARED',
  'INVENTORY_RUNTIME_PATH_BROKEN',
  'INVENTORY_AUTHORITY_INVALID',
  'INVENTORY_NATIVE_DRIFT',
  'INVENTORY_ROLE_UNKNOWN',
  'INVENTORY_READINESS_DRIFT',
  'INVENTORY_RETIREMENT_PATH_DRIFT',
])

const BOUND_PREFIX = /^\(bound-definition\)\s+/

// ────────────────────────────────────────────────────────────────────────────
// A small, honest JS tokenizer.
//
// WHY NOT A REGEX. `INVENTORY_DEPENDENCY_UNDECLARED` must not be fooled by
// `const s = "import x from 'evil'"` or by a commented-out import, and
// `INVENTORY_DEPENDENCY_UNKNOWN` must not miss an import that a formatter
// re-wrapped. So imports are read from TOKENS: comments are skipped, string
// contents are never re-read as code, and a template literal's text cannot
// impersonate an import.
//
// It is deliberately not a full parser: it produces `id`, `str`, `punct` tokens
// (with a regex-literal heuristic so a regex containing a quote cannot desync
// string state) and `scanImports` reads the four module-specifier shapes ESM
// actually has, plus `require('x')` and `new URL('<rel>', import.meta.url)` —
// the last one is how the C2 probe lane resolves its public seams.
// ────────────────────────────────────────────────────────────────────────────

const KEYWORDS_BEFORE_REGEX = new Set([
  'return', 'typeof', 'case', 'in', 'of', 'new', 'delete', 'void', 'throw',
  'yield', 'await', 'else', 'do', 'instanceof',
])

const isIdStart = (c) => /[A-Za-z_$]/.test(c)
const isIdPart = (c) => /[A-Za-z0-9_$]/.test(c)

/**
 * Tokenize JavaScript/TypeScript into `{t:'id'|'str'|'punct', v}` tokens.
 * Comments are dropped; string values are decoded enough to compare module
 * specifiers (escapes are kept verbatim — a module specifier has none).
 *
 * @param {string} text
 * @returns {Array<{t: 'id'|'str'|'punct', v: string, i: number}>}
 */
export function tokenizeJs(text) {
  const tokens = []
  const n = text.length
  let i = 0
  /** @type {Array<{kind: 'code'|'template'}>} */
  const stack = [{ kind: 'code' }]
  const atCode = () => stack[stack.length - 1].kind === 'code'

  const prevSignificant = () => tokens[tokens.length - 1]
  const regexAllowed = () => {
    const prev = prevSignificant()
    if (prev === undefined) return true
    if (prev.t === 'str') return false
    if (prev.t === 'id') return KEYWORDS_BEFORE_REGEX.has(prev.v)
    return prev.v !== ')' && prev.v !== ']' && prev.v !== '}'
  }

  while (i < n) {
    const c = text[i]
    if (!atCode()) {
      // Inside a template literal's raw text.
      if (c === '\\') { i += 2; continue }
      if (c === '`') { stack.pop(); i += 1; continue }
      if (c === '$' && text[i + 1] === '{') { stack.push({ kind: 'code' }); i += 2; continue }
      i += 1
      continue
    }
    if (c === '/' && text[i + 1] === '/') {
      while (i < n && text[i] !== '\n') i += 1
      continue
    }
    if (c === '/' && text[i + 1] === '*') {
      i += 2
      while (i < n && !(text[i] === '*' && text[i + 1] === '/')) i += 1
      i += 2
      continue
    }
    if (c === '"' || c === "'") {
      const quote = c
      i += 1
      let value = ''
      while (i < n && text[i] !== quote) {
        if (text[i] === '\\') { value += text[i] + (text[i + 1] ?? ''); i += 2; continue }
        if (text[i] === '\n') break // unterminated: stop at the line
        value += text[i]
        i += 1
      }
      i += 1
      tokens.push({ t: 'str', v: value, i })
      continue
    }
    if (c === '`') {
      tokens.push({ t: 'str', v: '`template`', i })
      stack.push({ kind: 'template' })
      i += 1
      continue
    }
    if (c === '/' && regexAllowed()) {
      // Regex literal: scan to the unescaped closing `/`, then flags.
      i += 1
      let inClass = false
      while (i < n) {
        if (text[i] === '\\') { i += 2; continue }
        if (text[i] === '[') inClass = true
        else if (text[i] === ']') inClass = false
        else if (text[i] === '/' && !inClass) { i += 1; break }
        else if (text[i] === '\n') break
        i += 1
      }
      while (i < n && /[a-z]/.test(text[i])) i += 1
      tokens.push({ t: 'str', v: '`regex`', i })
      continue
    }
    if (isIdStart(c)) {
      let value = ''
      while (i < n && isIdPart(text[i])) { value += text[i]; i += 1 }
      tokens.push({ t: 'id', v: value, i })
      continue
    }
    if (/[0-9]/.test(c)) {
      while (i < n && /[0-9A-Za-z_.]/.test(text[i])) i += 1
      tokens.push({ t: 'str', v: '`number`', i })
      continue
    }
    if (c === '}' && !atCode()) { i += 1; continue }
    if (c === '}' && atCode() && stack.length > 1) { stack.pop(); i += 1; continue }
    if (!/\s/.test(c)) tokens.push({ t: 'punct', v: c, i })
    i += 1
  }
  return tokens
}

/**
 * Every module specifier a source file references, de-duplicated, in source
 * order. Shapes:
 *   import x from 's' / import 's' / export … from 's'   (static)
 *   import('s') / require('s')                            (literal dynamic)
 *   new URL('s', import.meta.url)                         (URL-based relative seam)
 *
 * @param {string} text
 * @returns {string[]}
 */
export function scanImports(text) {
  const tokens = tokenizeJs(text)
  const found = []
  const push = (spec) => {
    if (typeof spec === 'string' && spec.length > 0 && !found.includes(spec)) found.push(spec)
  }
  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i]
    if (tok.t === 'id' && tok.v === 'from' && tokens[i + 1]?.t === 'str') {
      push(tokens[i + 1].v)
      continue
    }
    if (tok.t === 'id' && tok.v === 'import') {
      const next = tokens[i + 1]
      if (next?.t === 'str') { push(next.v); continue }
      if (next?.v === '(' && tokens[i + 2]?.t === 'str') { push(tokens[i + 2].v); continue }
      continue
    }
    if (tok.t === 'id' && tok.v === 'require' && tokens[i + 1]?.v === '(' && tokens[i + 2]?.t === 'str') {
      push(tokens[i + 2].v)
      continue
    }
    if (tok.t === 'id' && tok.v === 'new' && tokens[i + 1]?.t === 'id' && tokens[i + 1].v === 'URL') {
      const open = tokens[i + 2]
      const spec = tokens[i + 3]
      if (open?.v === '(' && spec?.t === 'str' && tokens[i + 4]?.v === ',') {
        // Only the `import.meta.url` base is a module reference; a plain
        // `new URL('https://…')` is data, not an import.
        let isImportMeta = false
        for (let k = i + 5; k < Math.min(tokens.length, i + 12); k += 1) {
          if (tokens[k].t === 'id' && tokens[k].v === 'import' && tokens[k + 1]?.v === '.' && tokens[k + 2]?.v === 'meta') { isImportMeta = true; break }
          if (tokens[k].v === ')') break
        }
        if (isImportMeta) push(spec.v)
      }
    }
  }
  return found
}

/** A repo-relative path: no absolute, no `..`, no `.` segments. */
export function safeRelPath(p) {
  if (typeof p !== 'string' || p.length === 0) return false
  if (isAbsolute(p)) return false
  const norm = normalize(p).split(sep).join('/')
  if (norm === '' || norm === '.' || norm.startsWith('../') || norm.includes('/../')) return false
  return norm === p.split(sep).join('/')
}

/** The repo-relative targets a relative specifier may resolve to. Order matters:
 *  the repo imports `.js` in TypeScript sources, so `.ts` is the usual answer. */
function resolutionCandidates(fromRel, spec) {
  const base = normalize(join(dirname(fromRel), spec)).split(sep).join('/')
  const out = [base]
  for (const ext of ['.ts', '.mjs', '.js', '.mts', '.cts']) out.push(base + ext)
  out.push(base.replace(/\.js$/, '.ts'), base.replace(/\.js$/, '.mjs'), base.replace(/\.mjs$/, '.ts'))
  for (const ext of ['.ts', '.mjs', '.js', '.mts']) out.push(`${base}/index${ext}`)
  return [...new Set(out)]
}

/**
 * Resolve a specifier against the tracked set (and disk, for a file that is
 * being added in the same change). Returns `{kind: 'bare'|'relative'|'unresolved',
 * path?}`. An unresolvable RELATIVE specifier is treated as `unresolved` and
 * graded like an out-of-family edge (fail closed), never dropped.
 */
export function resolveSpecifier(fromRel, spec, { trackedPaths, fileExists = existsSync, root = ROOT }) {
  if (!spec.startsWith('.')) return { kind: 'bare' }
  for (const candidate of resolutionCandidates(fromRel, spec)) {
    if (trackedPaths !== undefined && trackedPaths !== null && trackedPaths.has(candidate)) return { kind: 'relative', path: candidate }
    if (trackedPaths === undefined && fileExists(join(root, candidate))) return { kind: 'relative', path: candidate }
  }
  // Not resolvable: keep the specifier so the ledger must declare it somewhere.
  return { kind: 'unresolved', path: normalize(join(dirname(fromRel), spec)).split(sep).join('/') }
}

/** The census's member names for one family (prefix stripped), deduped, census order. */
export function censusMembers(entry) {
  const raw = Array.isArray(entry?.nativeNames) ? entry.nativeNames : []
  const out = []
  for (const name of raw) {
    if (typeof name !== 'string') continue
    const stripped = name.replace(BOUND_PREFIX, '').trim()
    if (stripped.length > 0 && !out.includes(stripped)) out.push(stripped)
  }
  return out
}

/** `git ls-files -z` over the whole tree, once. Injected in tests. */
export function defaultTrackedPaths(root = ROOT) {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z'], { encoding: 'utf8', maxBuffer: 128 * 1024 * 1024 })
  return new Set(out.split('\0').filter((p) => p.length > 0))
}

/** The real committed-file test (same law as the retirement gate). */
export function defaultIsTracked(root, relPath) {
  try {
    execFileSync('git', ['-C', root, 'ls-files', '--error-unmatch', '--', relPath], { stdio: ['ignore', 'ignore', 'ignore'] })
    return true
  } catch {
    return false
  }
}

const isNonEmptyString = (v) => typeof v === 'string' && v.length > 0
const isStringArray = (v) => Array.isArray(v) && v.every(isNonEmptyString)
const sameSet = (a, b) => a.length === b.length && a.every((x) => b.includes(x))

// ────────────────────────────────────────────────────────────────────────────
// Ledger shape (exit 2). Content disagreements are GRADED findings (exit 1):
// a ledger that can be read but says something false is exactly what this gate
// exists to refuse, not a reason to abstain.
// ────────────────────────────────────────────────────────────────────────────

function shapeError(detail) {
  return { refused: 'INVENTORY_SCHEMA', detail }
}

/** Load + shape-check the inventory. Returns `{inventory}` or `{refused}`. */
export function loadInventory({ root = ROOT, inventory } = {}) {
  let parsed = inventory
  if (parsed === undefined || parsed === null) {
    const abs = join(root, LEDGER_REL)
    if (!existsSync(abs)) return shapeError(`${LEDGER_REL} does not exist`)
    let text
    try {
      text = readFileSync(abs, 'utf8')
    } catch (e) {
      return shapeError(`${LEDGER_REL} could not be read: ${String(e?.message ?? e)}`)
    }
    try {
      parsed = JSON.parse(text)
    } catch (e) {
      return shapeError(`${LEDGER_REL} is not JSON: ${String(e?.message ?? e)}`)
    }
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return shapeError('the ledger is not a JSON object')
  if (parsed.schema !== INVENTORY_SCHEMA) return shapeError(`schema is ${JSON.stringify(parsed.schema)}, expected ${JSON.stringify(INVENTORY_SCHEMA)}`)
  if (!Array.isArray(parsed.families) || parsed.families.length === 0) return shapeError('`families` must be a non-empty array')
  if (parsed.shared !== undefined && !Array.isArray(parsed.shared)) return shapeError('`shared` must be an array when present')

  const seen = new Set()
  for (const family of parsed.families) {
    if (family === null || typeof family !== 'object' || Array.isArray(family)) return shapeError('every family entry must be an object')
    if (!isNonEmptyString(family.familyId)) return shapeError('every family needs a non-empty string `familyId`')
    if (seen.has(family.familyId)) return shapeError(`duplicate family ${JSON.stringify(family.familyId)} — one entry per family`)
    seen.add(family.familyId)
    if (!isNonEmptyString(family.lane)) return shapeError(`${family.familyId}: \`lane\` must be a non-empty string`)
    if (typeof family.testOnly !== 'boolean') return shapeError(`${family.familyId}: \`testOnly\` must be a boolean`)
    if (!isStringArray(family.members) || family.members.length === 0) return shapeError(`${family.familyId}: \`members\` must be a non-empty string array`)
    if (family.oldPath === null || typeof family.oldPath !== 'object' || !Array.isArray(family.oldPath.files) || family.oldPath.files.length === 0) {
      return shapeError(`${family.familyId}: \`oldPath.files\` must be a non-empty array`)
    }
    for (const file of family.oldPath.files) {
      if (file === null || typeof file !== 'object' || !isNonEmptyString(file.path)) return shapeError(`${family.familyId}: every oldPath.files entry needs a non-empty string \`path\``)
      if (file.definitionNames !== undefined && !isStringArray(file.definitionNames)) return shapeError(`${family.familyId}: ${file.path}: \`definitionNames\` must be a string array when present`)
    }
    if (!Array.isArray(family.definitions) || family.definitions.length === 0) return shapeError(`${family.familyId}: \`definitions\` must be a non-empty array`)
    for (const definition of family.definitions) {
      if (definition === null || typeof definition !== 'object' || !isNonEmptyString(definition.name) || !isNonEmptyString(definition.declaredIn)) {
        return shapeError(`${family.familyId}: every definition needs non-empty \`name\` and \`declaredIn\``)
      }
      if (typeof definition.boundDefinition !== 'boolean') return shapeError(`${family.familyId}: definition ${JSON.stringify(definition.name)} needs a boolean \`boundDefinition\``)
    }
    for (const key of ['dependsOn', 'importsWithinFamily', 'importsAcrossRepo']) {
      if (family[key] !== undefined && !isStringArray(family[key])) return shapeError(`${family.familyId}: \`${key}\` must be a string array when present`)
    }
    if (!Array.isArray(family.runtimePath) || family.runtimePath.length < 2) return shapeError(`${family.familyId}: \`runtimePath\` must be an array of at least two steps`)
    for (const step of family.runtimePath) {
      if (step === null || typeof step !== 'object' || !isNonEmptyString(step.step) || !isNonEmptyString(step.detail)) {
        return shapeError(`${family.familyId}: every runtimePath step needs non-empty \`step\` and \`detail\``)
      }
    }
    if (family.authority === null || typeof family.authority !== 'object' || !isStringArray(family.authority.enforcedBy) || !Array.isArray(family.authority.files)) {
      return shapeError(`${family.familyId}: \`authority\` needs \`enforcedBy\` (string array) and \`files\` (array)`)
    }
    if (!isStringArray(family.authority.files) && family.authority.files.length > 0) return shapeError(`${family.familyId}: \`authority.files\` must contain strings`)
    if (family.nativePath === null || typeof family.nativePath !== 'object' || !NATIVE_STATUS.includes(family.nativePath.status) || !Array.isArray(family.nativePath.files)) {
      return shapeError(`${family.familyId}: \`nativePath.status\` must be one of ${NATIVE_STATUS.join('|')} and \`files\` must be an array`)
    }
    if (family.nativePath.files.length > 0 && !isStringArray(family.nativePath.files)) return shapeError(`${family.familyId}: \`nativePath.files\` must contain strings`)
    const readiness = family.retirementReadiness
    if (readiness === null || typeof readiness !== 'object') return shapeError(`${family.familyId}: \`retirementReadiness\` must be an object`)
    for (const key of ['baseline', 'newPath', 'negativeControls']) {
      if (!READINESS_VALUES[key].includes(readiness[key])) return shapeError(`${family.familyId}: retirementReadiness.${key} must be one of ${READINESS_VALUES[key].join('|')}`)
    }
  }
  for (const entry of parsed.shared ?? []) {
    if (entry === null || typeof entry !== 'object' || !isNonEmptyString(entry.path)) return shapeError('every `shared` entry needs a non-empty string `path`')
  }
  return { inventory: parsed }
}

// ────────────────────────────────────────────────────────────────────────────
// The grading pass.
// ────────────────────────────────────────────────────────────────────────────

/**
 * Grade the inventory against the census, the tree, the parsed imports and the
 * measured retirement readiness.
 *
 * @param {object} p
 * @param {object} [p.inventory]  parsed ledger (else read from `root`)
 * @param {object} [p.census]     parsed census (else read from `root`)
 * @param {object} [p.retirement] parsed retirement ledger (else read from `root`)
 * @param {string} [p.root]
 * @param {Set<string>} [p.trackedPaths] tracked repo paths (else one git ls-files)
 * @param {(rel: string) => string} [p.readFile] absolute path → text
 * @param {(rel: string) => boolean} [p.fileExists]
 */
export function checkInventory({
  inventory,
  census,
  retirement,
  root = ROOT,
  trackedPaths,
  readFile = (abs) => readFileSync(abs, 'utf8'),
  fileExists = (abs) => existsSync(abs),
} = {}) {
  const loaded = loadInventory({ root, inventory })
  if (loaded.refused !== undefined) return { refused: loaded.refused, detail: loaded.detail, findings: [] }
  const ledger = loaded.inventory
  const findings = []
  const add = (code, familyId, detail, extra = {}) => findings.push({ code, familyId, detail, ...extra })

  const tracked = trackedPaths ?? defaultTrackedPaths(root)
  const isTracked = (rel) => (trackedPaths !== undefined && trackedPaths !== null ? trackedPaths.has(rel) : defaultIsTracked(root, rel))
  const abs = (rel) => join(root, rel)
  const present = (rel) => fileExists(abs(rel))

  // ── census + retirement: independent inputs, fail closed when unreadable ──
  let book = census
  if (book === undefined || book === null) {
    if (!isTracked(CENSUS_REL) || !present(CENSUS_REL)) return { refused: 'INVENTORY_CENSUS_UNGRADABLE', detail: `${CENSUS_REL} is not a committed, readable file — the family set and members cannot be derived`, findings: [] }
    try {
      book = JSON.parse(readFile(abs(CENSUS_REL)))
    } catch (e) {
      return { refused: 'INVENTORY_CENSUS_UNGRADABLE', detail: `${CENSUS_REL} is not readable JSON: ${String(e?.message ?? e)}`, findings: [] }
    }
  }
  if (book === null || typeof book !== 'object' || !Array.isArray(book.families)) {
    return { refused: 'INVENTORY_CENSUS_UNGRADABLE', detail: `${CENSUS_REL} is not an object with a \`families\` array`, findings: [] }
  }
  const censusById = new Map()
  for (const entry of book.families) {
    if (entry === null || typeof entry !== 'object' || typeof entry.familyId !== 'string') continue
    censusById.set(entry.familyId, entry)
  }

  let retirementLedger = retirement
  let retirementProblem = null
  if (retirementLedger === undefined || retirementLedger === null) {
    if (!isTracked(RETIREMENT_LEDGER_REL) || !present(RETIREMENT_LEDGER_REL)) {
      retirementProblem = `${RETIREMENT_LEDGER_REL} is not a committed, readable file`
    } else {
      try {
        retirementLedger = JSON.parse(readFile(abs(RETIREMENT_LEDGER_REL)))
      } catch (e) {
        retirementProblem = `${RETIREMENT_LEDGER_REL} is not readable JSON: ${String(e?.message ?? e)}`
      }
    }
  }
  const retirementByFamilyId = new Map()
  if (retirementProblem === null && retirementLedger !== null && typeof retirementLedger === 'object' && Array.isArray(retirementLedger.families)) {
    for (const row of retirementLedger.families) {
      const unitId = row?.unit?.familyId
      if (typeof unitId === 'string') retirementByFamilyId.set(unitId, row)
    }
  } else if (retirementProblem === null) {
    retirementProblem = `${RETIREMENT_LEDGER_REL} is not an object with a \`families\` array`
  }

  // ── 1. family closure, both directions ──
  const ledgerById = new Map()
  for (const family of ledger.families) ledgerById.set(family.familyId, family)
  for (const familyId of censusById.keys()) {
    if (!ledgerById.has(familyId)) add('INVENTORY_FAMILY_MISSING', familyId, `the census books ${JSON.stringify(familyId)} but the inventory has no entry for it — a family nobody inventoried cannot be retired honestly`)
  }
  for (const familyId of ledgerById.keys()) {
    if (!censusById.has(familyId)) add('INVENTORY_FAMILY_UNKNOWN', familyId, `the inventory books ${JSON.stringify(familyId)} but ${CENSUS_REL} does not — the census is the independent booking; inventing a family is not an inventory`)
  }

  // ── 2. per-family content ──
  const ownerByPath = new Map() // path → familyId (first claim)
  const claimsByPath = new Map() // path → [familyId]
  const familyInfo = []

  for (const family of ledger.families) {
    const censusEntry = censusById.get(family.familyId)
    if (censusEntry === undefined) continue // already INVENTORY_FAMILY_UNKNOWN
    const expectedMembers = censusMembers(censusEntry)
    const ownPaths = family.oldPath.files.map((f) => f.path)
    const ownSet = new Set(ownPaths)
    for (const path of ownPaths) {
      if (!claimsByPath.has(path)) claimsByPath.set(path, [])
      claimsByPath.get(path).push(family.familyId)
      if (!ownerByPath.has(path)) ownerByPath.set(path, family.familyId)
    }
    if (!sameSet([...new Set(family.members)], expectedMembers)) {
      const missing = expectedMembers.filter((m) => !family.members.includes(m))
      const extra = family.members.filter((m) => !expectedMembers.includes(m))
      add('INVENTORY_MEMBER_DRIFT', family.familyId, `members disagree with the census nativeNames: missing ${missing.map((m) => JSON.stringify(m)).join(', ') || 'none'}, extra ${extra.map((m) => JSON.stringify(m)).join(', ') || 'none'} — the census is the unit (RETIREMENT.md §1.1), and renaming a member is not an inventory edit`)
    }
    if (family.lane !== censusEntry.lane) add('INVENTORY_LANE_DRIFT', family.familyId, `lane ${JSON.stringify(family.lane)} is not the census lane ${JSON.stringify(censusEntry.lane)}`)
    const censusTestOnly = censusEntry.mount === 'test-only'
    if (family.testOnly !== censusTestOnly) add('INVENTORY_TESTONLY_DRIFT', family.familyId, `testOnly=${String(family.testOnly)} but the census mount is ${JSON.stringify(censusEntry.mount)} (test-only ⇔ mount 'test-only')`)

    // definitions
    const definitionNames = family.definitions.map((d) => d.name)
    if (!sameSet([...new Set(definitionNames)], expectedMembers)) {
      const missing = expectedMembers.filter((m) => !definitionNames.includes(m))
      const extra = definitionNames.filter((n) => !expectedMembers.includes(n))
      add('INVENTORY_DEFINITION_DRIFT', family.familyId, `definitions are not exactly the members: missing ${missing.map((m) => JSON.stringify(m)).join(', ') || 'none'}, extra ${extra.map((n) => JSON.stringify(n)).join(', ') || 'none'}`)
    }
    for (const definition of family.definitions) {
      const censusName = (censusEntry.nativeNames ?? []).find((n) => typeof n === 'string' && n.replace(BOUND_PREFIX, '').trim() === definition.name)
      if (censusName === undefined) continue // covered by the set drift above
      const censusBound = BOUND_PREFIX.test(censusName)
      if (censusBound !== definition.boundDefinition) {
        add('INVENTORY_DEFINITION_DRIFT', family.familyId, `definition ${JSON.stringify(definition.name)}: boundDefinition=${String(definition.boundDefinition)} but the census books it ${censusBound ? 'with' : 'without'} the \`(bound-definition)\` prefix`)
      }
      if (!ownSet.has(definition.declaredIn)) {
        add('INVENTORY_DEFINITION_DRIFT', family.familyId, `definition ${JSON.stringify(definition.name)} declares \`declaredIn\` ${JSON.stringify(definition.declaredIn)}, which this family does not claim — a definition declared outside its own old path is an unauditable definition`)
      } else if (!isTracked(definition.declaredIn) || !present(definition.declaredIn)) {
        add('INVENTORY_PATH_UNTRACKED', family.familyId, `definition ${JSON.stringify(definition.name)} is declared in ${JSON.stringify(definition.declaredIn)}, which is not a tracked, present file`)
      } else if (definition.symbol !== undefined) {
        if (!isNonEmptyString(definition.symbol)) add('INVENTORY_DEFINITION_DRIFT', family.familyId, `definition ${JSON.stringify(definition.name)}: \`symbol\` must be a non-empty string when present`)
        else {
          let text = ''
          try { text = readFile(abs(definition.declaredIn)) } catch { text = '' }
          if (!text.includes(definition.symbol)) add('INVENTORY_DEFINITION_DRIFT', family.familyId, `definition ${JSON.stringify(definition.name)}: symbol ${JSON.stringify(definition.symbol)} does not appear in ${definition.declaredIn} — the declaration is invented or stale`)
        }
      }
    }

    // roles + path existence
    for (const file of family.oldPath.files) {
      if (!ROLES.includes(file.role)) add('INVENTORY_ROLE_UNKNOWN', family.familyId, `${file.path}: role ${JSON.stringify(file.role)} is not one of ${ROLES.join('|')}`)
      if (!safeRelPath(file.path)) {
        add('INVENTORY_PATH_UNTRACKED', family.familyId, `${JSON.stringify(file.path)} is not a repo-relative path`)
        continue
      }
      const trackedHere = isTracked(file.path)
      const presentHere = present(file.path)
      if (!trackedHere) add('INVENTORY_PATH_UNTRACKED', family.familyId, `${file.path} is not in the git index — an untracked file cannot be part of a retirement declaration (a cold clone cannot see it)`)
      if (!presentHere) add('INVENTORY_PATH_MISSING', family.familyId, `${file.path} is declared as old-path implementation but is absent from the working tree`)
      // definitionNames, when present, must be a subset of what this family declares
      for (const name of file.definitionNames ?? []) {
        if (!definitionNames.includes(name)) add('INVENTORY_DEFINITION_DRIFT', family.familyId, `${file.path} claims definitionNames ${JSON.stringify(name)}, which this family does not declare`)
      }
    }

    // duplicates inside one family
    const seenPaths = new Set()
    for (const path of ownPaths) {
      if (seenPaths.has(path)) add('INVENTORY_DUPLICATE_CLAIM', family.familyId, `${path} is claimed twice in the same family`)
      seenPaths.add(path)
    }

    // dependencies, parsed in both directions
    const parsed = parseFamilyImports({ family, root, tracked, readFile, fileExists, ownSet })
    compareImports({
      familyId: family.familyId,
      declared: family.dependsOn ?? [],
      actual: parsed.bare,
      label: 'dependsOn',
      add,
    })
    compareImports({
      familyId: family.familyId,
      declared: family.importsWithinFamily ?? [],
      actual: parsed.within,
      label: 'importsWithinFamily',
      add,
    })
    compareImports({
      familyId: family.familyId,
      declared: family.importsAcrossRepo ?? [],
      actual: parsed.across,
      label: 'importsAcrossRepo',
      add,
    })
    if (parsed.unreadable.length > 0) {
      for (const rel of parsed.unreadable) add('INVENTORY_PATH_MISSING', family.familyId, `${rel} is declared but could not be read, so its imports could not be parsed`)
    }

    // runtime path
    const sharedPaths = new Set((ledger.shared ?? []).map((s) => s.path))
    let ownStep = false
    const stepNames = new Set()
    for (const step of family.runtimePath) {
      if (stepNames.has(step.step)) add('INVENTORY_RUNTIME_PATH_BROKEN', family.familyId, `runtimePath step ${JSON.stringify(step.step)} appears twice`)
      stepNames.add(step.step)
      if (step.external === true) {
        if (step.file !== undefined) add('INVENTORY_RUNTIME_PATH_BROKEN', family.familyId, `step ${JSON.stringify(step.step)} is marked external but also names a repo file ${JSON.stringify(step.file)} — an external step is outside this tree; do not invent a file for it`)
        if (!isNonEmptyString(step.where)) add('INVENTORY_RUNTIME_PATH_BROKEN', family.familyId, `external step ${JSON.stringify(step.step)} must say WHERE the implementation lives (non-empty \`where\`)`)
        continue
      }
      if (!isNonEmptyString(step.file)) {
        add('INVENTORY_RUNTIME_PATH_BROKEN', family.familyId, `step ${JSON.stringify(step.step)} names no \`file\` and is not marked external`)
        continue
      }
      if (!safeRelPath(step.file) || !isTracked(step.file)) {
        add('INVENTORY_RUNTIME_PATH_BROKEN', family.familyId, `step ${JSON.stringify(step.step)} names ${JSON.stringify(step.file)}, which is not a tracked repo file — an invented runtime step is the exact fabrication this inventory refuses`)
        continue
      }
      const owner = ownerByPath.get(step.file)
      if (owner === family.familyId) { ownStep = true; continue }
      if (sharedPaths.has(step.file)) {
        if (step.shared !== true) add('INVENTORY_RUNTIME_PATH_BROKEN', family.familyId, `step ${JSON.stringify(step.step)} uses shared file ${step.file} without \`shared: true\``)
        continue
      }
      if (owner !== undefined) {
        if (step.owner !== owner) add('INVENTORY_RUNTIME_PATH_BROKEN', family.familyId, `step ${JSON.stringify(step.step)} names ${step.file}, owned by ${JSON.stringify(owner)}, but declares owner ${JSON.stringify(step.owner ?? null)} — a cross-family step must name its real owner`)
        continue
      }
      add('INVENTORY_RUNTIME_PATH_BROKEN', family.familyId, `step ${JSON.stringify(step.step)} names ${step.file}, which no family owns and no \`shared\` entry explains — the runtime path cannot point at an unaccounted file`)
    }
    if (!ownStep) add('INVENTORY_RUNTIME_PATH_BROKEN', family.familyId, 'no runtimePath step names a file this family owns — a chain of shared files is not evidence about this family')

    // authority
    const authority = family.authority
    if (!isStringArray(authority.enforcedBy) || authority.enforcedBy.length === 0) {
      add('INVENTORY_AUTHORITY_INVALID', family.familyId, 'authority.enforcedBy is empty — a family whose authority is not visible must say UNKNOWN, not nothing')
    } else if (authority.enforcedBy.includes('UNKNOWN')) {
      if (authority.files.length > 0) add('INVENTORY_AUTHORITY_INVALID', family.familyId, 'authority says UNKNOWN but names files — UNKNOWN means not visible, so it cannot carry invented files')
      if (authority.enforcedBy.length !== 1) add('INVENTORY_AUTHORITY_INVALID', family.familyId, 'UNKNOWN must be the whole answer (enforcedBy === ["UNKNOWN"])')
      if (!isNonEmptyString(authority.note)) add('INVENTORY_AUTHORITY_INVALID', family.familyId, 'authority UNKNOWN needs a `note` saying why it is not visible')
    } else if (authority.files.length === 0) {
      add('INVENTORY_AUTHORITY_INVALID', family.familyId, 'authority names an enforcement mechanism but no files — the claim is not checkable')
    }
    if (!family.testOnly && !authority.enforcedBy.includes('UNKNOWN') && !authority.enforcedBy.includes('ControlService')) {
      add('INVENTORY_AUTHORITY_INVALID', family.familyId, `a product family's authority must name ControlService (owner decision D5: ControlService remains the sole approval/Grant/Stop authority), got ${JSON.stringify(authority.enforcedBy)}`)
    }
    for (const file of authority.files) {
      if (!safeRelPath(file) || !isTracked(file)) add('INVENTORY_AUTHORITY_INVALID', family.familyId, `authority file ${JSON.stringify(file)} is not a tracked repo file`)
      else if (!present(file)) add('INVENTORY_AUTHORITY_INVALID', family.familyId, `authority file ${JSON.stringify(file)} is absent from the working tree`)
    }

    // native path
    const native = family.nativePath
    if (native.status === 'none') {
      if (native.files.length > 0) add('INVENTORY_NATIVE_DRIFT', family.familyId, 'nativePath.status is none but files are named — "none" with files is a wish')
    } else if (native.files.length === 0) {
      add('INVENTORY_NATIVE_DRIFT', family.familyId, `nativePath.status is ${JSON.stringify(native.status)} but no files are named`)
    } else {
      for (const file of native.files) {
        if (!safeRelPath(file) || !isTracked(file)) add('INVENTORY_NATIVE_DRIFT', family.familyId, `nativePath file ${JSON.stringify(file)} is not a tracked repo file`)
        else if (!present(file)) add('INVENTORY_NATIVE_DRIFT', family.familyId, `nativePath file ${JSON.stringify(file)} is absent from the working tree`)
      }
    }

    // retirement readiness, recomputed from the measured artifacts
    const derived = deriveReadiness({
      familyId: family.familyId,
      members: expectedMembers,
      retirementRow: retirementByFamilyId.get(family.familyId),
      retirementProblem,
      retirementLedger,
      root,
      tracked,
      readFile,
      fileExists,
    })
    if (derived !== null) {
      for (const key of ['baseline', 'newPath', 'negativeControls']) {
        if (family.retirementReadiness[key] !== derived[key]) {
          add('INVENTORY_READINESS_DRIFT', family.familyId, `retirementReadiness.${key}=${JSON.stringify(family.retirementReadiness[key])} but the measured artifacts derive ${JSON.stringify(derived[key])} (${derived.detail}) — readiness is measured, not declared`)
        }
      }
    }

    // the retirement ledger's oldPath must be a subset of this family's inventory
    const retirementRow = retirementByFamilyId.get(family.familyId)
    const retirementFiles = retirementRow?.oldPath?.files
    if (Array.isArray(retirementFiles)) {
      for (const rel of retirementFiles) {
        if (typeof rel !== 'string') continue
        if (!ownSet.has(rel)) add('INVENTORY_RETIREMENT_PATH_DRIFT', family.familyId, `${RETIREMENT_LEDGER_REL} declares old-path file ${rel} for this family but the inventory does not book it — the retirement licence must not name a file the inventory disowns`)
      }
    }

    familyInfo.push({
      familyId: family.familyId,
      lane: family.lane,
      testOnly: family.testOnly,
      members: expectedMembers,
      files: family.oldPath.files.length,
      definitions: family.definitions.length,
      dependsOn: [...(family.dependsOn ?? [])].sort(),
      readiness: { ...family.retirementReadiness },
      derivedReadiness: derived === null ? null : { baseline: derived.baseline, newPath: derived.newPath, negativeControls: derived.negativeControls },
      runtimeSteps: family.runtimePath.length,
    })
  }

  // ── 3. duplicate claims across families ──
  for (const [path, claimants] of claimsByPath) {
    if (claimants.length > 1) add('INVENTORY_DUPLICATE_CLAIM', claimants[0], `${path} is claimed by ${claimants.map((c) => JSON.stringify(c)).join(', ')} — a file has one owner; a genuinely shared module belongs in \`shared\`, not in two old paths`)
  }

  // ── 4. the file universe: every family-lane implementation file is accounted for ──
  const shared = new Map()
  for (const entry of ledger.shared ?? []) {
    if (!safeRelPath(entry.path)) {
      add('INVENTORY_PATH_UNTRACKED', null, `shared entry ${JSON.stringify(entry.path)} is not a repo-relative path`)
      continue
    }
    if (!isNonEmptyString(entry.reason)) add('INVENTORY_SHARED_UNREASONED', null, `${entry.path} is declared shared without a reason — an unexplained shared file is exactly the silence this rule exists to refuse`)
    if (!isTracked(entry.path)) add('INVENTORY_PATH_UNTRACKED', null, `shared file ${entry.path} is not in the git index`)
    else if (!present(entry.path)) add('INVENTORY_PATH_MISSING', null, `shared file ${entry.path} is absent from the working tree`)
    shared.set(entry.path, entry)
  }
  const universe = familyUniverse({ censusById, tracked })
  for (const path of universe) {
    if (claimsByPath.has(path) || shared.has(path)) continue
    add('INVENTORY_FILE_UNOWNED', null, `${path} is an implementation file in a booked family lane (or the family-body directory) that no family claims and no \`shared\` entry explains — an unowned file of the old path is an unauditable deletion later`)
  }

  return {
    findings,
    families: familyInfo,
    shared: [...shared.keys()].sort(),
    universe: universe.length,
    retirementProblem,
  }
}

function compareImports({ familyId, declared, actual, label, add }) {
  const declaredSet = new Set(declared)
  const actualSet = new Set(actual)
  const missing = [...declaredSet].filter((s) => !actualSet.has(s))
  const extra = [...actualSet].filter((s) => !declaredSet.has(s))
  if (missing.length > 0) {
    add('INVENTORY_DEPENDENCY_UNKNOWN', familyId, `${label} declares ${missing.map((s) => JSON.stringify(s)).join(', ')}, which the declared files no longer import — the inventory is stale and an auditable edge is now fiction`)
  }
  if (extra.length > 0) {
    add('INVENTORY_DEPENDENCY_UNDECLARED', familyId, `the declared files import ${extra.map((s) => JSON.stringify(s)).join(', ')} but ${label} does not declare it — an undeclared import is an edge no review attached to this family`)
  }
}

/** Parse every declared file of a family and partition its specifiers into
 *  bare / within-family relative / across-repo relative. */
export function parseFamilyImports({ family, root = ROOT, tracked, readFile, fileExists = existsSync, ownSet }) {
  const bare = new Set()
  const within = new Set()
  const across = new Set()
  const unreadable = []
  const owned = ownSet ?? new Set(family.oldPath.files.map((f) => f.path))
  for (const file of family.oldPath.files) {
    let text
    try {
      text = readFile(join(root, file.path))
    } catch {
      unreadable.push(file.path)
      continue
    }
    for (const spec of scanImports(text)) {
      const resolved = resolveSpecifier(file.path, spec, { trackedPaths: tracked, fileExists, root })
      if (resolved.kind === 'bare') bare.add(spec)
      else if (resolved.kind === 'relative' && owned.has(resolved.path)) within.add(spec)
      else across.add(spec)
    }
  }
  return {
    bare: [...bare].sort(),
    within: [...within].sort(),
    across: [...across].sort(),
    unreadable,
  }
}

/** The implementation-file universe: each booked lane's `src/` plus the
 *  family-body directory. Derived from the census + the git index, never from
 *  the ledger (otherwise the ledger would define its own completeness). */
export function familyUniverse({ censusById, tracked }) {
  const lanes = [...censusById.values()].map((f) => f.lane).filter((l) => typeof l === 'string' && l.length > 0)
  const lanePrefixes = lanes.map((lane) => `${lane.replace(/\/$/, '')}/src/`)
  const codeExt = /\.(mjs|mts|js|ts)$/
  const out = []
  for (const path of tracked) {
    if (!codeExt.test(path)) continue
    if (lanePrefixes.some((prefix) => path.startsWith(prefix)) || /^packages\/tools\/families\/[^/]+\.(mjs|mts|js|ts)$/.test(path)) out.push(path)
  }
  return out.sort()
}

/**
 * Readiness, derived from the measured retirement artifacts (never asserted).
 * The retirement gate already owns the coverage derivation (baseline TSV
 * `entry` column, `NEW-PATH-VECTOR <id> PASS`, `NC-MEMBER <member>`); this
 * function only maps its coverage onto the inventory's three-value vocabulary.
 *
 *   baseline          none: the term is not established or nothing is covered
 *                     partial: some members have a baseline vector
 *                     complete: every member has one
 *   newPath           none: the term is not established
 *                     prototype: established for some members (a prototype is
 *                                not a product module and does not cover the unit
 *                                by definition)
 *                     complete: every member reproduced by the new path
 *   negativeControls  none: the term is not established / no control evidence
 *                     partial: the family's controls exist but do not cover every
 *                                member (the FS state: four family-level controls,
 *                                zero `NC-MEMBER` lines)
 *                     complete: every member has its own control line
 */
export function deriveReadiness({ familyId, members, retirementRow, retirementProblem, retirementLedger, root, tracked, readFile, fileExists }) {
  if (retirementProblem !== null) {
    return { baseline: 'none', newPath: 'none', negativeControls: 'none', detail: `${retirementProblem}, so no readiness can be derived` }
  }
  if (retirementRow === undefined) {
    return { baseline: 'none', newPath: 'none', negativeControls: 'none', detail: 'no retirement-ledger row is booked for this family, so no old-baseline/new-path/negative-control evidence exists' }
  }
  let verdict
  try {
    verdict = checkRetirement({
      ledger: retirementLedger,
      family: retirementRow.family,
      root,
      readFile: (abs) => readFile(abs),
      isTracked: (r, rel) => tracked.has(rel),
      fileExists,
    })
  } catch (e) {
    return { baseline: 'none', newPath: 'none', negativeControls: 'none', detail: `the retirement gate could not grade this row (${String(e?.message ?? e)})` }
  }
  const coverage = verdict?.coverage ?? {}
  const total = members.length
  const covered = (key) => (Array.isArray(coverage[key]) ? coverage[key].length : 0)
  const baselineCovered = covered('oldBaseline')
  const newPathCovered = covered('newPathVerified')
  const ncCovered = covered('negativeControlsPass')
  // A family-level negative control is still measured evidence, but it is not
  // per-member control: FS has four family-level controls and zero NC-MEMBER
  // lines, which is `partial`, never `complete` and not `none`. "Evidence
  // exists" is graded against the committed file, not the row's prose.
  const ncEvidence = verdict?.terms?.negativeControlsPass !== undefined
    && retirementRow?.terms?.negativeControlsPass?.verdict === true
    && typeof retirementRow?.terms?.negativeControlsPass?.evidence?.path === 'string'
    && tracked.has(retirementRow.terms.negativeControlsPass.evidence.path)
    && fileExists(join(root, retirementRow.terms.negativeControlsPass.evidence.path))
  const baseline = baselineCovered === 0 ? 'none' : baselineCovered === total ? 'complete' : 'partial'
  const newPath = newPathCovered === 0 ? 'none' : newPathCovered === total ? 'complete' : 'prototype'
  const negativeControls = ncCovered === total && total > 0 ? 'complete' : (ncCovered > 0 || ncEvidence) ? 'partial' : 'none'
  return {
    baseline,
    newPath,
    negativeControls,
    detail: `retirement gate coverage: oldBaseline ${String(baselineCovered)}/${String(total)}, newPathVerified ${String(newPathCovered)}/${String(total)}, negativeControlsPass ${String(ncCovered)}/${String(total)}, family-level negative-control evidence ${ncEvidence ? 'present' : 'absent'}`,
  }
}

// ────────────────────────────────────────────────────────────────────────────
// CLI
// ────────────────────────────────────────────────────────────────────────────

function parseArgv(argv) {
  const out = { json: false, ledger: null }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    if (arg === '--json') out.json = true
    else if (arg === '--ledger') {
      out.ledger = argv[i + 1] ?? null
      i += 1
      if (out.ledger === null) return { error: '--ledger needs a path' }
    } else if (arg === '--help' || arg === '-h') return { help: true }
    else return { error: `unknown argument ${JSON.stringify(arg)} (usage: [--json] [--ledger <path>])` }
  }
  return out
}

function main(argv) {
  const args = parseArgv(argv)
  if (args.help === true) {
    console.log('usage: node scripts/ute-family-inventory.mjs [--json] [--ledger <path>]')
    console.log('grades dev/agent-workflow/ledgers/ute-family-inventory.json against the census, the tree, parsed imports and the measured retirement readiness.')
    return 0
  }
  if (args.error !== undefined) {
    console.error(`UTE-FAMILY-INVENTORY-SCHEMA-ERROR code=INVENTORY_SCHEMA detail=${JSON.stringify(args.error)}`)
    return 2
  }
  let inventory
  if (args.ledger !== null) {
    const abs = resolve(process.cwd(), args.ledger)
    try {
      inventory = JSON.parse(readFileSync(abs, 'utf8'))
    } catch (e) {
      console.error(`UTE-FAMILY-INVENTORY-SCHEMA-ERROR code=INVENTORY_SCHEMA detail=${JSON.stringify(`${args.ledger} could not be read as JSON: ${String(e?.message ?? e)}`)}`)
      return 2
    }
  }
  let result
  try {
    result = checkInventory({ inventory })
  } catch (e) {
    console.error(`UTE-FAMILY-INVENTORY-SCHEMA-ERROR code=INVENTORY_SCHEMA detail=${JSON.stringify(String(e?.message ?? e))}`)
    return 2
  }
  if (result.refused !== undefined) {
    if (args.json) console.log(JSON.stringify({ schema: 'ute-family-inventory-verdict/1', couldNotGrade: result.refused, detail: result.detail }, null, 2))
    else console.error(`UTE-FAMILY-INVENTORY-SCHEMA-ERROR code=${result.refused} detail=${JSON.stringify(result.detail)}`)
    return 2
  }

  if (args.json) {
    const payload = {
      schema: 'ute-family-inventory-verdict/1',
      ledger: args.ledger ?? LEDGER_REL,
      universeFiles: result.universe,
      shared: result.shared,
      families: result.families,
      findings: result.findings,
      summary: {
        families: result.families.length,
        findings: result.findings.length,
        codes: [...new Set(result.findings.map((f) => f.code))].sort(),
      },
    }
    console.log(JSON.stringify(payload, null, 2))
  } else {
    console.log(`UTE-FAMILY-INVENTORY ledger=${args.ledger ?? LEDGER_REL} schema=${INVENTORY_SCHEMA} families=${String(result.families.length)} universe=${String(result.universe)} shared=${String(result.shared.length)}`)
    for (const family of result.families) {
      const readiness = family.derivedReadiness ?? family.readiness
      console.log(`  UTE-FAMILY-INVENTORY-FAMILY family=${family.familyId} members=${String(family.members.length)} files=${String(family.files)} definitions=${String(family.definitions)} steps=${String(family.runtimeSteps)} readiness=baseline:${readiness.baseline},newPath:${readiness.newPath},negativeControls:${readiness.negativeControls} testOnly=${String(family.testOnly)}`)
    }
    for (const finding of result.findings) console.log(`UTE-FAMILY-INVENTORY-FINDING code=${finding.code} family=${finding.familyId ?? '-'} detail=${JSON.stringify(finding.detail)}`)
    console.log(`UTE-FAMILY-INVENTORY-SUMMARY families=${String(result.families.length)} files=${String(result.universe)} findings=${String(result.findings.length)}`)
  }
  return result.findings.length === 0 ? 0 : 1
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  process.exitCode = main(process.argv.slice(2))
}
