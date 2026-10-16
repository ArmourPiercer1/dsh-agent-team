// @ts-check
/**
 * Alpha.5 PR0 — import-cycle & cross-layer audit for the `tool-governance`
 * lane (implementation plan §3: "循环依赖/跨层 imports 审计").
 *
 * Run:  node scripts/audit-a5-tool-governance-imports.mjs          (exit 1 on findings)
 * Used by: packages/domain/test/a5p0-layer-audit.test.ts (the gate that runs it)
 *
 * THE LAW AUDITED:
 *  1. `packages/domain/tool-governance/**` is PURE DOMAIN: no `node:*`, no
 *     `@deepseek-ai/*`, no other workspace package (contracts/storage/runtime/
 *     …). Its only outward domain edges are the two sanctioned leaves:
 *     `domain/authority-envelope` (the shared Alpha.4 lattice — REUSE, not a
 *     second algebra) and `domain/blueprint/src/hash.ts` (sha256Hex).
 *  2. NO CYCLE: the module graph (including the visited leaf edges) must be
 *     acyclic.
 *  3. ZERO PRODUCTION CONSUMER (PR0 dormancy, plan §3 "零生产行为变化"): no
 *     shipped source file outside the lane itself imports it — PR1+ must wire
 *     it as a reviewed change, not by accretion.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url))
const PACKAGES = join(REPO_ROOT, 'packages')
const LANE = join(PACKAGES, 'domain', 'tool-governance')

/** Specifiers the lane may point at outside itself. */
const PERMITTED_OUTSIDE = [
  'domain/authority-envelope/src/index.js',
  'domain/blueprint/src/hash.js',
]

const SPECIFIER_PATTERNS = [
  /\bfrom\s+['"]([^'"]+)['"]/g,
  /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^\s*import\s+['"]([^'"]+)['"]/gm,
]

/** Comment stripper with a3p3's over-stripping direction (line comments
 *  first, then block comments whose opener starts a line): prose may stop
 *  counting as an edge, an edge can never be erased. */
function codeOnly(source) {
  return source.replace(/^\s*\/\/.*$/gm, ' ').replace(/^\s*\/\*[\s\S]*?\*\//gm, ' ')
}

/** @param {string} source @returns {string[]} */
function specifiersIn(source) {
  /** @type {string[]} */
  const out = []
  for (const pattern of SPECIFIER_PATTERNS) {
    for (const match of codeOnly(source).matchAll(pattern)) {
      const spec = match[1]
      if (typeof spec === 'string') out.push(spec)
    }
  }
  return out
}

/** @param {string} dir @returns {string[]} */
function walkTs(dir, into = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const st = statSync(full)
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === 'dist' || entry.startsWith('dist.')) continue
      walkTs(full, into)
      continue
    }
    if (!entry.endsWith('.ts') || entry.endsWith('.d.ts') || entry.endsWith('.test.ts')) continue
    into.push(full)
  }
  return into
}

/** Resolve a relative specifier (with `.js` → `.ts` rewriting) to a repo path. */
function resolveSpecifier(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null
  let target = join(fromFile, '..', specifier)
  if (target.endsWith('.js')) target = `${target.slice(0, -3)}.ts`
  return target
}

/**
 * @returns {{ findings: string[]; edgeCount: number; laneFiles: number }}
 */
