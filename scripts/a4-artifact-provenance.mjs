/**
 * a4-artifact-provenance.mjs — when a gate leg finds a declared artifact MISSING, is the
 * honest answer `failed` or `refused`? A4-PR7 review round, task #2 (B1's clean-worktree
 * report), and the reason the question has an answer at all.
 *
 * WHY THIS IS A MODULE AND NOT A SENTENCE IN A TEST. Two specs ask the question —
 * `a4p75-composition-smoke-classification.test.ts` (which runs the real composition gate
 * against this repository) and `a4p7-merge-gate.test.ts` (§7.6's merge gate) — and a
 * predicate that decides whether a red is "the build regressed" or "this checkout was
 * never built" must not exist twice. Two copies drift, and the drift is invisible: both
 * would keep passing, one of them on a tree the other had never seen. Same reason
 * `client-composition-surface.mjs` exists.
 *
 * THE FOUR CANDIDATE PREDICATES, and what each measured (all measurements are in
 * `dev/agent-workflow/evidence/a4-pr7/instrument-tree-shape/`, taken in a fresh worktree
 * at 69f7fdad with `pnpm install` and no build):
 *
 *   1. "does any build output exist in the tree at all?" — useless as asked. This
 *      repository COMMITS two build-output directories (`packages/runtime/dist` 1505
 *      files, `packages/client/composition-shim` 3 files, both tracked, both in
 *      `INSTALL_SURFACES`), so a workspace-wide "is there a dist?" test is TRUE in a tree
 *      that has never been built. Refined to the TARGET's own output root, below, it works.
 *   2. "does the manifest's main/exports resolve?" — fires in both cases. The client
 *      package declares `main: ./dist/index.js` and in an unbuilt tree that path has no
 *      file; it also has no file after a build that emitted nothing. It is good
 *      DISCLOSURE (this module prints it) and a bad DECIDER.
 *   3. "does the leg's own closure gate already know the difference?" — partly. The gate
 *      distinguishes "target applicable, closure unresolvable" (`SKIP … host module
 *      closure unavailable — N unresolvable: …`) from "target applicable, artifact absent"
 *      (`FAIL …: built entry is missing — run \`pnpm build\` first`). It has no word for
 *      why the artifact is absent, because a gate with two states must pick the strict one
 *      and "a missing artifact is a failure, never a skip" is the right call FOR A GATE.
 *      That decision is not reopened here; what is added is the third answer at the layer
 *      that reads the report.
 *   4. "is a fresh clone of a released tree distinguishable from a fresh worktree of a
 *      source tree?" — NO, and that is the load-bearing finding. Both carry the same two
 *      committed surfaces and neither carries `packages/client/dist`, which is gitignored
 *      AND absent from the root `package.json` `files` whitelist, so no install of this
 *      repository ever contains it. The two trees are byte-identical for this purpose, so
 *      no on-disk predicate may claim to tell them apart.
 *
 * THE PREDICATE THAT SURVIVES THE MEASUREMENT, in the strictest form that is still
 * honest: `refused` is issued only on POSITIVE evidence that the target's build output has
 * never been emitted in this tree — its output root is absent (or exists empty), the path
 * is gitignored and untracked, and it lies in no install surface. Every other absence is
 * `failed`: a tracked or shipped artifact (its absence is a defect, never a tree shape), a
 * partial output root (a build ran here and produced a surface that is wrong), or an
 * unreadable provenance (this module could not answer, which is not evidence of innocence).
 *
 * AND WHY THAT IS NOT A SKIP WEARING BETTER VOCABULARY: `refused` is not green anywhere in
 * this phase — §7.6 reads `verdict === 'passed'` and nothing else, so a refusal blocks the
 * merge exactly as a failure does. The difference is purely diagnostic and it is earned:
 * one word tells the reader to run `pnpm build`, the other tells them to look at the diff.
 * The ambiguity this module CANNOT resolve is stated inside its own message, because the
 * refusal text is the only part of a refused verdict anyone ever reads.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { dirname, join, relative, resolve, sep } from 'node:path'

import { INSTALL_SURFACES } from './client-composition-surface.mjs'

/** Recursively count regular files under an absolute directory; 0 if it does not exist. */
function countFiles(abs) {
  let out = 0
  const walk = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) walk(join(dir, entry.name))
      else if (entry.isFile()) out += 1
    }
  }
  try {
    walk(abs)
  } catch {
    return 0
  }
  return out
}

