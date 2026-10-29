#!/usr/bin/env node
/**
 * eb3-family-boundaries.mjs — EB3: "让某 Family 影响别的 Family 必须被发现"
 * (one Family influencing another must be detected), as a CI check.
 *
 * THE LAW BEING ENFORCED IS WRITTEN DOWN, NOT INVENTED HERE. Each family lane's
 * README states its allowed outward edges, and search-family's says so most
 * explicitly:
 *
 *   "Allowed outward edges, and only these: `node:*` builtins,
 *    `@deepseek-ai/dsh-tool-fs-search` (host public package …), the reviewed
 *    confined process provider public face …, `verifyOpenedHandle` (referenced,
 *    never copied), and the SIBLING FAMILY public faces:
 *    `../../fs-family/src/index.mjs` (`resolveAnchored` — the one anchor-law home)
 *    and `../../process-family/src/index.mjs` (`SYSTEM_RX` — the one
 *    provider grant-entry-builder home). NO imports of the plane
 *    (`src/plugin/live/*`), the governance-center lane, tool-dispatch, the
 *    dormant a5p5 lane, or Host internals."
 *
 * Those edges are transcribed into `LANE_EDGES`. Anything else is
 * `FAMILY_CROSS_INFLUENCE`, and the two influence shapes that matter most are
 * distinguished by the detail text:
 *
 *   sibling-INTERNALS  `../../fs-family/src/fs-mechanics.mjs` — compiles, reviews
 *                      as "just a function", and binds this lane to another lane's
 *                      unexported surface. The public face is `index.mjs`; reaching
 *                      past it is the influence the law forbids.
 *   centre-ward        `../../../runtime/src/plugin/live/*` — a family lane importing
 *                      the assembly that mounts it. That is influence in the
 *                      direction the whole CA-01/CA-03 split exists to prevent.
 *
 * WHY A THIRD SIBLING EDGE IS NOT A FALSE POSITIVE. A lane that needs a new sibling
 * function adds it to the OTHER lane's public barrel and books the edge here — one
 * reviewable line, which is exactly the visibility this check buys. The control
 * proves both directions: the honest tree passes, and each of the three mutations
 * fails by the named code.
 *
 * NOT COVERED, STATED RATHER THAN IMPLIED: runtime influence through the Kernel,
 * through durable state, or through a shared provider is outside a static import
 * check; those are the C2 suites' job and this file does not claim them.
 *
 * HOW AN EDGE IS SEEN (R-DYNIMPORT, external architecture review 2026-10-29).
 * The first draft pulled specifiers out of raw text with regexes after stripping
 * comments, and that extractor had two blind spots and one live hazard, all
 * proven rather than hypothetical:
 *
 *   blind spot — a COMPUTED dynamic import (`const p = './x.mjs'; import(p)`,
 *                `import(prefix + suffix)`) carries no literal for a regex to
 *                see, so a lane could reach ANY target INVISIBLY.
 *   hazard     — comments were stripped but STRING literals were not, so prose
 *                inside a string — the incident: a sentence like "a
 *                zero-side-effect assertion must treat…" whose wording held
 *                `from '` / `import(` — was once graded as a real import edge.
 *
 * The fix is to PARSE, not pattern-match. Primary extractor: acorn
 * (ecmaVersion latest, sourceType module); edges are collected from
 * ImportDeclaration / ExportNamedDeclaration / ExportAllDeclaration `source`,
 * literal `require('…')`, and ImportExpression. A non-literal ImportExpression
 * is the fail-closed `COMPUTED_DYNAMIC_IMPORT` finding (file + line): its target
 * is invisible to ANY static check, so it passes only through an exact
 * (file, expression) row in COMPUTED_IMPORT_ALLOW below — a booking a reviewer
 * signs, not a wildcard. acorn is not a declared dependency of this repo — it
 * rides the toolchain (eslint→espree→acorn; vitest→vite→rollup), and pnpm keeps
 * hoisted deps under node_modules/.pnpm/node_modules, which bare specifiers from
 * the repo root never resolve into; loadAcorn() therefore tries bare resolution
 * first, then that hoist directory. Where acorn cannot be loaded, or where a
 * file is not plain JavaScript (the scanned set carries `.ts`/`.d.mts` type
 * surfaces acorn cannot parse), extraction falls back to the regex path PLUS
 * string-literal masking: comments AND every string/template content that is not
 * in specifier position are blanked BEFORE matching, so the prose-from-literal
 * class cannot recur on the fallback either. Which extractor graded the tree is
 * printed, never silent; an `.mjs` that will not parse is could-not-grade
 * (exit 2), never a quiet skip.
 *
 * Exported for scripts/eb3-ci-negative-controls.mjs (C4):
 *   checkFamilyBoundaries({ files, edges?, computedAllow?, engine? }) → { findings }
 *   LANE_EDGES, COMPUTED_IMPORT_ALLOW, familyLaneOf(), acornAvailable
 *
 *   node scripts/eb3-family-boundaries.mjs [--json] [--engine auto|ast|regex]
 *
 * Exit: 0 no findings | 1 findings | 2 could not grade.
 *
 * @module scripts/eb3-family-boundaries
 */
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')

