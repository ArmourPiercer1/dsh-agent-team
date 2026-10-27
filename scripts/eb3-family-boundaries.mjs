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
 * Exported for scripts/eb3-ci-negative-controls.mjs (C4):
 *   checkFamilyBoundaries({ files, edges? }) → { findings }
 *   LANE_EDGES, familyLaneOf()
 *
 *   node scripts/eb3-family-boundaries.mjs [--json]
 *
 * Exit: 0 no findings | 1 findings | 2 could not grade.
 *
 * @module scripts/eb3-family-boundaries
 */
import { readFileSync } from 'node:fs'
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
  'tests/u6-arc-a-probe-family': 'dsh.u6-probe-family',
})

/** Repo-relative static imports/re-exports of one file. Relative specifiers are
 *  resolved against the file's directory; bare specifiers are reported as-is. */
/** Comments removed, string/template contents kept. The first draft scanned raw
 *  text and read the PROSE `…from "refused" by name…` inside a block comment as an
 *  import of "refused" — a scanner that cannot tell a sentence from an edge would
 *  train people to ignore it. Strings are kept so `from './x.mjs'` still parses;
 *  a `//` or `/*` inside a string is not treated as a comment. */
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
    if (c === '/' && n === '/') { while (i < text.length && text[i] !== '\n') i += 1; continue }
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

function importsOf(path, text) {
  const specs = []
  const re = /(?:\bfrom\s*|\bimport\s*\(\s*|\brequire\s*\(\s*|^\s*import\s*)['"]([^'"]+)['"]/gm
  for (const m of stripComments(text).matchAll(re)) specs.push(m[1])
  const dir = path.slice(0, path.lastIndexOf('/'))
  return specs.map((spec) => {
    if (!spec.startsWith('.')) return { spec, resolved: spec }
    const parts = `${dir}/${spec}`.split('/')
    const out = []
    for (const p of parts) {
      if (p === '.' || p === '') continue
      if (p === '..') out.pop()
      else out.push(p)
    }
    // TS/JS extension normalisation: `x.js` in source means `x.ts` on disk.
    const joined = out.join('/')
    return { spec, resolved: joined.replace(/\.js$/, '.ts'), raw: joined }
  })
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
 */
export function checkFamilyBoundaries({ files, edges = LANE_EDGES }) {
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
    for (const imp of importsOf(path, text)) {
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
  let out
  try {
    const paths = trackedLanePaths(ROOT)
    const files = new Map(paths.map((p) => [p, readFileSync(join(ROOT, p), 'utf8')]))
    out = { files: files.size, ...checkFamilyBoundaries({ files }) }
  } catch (e) {
    console.error(`EB3-FAMILY-BOUNDARIES refused could-not-grade: ${String(e?.message ?? e)}`)
    process.exit(2)
  }
  if (json) console.log(JSON.stringify(out, null, 2))
  else {
    for (const f of out.findings) console.log(`  ${f.code} ${f.detail}`)
    console.log(`EB3-FAMILY-BOUNDARIES ${out.findings.length === 0 ? 'pass' : 'fail'} files=${String(out.files)} findings=${String(out.findings.length)}`)
  }
  process.exit(out.findings.length === 0 ? 0 : 1)
}