/** Run git and turn "non-zero" into a boolean rather than an exception. */
function gitOk(repoRoot, args) {
  try {
    execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    return true
  } catch (error) {
    if (error?.status === 1 || error?.status === 128) return false
    throw error
  }
}

function gitOut(repoRoot, args) {
  try {
    return execFileSync('git', args, { cwd: repoRoot, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }).trim()
  } catch {
    return null
  }
}

/**
 * The outermost ancestor of `relDir` (exclusive of the repository root) that is itself
 * build output rather than source: untracked AND gitignored. Walking to the OUTERMOST such
 * directory is the point — for the client entry that lands on `packages/client/dist` (the
 * root `tsc` emits into) instead of `…/dist/packages/client/src/plugin`, and the difference
 * is what separates "the build never ran" from "the build ran and produced the wrong thing".
 */
function outputRootOf(repoRoot, relDir, unreadable) {
  let outer = null
  let cur = relDir
  for (;;) {
    const rel = relative(repoRoot, cur).split(sep).join('/')
    if (!rel || rel === '..' || rel.startsWith('../') || rel === '.') break
    let trackedHere
    let ignoredHere
    try {
      trackedHere = gitOk(repoRoot, ['ls-files', '--error-unmatch', '--', rel])
      // `dist/` is a directory pattern, and git matches a trailing slash only against a
      // directory: without appending one, `packages/client/dist` answers "not ignored", and
      // the walk lands one level deeper than the root the build actually emits into.
      ignoredHere = gitOk(repoRoot, ['check-ignore', '-q', '--', `${rel}/`])
    } catch (error) {
      unreadable.push(`git could not classify ${rel}: ${String(error?.message ?? error).split('\n')[0]}`)
      break
    }
    if (trackedHere || !ignoredHere) break
    outer = rel
    const parent = dirname(cur)
    if (parent === cur) break
    cur = parent
  }
  return outer
}

/**
 * Everything this module can honestly say about one declared artifact's absence.
 * `unreadable` collects the questions git refused to answer; a non-empty list forbids a
 * `refused` verdict, because "I could not tell" is not evidence that nothing is wrong.
 */
export function artifactProvenance({ repoRoot, rel, label = rel, installSurfaces = INSTALL_SURFACES }) {
  const unreadable = []
  const abs = resolve(repoRoot, rel)
  const exists = existsSync(abs)
  let tracked = false
  let gitignored = false
  try {
    tracked = gitOk(repoRoot, ['ls-files', '--error-unmatch', '--', rel])
    gitignored = gitOk(repoRoot, ['check-ignore', '-q', '--', rel])
  } catch (error) {
    unreadable.push(`git could not classify ${rel}: ${String(error?.message ?? error).split('\n')[0]}`)
  }
  const inInstallSurface = installSurfaceContains(installSurfaces, rel)
  const outputRoot = outputRootOf(repoRoot, dirname(abs), unreadable)
  const outputFileCount = outputRoot === null ? 0 : countFiles(join(repoRoot, outputRoot))
  const outputRootExists = outputRoot !== null && existsSync(join(repoRoot, outputRoot))

  // The owning package's declared entry, as disclosure: an unbuilt tree leaves `main`
  // pointing at a path with no file, which is a fact worth printing and (candidate 2) a
  // poor thing to decide on.
  let manifestEntry = null
  let pkgDir = dirname(abs)
  for (;;) {
    const candidate = join(pkgDir, 'package.json')
    if (existsSync(candidate)) break
    const parent = dirname(pkgDir)
    if (parent === pkgDir) { pkgDir = ''; break }
    pkgDir = parent
  }
  if (pkgDir) {
    try {
      const pkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
      const declared = typeof pkg.main === 'string' ? pkg.main : null
      if (declared) {
        const target = relative(repoRoot, resolve(pkgDir, declared)).split(sep).join('/')
        manifestEntry = { package: relative(repoRoot, join(pkgDir, 'package.json')), declared, target, resolves: existsSync(resolve(pkgDir, declared)) }
      }
    } catch (error) {
      unreadable.push(`${relative(repoRoot, join(pkgDir, 'package.json'))} could not be read: ${String(error?.message ?? error).split('\n')[0]}`)
    }
  }

  return { label, rel, exists, tracked, gitignored, inInstallSurface, outputRoot, outputRootExists, outputFileCount, manifestEntry, unreadable }
}