/**
 * The declared outward edges per lane, transcribed from the lane READMEs. A bare
 * prefix match on the RESOLVED repo-relative target; `*` matches one path segment.
 */
export const LANE_EDGES = Object.freeze({
  'dsh.fs-family': Object.freeze([
    'node:*',
    'packages/contracts/src/*',
    'packages/domain/tool-governance/src/*',
    'packages/runtime/controlled-fs/src/*',
  ]),
  'dsh.process-family': Object.freeze([
    'node:*',
    'packages/contracts/src/*',
    'packages/runtime/sandbox-provider/*',
    // the SIBLING FAMILY public face the process README books (anchor law home)
    'packages/tools/fs-family/src/index.mjs',
    // U7-F: the pwsh row's PA edge reads the frozen effect-vocabulary and
    // fingerprint face (parseRequestedEffectSet, canonicalJsonFingerprint) —
    // the SAME face the fs README books; the process README now says so,
    // and the consumer is booked file-by-file in
    // scripts/audit-a5-tool-governance-imports.mjs + a5p0-layer-audit.
    'packages/domain/tool-governance/src/*',
  ]),
  'dsh.search-family': Object.freeze([
    'node:*',
    '@deepseek-ai/dsh-tool-fs-search',
    'packages/runtime/sandbox-provider/*',
    'packages/runtime/controlled-fs/src/*',
    'packages/contracts/src/*',
    // the two SIBLING FAMILY public faces this lane's README books, by name
    'packages/tools/fs-family/src/index.mjs',
    'packages/tools/process-family/src/index.mjs',
  ]),
  'dsh.u6-probe-family': Object.freeze([
    'node:*',
    'packages/contracts/src/*',
  ]),
  // U7-F: transcribed from packages/tools/inspect-family/README.md. The two
  // sibling edges are PUBLIC faces only (the anchor law and the cancel-leg
  // race, each the one home of its law), and the domain edge is the ONE
  // thin effect-grammar face the fs executors already carry.
  'dsh.inspect-family': Object.freeze([
    'node:*',
    'packages/contracts/src/*',
    'packages/domain/tool-governance/src/*',
    'packages/tools/fs-family/src/index.mjs',
    'packages/tools/search-family/src/index.mjs',
  ]),
  // U7-f (web family lane), transcribed from its README (the law home):
  // the ONE network family rides node builtins for its single bounded
  // transport port, contracts for the closed vocabulary, and the SAME
  // single thin governance face the fs-family executors carry
  // (parseRequestedEffectSet, booked file-by-file in the a5p0 audit).
  // No plane edge, no sibling-family edge, no host internals — network
  // confinement is the admission plane (DECISION-3), so the lane itself
  // claims nothing beyond these three.
  'dsh.web-family': Object.freeze([
    'node:*',
    'packages/contracts/src/*',
    'packages/domain/tool-governance/src/*',
  ]),
  // U7-F (agent-control family), transcribed from
  // packages/tools/agent-control-family/README.md: canonical JSON + the ONE
  // thin effect-grammar face, NOTHING else — no plane, no center, no
  // tool-dispatch, no sibling family (the runtime reaches the rows only
  // through the port face THIS lane declares, never the reverse).
  'dsh.agent-control-family': Object.freeze([
    'node:*',
    'packages/contracts/src/*',
    'packages/domain/tool-governance/src/*',
  ]),
  'dsh.ui-family': Object.freeze([
    'node:*',
    'packages/contracts/src/*',
    // the ONE effect-grammar face, booked consumer-by-consumer in the A5P0
    // layer audit (the two executors; same face the fs executors carry)
    'packages/domain/tool-governance/src/*',
    // the SIBLING FAMILY public face this lane's README books (anchor law
    // home — lexicalAnchor + resolveAnchoredPath; never a sibling internal)
    'packages/tools/fs-family/src/index.mjs',
  ]),
  // U7-F B (agent-state family): the lane README books TWO thin faces only —
  // node builtins and the frozen governance vocabulary/serialization face of
  // domain/tool-governance. NO sibling-family, plane, governance-center,
  // tool-dispatch, or Host edge. `executors.mjs` imports ONLY
  // `parseRequestedEffectSet`; `contribution.mjs` ONLY `canonicalJsonStringify`
  // (both registered file-by-file in audit-a5-tool-governance-imports.mjs +
  // the pinned consumer set). The state-store port is a consumed INTERFACE,
  // injected via cap.injected.agentState — not an import edge — so it adds no
  // outward edge here.
  'dsh.agent-state-family': Object.freeze([
    'node:*',
    'packages/domain/tool-governance/src/*',
  ]),
})

