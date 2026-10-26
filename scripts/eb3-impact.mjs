#!/usr/bin/env node
/**
 * eb3-impact.mjs — EB3-A: the change-impact graph.
 *
 * The plan's requirement, verbatim: "变更影响图对未知影响非零选择" — a change-impact
 * graph whose selection on UNKNOWN impact is NON-ZERO. The failure this closes is
 * the ordinary one: a selector that recognises nothing selects nothing, the CI
 * reports "no relevant changes", and the merge is green because the gate never
 * looked. Here UNKNOWN is not an empty answer — it is the `unknown` set, which is
 * the full layered CI.
 *
 * TWO ENTRY POINTS, ONE SELECTION LAW (the plan's E3 exit: "CI 与本地同一个选择
 * 逻辑" — CI and local must run the same selection logic):
 *
 *   node scripts/eb3-impact.mjs --base <verified-ref>     committed + worktree changes
 *   node scripts/eb3-impact.mjs --paths <a,b,c>           explicit (controls, debugging)
 *   node scripts/eb3-impact.mjs --base <ref> --github-output
 *                                                        also writes layers=/checks= to
 *                                                        $GITHUB_OUTPUT for the workflows
 *
 * UNION, NOT FIRST-MATCH. A path selects the UNION of every rule that matches it.
 * dev/engineering/doc-ownership.yaml picks the single most specific rule because a
 * document has one owner; an impact graph must not, because a narrower rule matching
 * is no reason to drop a broader rule's checks (measured: see selectImpact). The
 * specificity order is kept only to make the printed explanation readable.
 *
 * WHAT IT DOES NOT DO. It does not decide whether a layer PASSES; it decides which
 * layers are worth running. And it never lets the selection be empty: `always` is
 * added unconditionally, and an unparseable graph/missing base is a REFUSAL (exit
 * 2), never "no changes".
 *
 * Verdict channel, so a transcript can be graded:
 *   EB3-IMPACT selection=<layers comma> unknown=<n> files=<n> base=<ref|none>
 *
 * Exported for scripts/eb3-ci-negative-controls.mjs:
 *   selectImpact({ paths, graph? }) → { layers, checks, unknownPaths, matched }
 *   IMPACT_GRAPH_REL, loadGraph(), GLOB_LANGUAGE_NOTE
 *
 * Exit: 0 selection made | 2 could not select (missing base, bad graph).
 *
 * @module scripts/eb3-impact
 */
import { existsSync, readFileSync, appendFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execFileSync } from 'node:child_process'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const IMPACT_GRAPH_REL = 'dev/ci/eb3-impact-graph.json'

export const GLOB_LANGUAGE_NOTE =
  'Globs are `*` (one path segment) and `**` (any depth), anchored at the repo root. ' +
  'A pattern with no `/` matches a BASENAME at any depth (the same rule glob() uses elsewhere in ' +
  'this repo), so `*.md` is every markdown file and `docs/**/*.md` is the docs tree only.'

export function loadGraph(root = ROOT) {
  const abs = join(root, IMPACT_GRAPH_REL)
  if (!existsSync(abs)) throw new Error(`EB3 impact graph absent: ${IMPACT_GRAPH_REL}`)
  const g = JSON.parse(readFileSync(abs, 'utf8'))
  if (g.schema !== 'eb3-impact-graph/1') throw new Error(`${IMPACT_GRAPH_REL}: unknown schema ${String(g.schema)}`)
  if (!Array.isArray(g.rules)) throw new Error(`${IMPACT_GRAPH_REL}: no rules`)
  if (!g.unknown || !Array.isArray(g.unknown.layers) || g.unknown.layers.length === 0) {
    throw new Error(`${IMPACT_GRAPH_REL}: the "unknown" set must select at least one layer — unknown impact may never be zero`)
  }
  return g
}

/** Compile one graph glob to a RegExp. `**` crosses separators, `*` does not; a
 *  pattern with no `/` matches the basename at any depth. */
export function globToRegExp(glob) {
  const hasSlash = glob.includes('/')
  let re = ''
  for (let i = 0; i < glob.length; i += 1) {
    const c = glob[i]
    if (c === '*' && glob[i + 1] === '*') {
      // `**/` swallows the separator too, so `a/**/b` matches `a/b`.
      if (glob[i + 2] === '/') { re += '(?:.*/)?'; i += 2 } else { re += '.*'; i += 1 }
      continue
    }
    if (c === '*') { re += '[^/]*'; continue }
    if ('\\^$.|?+()[]{}'.includes(c)) { re += `\\${c}`; continue }
    re += c
  }
  return new RegExp(hasSlash ? `^${re}$` : `(?:^|/)${re}$`)
}

/** Specificity key: fewer wildcards, then longer static prefix, then order. */
function specificity(glob) {
  const stars = (glob.match(/\*/g) ?? []).length
  const firstStar = glob.indexOf('*')
  const prefix = firstStar === -1 ? glob.length : firstStar
  return { stars, prefix }
}

/**
 * @param {object} p
 * @param {string[]} p.paths   repo-relative posix paths (may be empty)
 * @param {object} [p.graph]   defaults to the tracked graph
 */