function installSurfaceContains(surfaces, rel) {
  return surfaces.some((s) => rel === s || rel.startsWith(`${s}/`))
}

/** A one-line statement of the tree the leg measured, for a refusal reason. */
export function treeShape({ repoRoot }) {
  const head = gitOut(repoRoot, ['rev-parse', '--short', 'HEAD']) ?? 'unknown'
  const status = gitOut(repoRoot, ['status', '--porcelain'])
  const dirty = status === null ? 'unknown' : String(status ? status.split('\n').filter(Boolean).length : 0)
  return `HEAD ${head}, ${dirty} tracked file(s) not matching HEAD`
}

/**
 * The verdict for an ABSENT artifact. `exists` is the caller's problem: if the artifact is
 * there, its contents decide.
 */
export function absentArtifactVerdict(prov, { command = 'pnpm build' } = {}) {
  const where = prov.outputRoot ?? 'its containing directory'
  if (prov.unreadable.length > 0) {
    return {
      verdict: 'failed',
      why: `${prov.rel} is missing and its provenance could not be established, so this leg refuses to call that anything milder than a failure: ${prov.unreadable.join('; ')}`,
    }
  }
  if (prov.tracked || prov.inInstallSurface) {
    return {
      verdict: 'failed',
      why:
        `${prov.rel} is missing and it is ${prov.tracked ? 'tracked in git' : 'inside the shipped install surface'} — ` +
        `its absence is a defect in the tree, not a property of the checkout it was run in. ` +
        `Tree this leg measured: ${prov.treeShape ?? '(unstated)'}`,
    }
  }
  if (prov.outputRoot !== null && prov.outputFileCount > 0) {
    return {
      verdict: 'failed',
      why:
        `${prov.rel} is missing while ${prov.outputRoot} carries ${String(prov.outputFileCount)} other file(s): a build ran in this ` +
        `tree and produced a surface that does not contain what the ${prov.label} arm declares. That is a regression in the build or ` +
        `in the artifact, not an unbuilt checkout. Tree this leg measured: ${prov.treeShape ?? '(unstated)'}`,
    }
  }
  if (prov.outputRoot === null) {
    return {
      verdict: 'failed',
      why:
        `${prov.rel} is missing and is neither tracked, nor gitignored, nor inside an install surface, so this leg has no evidence ` +
        `that it is build output at all and will not launder its confusion into a refusal. Tree: ${prov.treeShape ?? '(unstated)'}`,
    }
  }
  return {
    verdict: 'refused',
    why:
      `${prov.label}: ${prov.rel} is not on disk, and the tree says this checkout has never produced it rather than that a build ` +
      `went wrong — ${where} ${prov.outputRootExists ? 'exists but is empty' : 'does not exist'} (${String(prov.outputFileCount)} file(s)), ` +
      `${prov.rel} is gitignored and untracked, and it is in no install surface (the surfaces that ship are ${INSTALL_SURFACES.join(', ')}), ` +
      `so no install of this repository ever carries it` +
      (prov.manifestEntry === null
        ? ''
        : `; the owning manifest declares ${prov.manifestEntry.declared} → ${prov.manifestEntry.target}, which ${prov.manifestEntry.resolves ? 'does resolve' : 'also has no file on disk'}`) +
      `. Run \`${command}\` and re-run this leg. What this leg cannot tell you, stated rather than guessed: an unbuilt tree and a ` +
      `build that ran and emitted NOTHING are byte-identical here, so this is a refusal about the checkout, not a claim that the ` +
      `build works. Tree this leg measured: ${prov.treeShape ?? '(unstated)'}. refused is not passed — this leg blocks the merge ` +
      `exactly as a failure does, and no reading of this message makes it green.`,
  }
}

/**
 * The whole answer for one artifact: measure, then decide. `treeShape` is computed here so
 * that a caller cannot produce a verdict without also producing the shape it was reached in.
 */
export function classifyAbsentArtifact({ repoRoot, rel, label, command, installSurfaces }) {
  const prov = artifactProvenance({ repoRoot, rel, label, installSurfaces })
  prov.treeShape = treeShape({ repoRoot })
  return { prov, ...absentArtifactVerdict(prov, { command }) }
}