/**
 * Booked COMPUTED dynamic imports (R-DYNIMPORT). `import(expr)` with a non-literal
 * argument has no static target this (or any) import check can grade — so it is a
 * `COMPUTED_DYNAMIC_IMPORT` finding by default, and the table below is the ONLY
 * way to pass one: the pair (repo-relative file, EXACT expression source text)
 * must match. Renaming the variable, or adding a second computed import to a
 * booked file, fails again — this is a booking a reviewer signs per occurrence,
 * not a wildcard.
 *
 * The two rows are the U6 ARC-A probe lane's seam-resolution law, stated in both
 * file headers: CENTER_URL / CONTRACTS_URL are ENV-OVERRIDABLE
 * (`U6ARC_CENTER_URL` / `U6ARC_CONTRACTS_URL`) so the vitest world resolves the
 * repo's TS sources and the real Host world (C2, tests/world-factory) resolves
 * the SHIPPED dist faces — the same public seam in both worlds, zero private API
 * either way; a literal specifier could only pin one of the two resolutions.
 * The lane itself is TEST-ONLY (its README: nothing under product profiles may
 * import it).
 */
export const COMPUTED_IMPORT_ALLOW = Object.freeze({
  'tests/u6-arc-a-probe-family/src/probe-assembly.mjs': Object.freeze([
    'CENTER_URL',
  ]),
  'tests/u6-arc-a-probe-family/src/probe-contribution.mjs': Object.freeze([
    'CONTRACTS_URL',
  ]),
})

/** Which lane a repo-relative path belongs to, if any. */
export function familyLaneOf(path) {
  const m = /^((?:packages\/tools|tests)\/[a-z0-9-]+-family)\//.exec(path)
  return m === null ? null : m[1]
}

const LANE_ID_BY_LANE = Object.freeze({
  'packages/tools/fs-family': 'dsh.fs-family',
  'packages/tools/process-family': 'dsh.process-family',
  'packages/tools/search-family': 'dsh.search-family',
  'packages/tools/web-family': 'dsh.web-family',
  'tests/u6-arc-a-probe-family': 'dsh.u6-probe-family',
  'packages/tools/inspect-family': 'dsh.inspect-family',
  'packages/tools/agent-control-family': 'dsh.agent-control-family',
  'packages/tools/ui-family': 'dsh.ui-family',
  'packages/tools/agent-state-family': 'dsh.agent-state-family',
})