export function selectImpact({ paths, graph = loadGraph() }) {
  const rules = graph.rules.map((r, i) => ({ ...r, i, rx: globToRegExp(r.glob), spec: specificity(r.glob) }))
  const layers = new Set(graph.always?.layers ?? [])
  const checks = new Set(graph.always?.checks ?? [])
  const unknownPaths = []
  const matched = []

  for (const path of paths) {
    const hits = rules.filter((r) => r.rx.test(path))
    if (hits.length === 0) {
      unknownPaths.push(path)
      for (const l of graph.unknown.layers) layers.add(l)
      for (const c of graph.unknown.checks ?? []) checks.add(c)
      continue
    }
    // UNION OF EVERY MATCHING RULE. The first draft took only the most specific rule
    // (the doc-ownership law), and measured on its own smoke run: a Family-lane path
    // `packages/tools/fs-family/src/x.mjs` resolved to `packages/**` (one `*` beats
    // the two of `packages/tools/*-family/**`) and SILENTLY DROPPED the
    // family-definitions/boundaries checks — a selection narrowed by a tie-break
    // nobody wrote down. Doc ownership wants one owner; impact wants everything that
    // could be hit, and a broader rule's checks are never less relevant because a
    // narrower rule also matched. Specificity now only ORDERS the explanation.
    hits.sort((a, b) => a.spec.stars - b.spec.stars || b.spec.prefix - a.spec.prefix || a.i - b.i)
    matched.push({ path, glob: hits.map((h) => h.glob).join(' + ') })
    for (const h of hits) {
      for (const l of h.layers ?? []) layers.add(l)
      for (const c of h.checks ?? []) checks.add(c)
    }
  }
  return { layers: [...layers].sort(), checks: [...checks].sort(), unknownPaths, matched }
}

/** `git diff --name-only` between the merge base of `base` and the worktree HEAD,
 *  plus staged/unstaged/untracked — the same scope docs:probe uses. */
export function changedPaths(root, base) {
  const git = (args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8' })
  const lines = (s) => s.split('\n').map((l) => l.trim()).filter(Boolean)
  const mb = lines(git(['merge-base', base, 'HEAD']))[0]
  if (mb === undefined) throw new Error(`base unresolvable: ${base}`)
  return [...new Set([
    ...lines(git(['diff', '--name-only', `${mb}..HEAD`])),
    ...lines(git(['diff', '--name-only', '--cached'])),
    ...lines(git(['diff', '--name-only'])),
    ...lines(git(['ls-files', '--others', '--exclude-standard'])),
  ])].sort()
}

// ───────────────────────────────────────────────────────────────────────── CLI
const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const argv = process.argv.slice(2)
  const arg = (name) => { const i = argv.indexOf(name); return i > -1 ? argv[i + 1] : null }
  const base = arg('--base')
  const explicit = arg('--paths')
  const githubOutput = argv.includes('--github-output')
  const json = argv.includes('--json')

  let paths
  try {
    if (explicit !== null) paths = explicit.split(',').map((s) => s.trim()).filter(Boolean)
    else if (base !== null) paths = changedPaths(ROOT, base)
    else {
      console.error('EB3-IMPACT REFUSED NO_BASE: give --base <verified-ref> or --paths <a,b,c>. "No base" is never "no changes".')
      process.exit(2)
    }
  } catch (e) {
    console.error(`EB3-IMPACT REFUSED BASE_UNRESOLVABLE: ${String(e?.message ?? e)}`)
    process.exit(2)
  }

  let sel
  try {
    sel = selectImpact({ paths })
  } catch (e) {
    console.error(`EB3-IMPACT REFUSED GRAPH_UNREADABLE: ${String(e?.message ?? e)}`)
    process.exit(2)
  }

  // NON-ZERO IS THE CONTRACT, re-asserted at the exit rather than trusted from the
  // data: `always` could be emptied by an edit, and an empty selection that reached
  // the workflows would skip every layer while reporting success.
  if (sel.layers.length === 0) {
    console.error('EB3-IMPACT REFUSED EMPTY_SELECTION: the graph selected zero layers; UNKNOWN impact may never select nothing')
    process.exit(2)
  }

  const line = `EB3-IMPACT selection=${sel.layers.join(',')} checks=${sel.checks.join(',') || 'none'} unknown=${String(sel.unknownPaths.length)} files=${String(paths.length)} base=${base ?? 'explicit-paths'}`
  if (json) console.log(JSON.stringify({ ...sel, paths, base }, null, 2))
  else {
    console.log(line)
    if (sel.unknownPaths.length > 0) {
      console.log(`  UNKNOWN IMPACT (${String(sel.unknownPaths.length)}) — none of these paths match a rule, so the full layered CI is selected: ${sel.unknownPaths.slice(0, 10).join(', ')}${sel.unknownPaths.length > 10 ? ` (+${String(sel.unknownPaths.length - 10)} more)` : ''}`)
    }
    for (const m of sel.matched) console.log(`  ${m.path} -> ${m.glob}`)
  }
  if (githubOutput) {
    const target = process.env['GITHUB_OUTPUT']
    if (target === undefined) { console.error('EB3-IMPACT REFUSED: --github-output needs $GITHUB_OUTPUT'); process.exit(2) }
    appendFileSync(target, `layers=${sel.layers.join(',')}\nchecks=${sel.checks.join(',')}\nunknown=${String(sel.unknownPaths.length)}\n`)
  }
  process.exit(0)
}