export function auditA5ToolGovernanceImports() {
  /** @type {string[]} */
  const findings = []
  const laneFiles = walkTs(LANE, [])
  if (laneFiles.length === 0) return { findings: ['tool-governance lane has no sources — the audit is vacuous'], edgeCount: 0, laneFiles: 0 }

  /** @type {Map<string, string[]>} */
  const graph = new Map()
  let edgeCount = 0

  const visit = /** @type {(file: string) => void} */ (file => {
    if (graph.has(file)) return
    const deps = /** @type {string[]} */ ([])
    graph.set(file, deps)
    const source = readFileSync(file, 'utf8')
    for (const specifier of specifiersIn(source)) {
      const resolved = resolveSpecifier(file, specifier)
      if (resolved === null) {
        // Non-relative: what remains must be nothing at all.
        if (specifier.startsWith('node:')) findings.push(`${relative(REPO_ROOT, file)} -> ${specifier} (node: is not pure domain)`)
        else findings.push(`${relative(REPO_ROOT, file)} -> ${specifier} (bare specifiers are forbidden in the lane)`)
        continue
      }
      // Which sanctioned-outside entry does this resolve to (if any)?
      const resolvedRelFromPackages = relative(PACKAGES, resolved).split(sep).join('/')
      const insideLane = resolved.startsWith(LANE)
      const permitted = PERMITTED_OUTSIDE.some((p) => p.replace(/\.js$/, '.ts') === resolvedRelFromPackages)
      if (!insideLane && !permitted) {
        findings.push(`${relative(REPO_ROOT, file)} -> ${resolvedRelFromPackages} (cross-layer edge)`)
        continue
      }
      edgeCount += 1
      deps.push(resolved)
      if (insideLane) visit(resolved)
      // Sanctioned OUTSIDE targets are TERMINAL nodes of this graph: their own
      // imports belong to their lanes (authority-envelope's leaf law is pinned
      // by `a3p3-governance-lane-hygiene`; `blueprint/src/hash.ts` reaches only
      // contracts, which never imports back into domain).
    }
  })
  for (const file of laneFiles) visit(file)

  // Cycle detection over the whole visited graph (DFS colours).
  const WHITE = 0, GRAY = 1, BLACK = 2
  /** @type {Map<string, number>} */
  const colour = new Map()
  /** @type {(file: string, stack: string[]) => void} */
  const dfs = (file, stack) => {
    colour.set(file, GRAY)
    for (const dep of graph.get(file) ?? []) {
      const c = colour.get(dep) ?? WHITE
      if (c === GRAY) {
        findings.push(`cycle: ${[...stack.slice(stack.indexOf(file)), file, dep].map(f => relative(REPO_ROOT, f)).join(' -> ')}`)
      } else if (c === WHITE && graph.has(dep)) {
        dfs(dep, [...stack, file])
      }
    }
    colour.set(file, BLACK)
  }
  for (const file of graph.keys()) if ((colour.get(file) ?? WHITE) === WHITE) dfs(file, [])

  // ZERO PRODUCTION CONSUMER: no shipped source outside the lane imports it.
  const consumerWalk = /** @type {(dir: string) => void} */ (dir => {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const st = statSync(full)
      if (st.isDirectory()) {
        if (entry === 'node_modules' || entry === 'test' || entry === 'dist' || entry.startsWith('dist.')) continue
        if (full === LANE) continue
        consumerWalk(full)
        continue
      }
      if (!entry.endsWith('.ts') || entry.endsWith('.d.ts') || entry.endsWith('.test.ts')) continue
      const source = readFileSync(full, 'utf8')
      if (/tool-governance/.test(source)) {
        findings.push(`production consumer of tool-governance: ${relative(REPO_ROOT, full)} (PR0 is DORMANT by contract)`)
      }
    }
  })
  for (const pkg of readdirSync(PACKAGES)) consumerWalk(join(PACKAGES, pkg))

  return { findings, edgeCount, laneFiles: laneFiles.length }
}

if (process.argv[1] !== undefined && relative(REPO_ROOT, process.argv[1]).replace(/\\/g, '/') === 'scripts/audit-a5-tool-governance-imports.mjs') {
  const { findings, edgeCount, laneFiles } = auditA5ToolGovernanceImports()
  console.log(`tool-governance audit: ${laneFiles} lane files, ${edgeCount} edges`)
  if (findings.length > 0) {
    for (const f of findings) console.error(`FINDING: ${f}`)
    process.exitCode = 1
  } else {
    console.log('OK: pure-domain lane, no cycles, zero production consumers')
  }
}