// ───────────────────────────────────────────────── edge extraction
// Primary: the acorn AST — parsing is what makes PROSE unmatchable and COMPUTED
// imports visible. Fallback (and all `.ts`/`.d.mts` type surfaces): the regex path
// with comments stripped AND string/template contents masked before any match.
// See the header for the incident that earned the masking.

/** acorn, if the toolchain provides it. It is not a declared dependency of this
 *  repo: eslint→espree→acorn and vitest→vite→rollup pull it in, and pnpm's
 *  `hoistPattern: '*'` fills node_modules/.pnpm/node_modules — a directory bare
 *  specifiers from the repo root never resolve into. Probe bare first (a plain
 *  hoisted install or a future dependency works unchanged), then that hoist dir.
 *  Null is a supported state: the masked-regex fallback grades the tree and the
 *  run DISCLOSES it, never silently. */
function loadAcorn() {
  const notes = []
  try {
    const mod = createRequire(import.meta.url)('acorn')
    if (mod !== null && typeof mod.parse === 'function') return { acorn: mod, note: null }
    notes.push('bare "acorn" resolved but exposes no parse()')
  } catch (e) {
    notes.push(`bare: ${String(e?.message ?? e).split('\n')[0]}`)
  }
  try {
    const req = createRequire(join(ROOT, 'node_modules', '.pnpm', 'node_modules', '.eb3-probe.cjs'))
    const mod = req('acorn')
    if (mod !== null && typeof mod.parse === 'function') return { acorn: mod, note: null }
    notes.push('pnpm-hoist "acorn" resolved but exposes no parse()')
  } catch (e) {
    notes.push(`pnpm-hoist: ${String(e?.message ?? e).split('\n')[0]}`)
  }
  return { acorn: null, note: notes.join(' ;; ') }
}
const { acorn: ACORN, note: ACORN_NOTE } = loadAcorn()
export const acornAvailable = ACORN !== null

/** acorn parses plain JavaScript; the scanned set also carries `.ts`/`.d.mts`
 *  type surfaces that stay on the masked-regex path (same vocabulary). */
const PLAIN_JS = /\.(?:[cm]?js)$/

/** Comments → spaces (line numbers AND offsets stay stable). The first draft scanned raw
 *  text and read the PROSE `…from "refused" by name…` inside a block comment as an
 *  import of "refused" — a scanner that cannot tell a sentence from an edge would
 *  train people to ignore it. Strings are tracked so a `//` or `/*` inside a
 *  string is not treated as a comment. */
function stripComments(text) {
  let out = ''
  let i = 0
  let quote = null
  while (i < text.length) {
    const c = text[i]
    const n = text[i + 1]
    if (quote !== null) {
      out += c
      if (c === '\\') { out += n ?? ''; i += 2; continue }
      if (c === quote) quote = null
      i += 1
      continue
    }
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') { out += ' '; i += 1 } continue }
    if (c === '/' && n === '*') {
      const end = text.indexOf('*/', i + 2)
      const chunk = end === -1 ? text.slice(i) : text.slice(i, end + 2)
      out += chunk.replace(/[^\n]/g, ' ') // keep line numbers stable
      i = end === -1 ? text.length : end + 2
      continue
    }
    if (c === '"' || c === "'" || c === '`') quote = c
    out += c
    i += 1
  }
  return out
}

/** Length- and line-preserving MASK of `stripped`: every string/template
 *  literal's CONTENT is blanked to spaces and each literal is recorded as
 *  { open, close, quote, raw }. Prose inside a string can therefore never open a
 *  second, invisible string: the masked text holds exactly the literals the code
 *  has, at their real positions, and a specifier regex can only ever hit a
 *  literal that sits in code position. Same quote-state fidelity as
 *  stripComments (a quote inside a REGEX literal stays a known fallback
 *  limitation, exactly as before this rewrite — the AST path is immune). */
function maskStrings(stripped) {
  const literals = []
  let out = ''
  let i = 0
  let quote = null
  let open = -1
  while (i < stripped.length) {
    const c = stripped[i]
    const n = stripped[i + 1]
    if (quote !== null) {
      if (c === '\\') { out += ' ' + (n === '\n' ? '\n' : ' '); i += 2; continue }
      if (c === quote) {
        literals.push({ open, close: i, quote, raw: stripped.slice(open + 1, i) })
        out += c
        quote = null
        i += 1
        continue
      }
      out += c === '\n' ? '\n' : ' '
      i += 1
      continue
    }
    if (c === '"' || c === "'" || c === '`') { quote = c; open = i }
    out += c
    i += 1
  }
  return { masked: out, literals }
}

/** What may precede a SPECIFIER (the alternatives the old raw-text regex used,
 *  now anchored at the END of the masked code run, so only a `from` / `import(` /
 *  `require(` / line-leading side-effect `import` in CODE position qualifies).
 *  Non-global on purpose: `$` anchors at the slice end and exec() stays
 *  stateless. */
const SPEC_POSITION = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|(?:^|\n)[ \t]*import\s*)$/

/** Matching close-paren of the `(` at openIdx — over the MASKED text, where
 *  string/comment contents are blanked, so depth counting cannot be fooled. */
function closeParen(masked, openIdx) {
  let d = 0
  for (let j = openIdx; j < masked.length; j += 1) {
    if (masked[j] === '(') d += 1
    else if (masked[j] === ')') { d -= 1; if (d === 0) return j }
  }
  return -1
}

const flat = (s) => s.replace(/\s+/g, ' ').trim()
const lineAt = (text, idx) => text.slice(0, idx).split('\n').length

/** The fallback extractor: units (literal `spec`s and `computed` dynamic
 *  imports) in source order. Literal string/templates are edges (the old path
 *  never saw backtick specs at all — strictly more coverage, nothing removed);
 *  a template WITH a substitution is a computed import, fail-closed. */
function extractUnitsScanner(text) {
  const stripped = stripComments(text)
  const { masked, literals } = maskStrings(stripped)
  const units = []
  for (const lit of literals) {
    const sliceStart = Math.max(0, lit.open - 48)
    const m = SPEC_POSITION.exec(masked.slice(sliceStart, lit.open))
    if (m === null) continue // PROSE / data — never an edge
    const at = sliceStart + m.index + (m[0].includes('import') ? m[0].indexOf('import') : 0)
    if (lit.quote !== '`' || !lit.raw.includes('${')) { units.push({ at, kind: 'spec', spec: lit.raw }); continue }
    units.push({ at, kind: 'computed', line: lineAt(stripped, at), expr: flat(stripped.slice(lit.open, lit.close + 1)) })
  }
  for (const m of masked.matchAll(/(^|[^\w$.])import\s*\(\s*/g)) {
    const at = m.index + m[1].length
    if (masked[m.index + m[0].length] === "'" || masked[m.index + m[0].length] === '"' || masked[m.index + m[0].length] === '`') continue // literal/template graded above
    const openIdx = masked.indexOf('(', at)
    const closeIdx = closeParen(masked, openIdx)
    if (closeIdx === -1) continue // unbalanced parens: the AST path exits 2 on that file; the regex path has no target to report either
    units.push({ at, kind: 'computed', line: lineAt(stripped, at), expr: flat(stripped.slice(m.index + m[0].length, closeIdx)) })
  }
  return units.sort((a, b) => a.at - b.at)
}

/** The primary extractor: parse, do not pattern-match. The prose-from-literal
 *  class cannot exist here, and a non-literal ImportExpression — the shape no
 *  regex could ever see — becomes a graded, fail-closed unit. */
function extractUnitsAst(text) {
  const ast = ACORN.parse(text, { ecmaVersion: 'latest', sourceType: 'module', locations: true })
  const litSpec = (n) => (n !== null && n !== undefined && n.type === 'Literal' && typeof n.value === 'string') ? n.value : undefined
  const units = []
  const stack = [ast]
  while (stack.length > 0) {
    const node = stack.pop()
    if (node === null || typeof node !== 'object') continue
    if (Array.isArray(node)) { for (const child of node) stack.push(child); continue }
    if (typeof node.type === 'string') {
      if (node.type === 'ImportDeclaration' || node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') {
        const spec = litSpec(node.source)
        if (spec !== undefined) units.push({ at: node.source.start, kind: 'spec', spec })
      } else if (node.type === 'ImportExpression') {
        const s = node.source
        const spec = litSpec(s)
        if (spec !== undefined) units.push({ at: node.start, kind: 'spec', spec })
        else if (s.type === 'TemplateLiteral' && s.expressions.length === 0) units.push({ at: node.start, kind: 'spec', spec: s.quasis[0].value.cooked ?? s.quasis[0].value.raw })
        else units.push({ at: node.start, kind: 'computed', line: node.loc.start.line, expr: flat(text.slice(s.start, s.end)) })
      } else if (node.type === 'CallExpression' && node.callee?.type === 'Identifier' && node.callee.name === 'require' && node.arguments.length === 1) {
        const spec = litSpec(node.arguments[0])
        if (spec !== undefined) units.push({ at: node.start, kind: 'spec', spec }) // parity with the old regex; a computed require is not a callable thing in these ESM lanes
      }
    }
    for (const key of Object.keys(node)) {
      if (key === 'loc' || key === 'start' || key === 'end' || key === 'range') continue
      const v = node[key]
      if (v !== null && typeof v === 'object') stack.push(v)
    }
  }
  return units.sort((a, b) => a.at - b.at)
}

/** Extract one file. `engine`: 'auto' = AST wherever acorn parses plain JS,
 *  masked-regex everywhere else (the `.ts` surfaces, and the whole tree when
 *  acorn is unresolvable); 'regex' forces the fallback — what CI without a
 *  hoisted acorn runs is therefore tested even on hosts that have acorn; 'ast'
 *  asserts acorn is present and prefers it per file. A plain `.mjs` that will
 *  NOT parse throws — could-not-grade, never a quiet skip. */
function extractUnits(path, text, engine) {
  if (engine !== 'regex' && ACORN !== null && PLAIN_JS.test(path)) return extractUnitsAst(text)
  if (engine === 'ast' && ACORN === null) throw new Error(`engine=ast requested but acorn is unresolvable under node_modules (${ACORN_NOTE})`)
  return extractUnitsScanner(text)
}

/** Repo-relative static imports/re-exports of one file. Relative specifiers are
 *  resolved against the file's directory; bare specifiers are reported as-is. */
function resolveSpec(path, spec) {
  if (!spec.startsWith('.')) return { spec, resolved: spec }
  const dir = path.slice(0, path.lastIndexOf('/'))
  const parts = `${dir}/${spec}`.split('/')
  const out = []
  for (const p of parts) {
    if (p === '.' || p === '') continue
    if (p === '..') out.pop()
    else out.push(p)
  }
  // TS/JS extension normalisation: `x.js` in source means `x.ts` on disk.
  const joined = out.join('/')
  return { spec, resolved: joined.replace(/\.js$/, '.ts') }
}

function edgeAllows(edge, target) {
  if (edge === target) return true
  if (edge.endsWith('*')) {
    const prefix = edge.slice(0, -1)
    if (target.startsWith(prefix)) return true
  }
  // `packages/contracts/src/*` admits a direct member, not a deep descent through
  // another package's tree; keep the rule honest by requiring the target to stay
  // inside the prefix.
  return false
}

/**
 * @param {object} p
 * @param {Map<string,string>} p.files   repo-relative path → text (family lane sources)
 * @param {object} [p.edges]             defaults to LANE_EDGES
 * @param {object} [p.computedAllow]     defaults to COMPUTED_IMPORT_ALLOW
 * @param {'auto'|'ast'|'regex'} [p.engine] extraction engine (default auto)
 */
export function checkFamilyBoundaries({ files, edges = LANE_EDGES, computedAllow = COMPUTED_IMPORT_ALLOW, engine = 'auto' }) {
  const findings = []
  for (const [path, text] of files) {
    const lane = familyLaneOf(path)
    if (lane === null) continue
    const laneId = LANE_ID_BY_LANE[lane]
    const allowed = laneId !== undefined ? edges[laneId] : undefined
    if (allowed === undefined) {
      findings.push({ code: 'FAMILY_CROSS_INFLUENCE', path, detail: `${path}: lane ${lane} declares no inward/outward edge list in ${'scripts/eb3-family-boundaries.mjs'} — an unbooked lane cannot be graded` })
      continue
    }
    const ownSrc = `${lane}/src/`
    for (const unit of extractUnits(path, text, engine)) {
      if (unit.kind === 'computed') {
        if ((computedAllow[path] ?? []).includes(unit.expr)) continue
        findings.push({ code: 'COMPUTED_DYNAMIC_IMPORT', path, line: unit.line, detail: `${path}:${String(unit.line)}: import(${unit.expr}) is a computed dynamic import — its target is invisible to a static boundary audit; make the specifier literal, or have a reviewer book the exact (file, expression) row in COMPUTED_IMPORT_ALLOW` })
        continue
      }
      const imp = resolveSpec(path, unit.spec)
      const target = imp.resolved
      // own lane: everything is allowed
      if (target.startsWith(ownSrc)) continue
      if (!target.startsWith('packages/') && !target.startsWith('tests/')) {
        // bare specifier (host public package, node builtin) — graded by the list
        if (allowed.some((e) => edgeAllows(e, target))) continue
        findings.push({ code: 'FAMILY_CROSS_INFLUENCE', path, detail: `${path}: imports "${imp.spec}" which ${laneId} does not declare as an allowed outward edge` })
        continue
      }
      if (allowed.some((e) => edgeAllows(e, target))) continue
      const sibling = familyLaneOf(target)
      const kind = sibling !== null
        ? (target.startsWith(`${sibling}/src/index.`) ? 'sibling-public-face-not-booked' : 'sibling-internals')
        : target.startsWith('packages/runtime/src/plugin/')
          ? 'centre-ward (a family lane must not import the assembly that mounts it)'
          : 'undeclared'
      findings.push({ code: 'FAMILY_CROSS_INFLUENCE', path, detail: `${path}: imports "${imp.spec}" -> ${target} [${kind}] — ${laneId} declares no such edge` })
    }
  }
  return { findings }
}

/** Tracked family-lane source files. */
export function trackedLanePaths(root = ROOT) {
  const out = execFileSync('git', ['-C', root, 'ls-files', '-z', 'packages/tools', 'tests'], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return out.split('\0').filter((p) => p.length > 0
    && familyLaneOf(p) !== null
    && /\/src\/.*\.(mjs|ts|mts)$/.test(p)
    && !p.includes('/dist/')).sort()
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const json = process.argv.includes('--json')
  const eIdx = process.argv.indexOf('--engine')
  const engine = eIdx > -1 ? String(process.argv[eIdx + 1] ?? '') : 'auto'
  if (!['auto', 'ast', 'regex'].includes(engine)) {
    console.error(`EB3-FAMILY-BOUNDARIES refused could-not-grade: --engine must be auto|ast|regex (got "${engine}")`)
    process.exit(2)
  }
  // WHICH extractor graded the tree is part of the verdict, never implied.
  const extractor = engine === 'regex'
    ? `regex+string-masking${ACORN === null ? ' (acorn unresolvable)' : ' (engine=regex: forced fallback)'}`
    : ACORN === null
      ? `regex+string-masking (acorn unresolvable: ${ACORN_NOTE})`
      : `acorn ${String(ACORN.version)} (masked-regex fallback for non-JS surfaces)`
  let out
  try {
    const paths = trackedLanePaths(ROOT)
    const files = new Map(paths.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')]))
    out = { files: files.size, engine, extractor, ...checkFamilyBoundaries({ files, engine }) }
  } catch (e) {
    console.error(`EB3-FAMILY-BOUNDARIES refused could-not-grade: ${String(e?.message ?? e)}`)
    process.exit(2)
  }
  if (json) console.log(JSON.stringify(out, null, 2))
  else {
    for (const f of out.findings) console.log(`  ${f.code} ${f.detail}`)
    console.log(`EB3-FAMILY-BOUNDARIES ${out.findings.length === 0 ? 'pass' : 'fail'} files=${String(out.files)} findings=${String(out.findings.length)} engine=${out.engine} extractor=${out.extractor}`)
  }
  process.exit(out.findings.length === 0 ? 0 : 1)
}
