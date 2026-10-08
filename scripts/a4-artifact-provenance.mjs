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
 *
 * THE REVIEW ROUND ADDED A FIFTH CASE, AND IT IS NOT DECIDABLE EITHER. The whole built
 * output, moved off the declared path by a plain `mv` with no source change. Review measured
 * it twice: to `packages/client/build` — NOT gitignored, so the moved files enter the lint
 * universe and the run is blocked only by the lint leg, by accident (`new 6`) — and to
 * `packages/client/out/dist`, which IS gitignored, where every leg of the machine gate went
 * GREEN while a complete 400-file plugin sat off the path the manifest declares,
 * `check:artifacts` still printed `OK: 1508 files` (it compares the two committed install
 * surfaces and never looks at `packages/client/dist`), and this module's own message sent
 * the reader to `pnpm build`, which cannot fix it. There is nothing outside the declared
 * output root to measure: no `*.tsbuildinfo` anywhere, no `incremental` or `composite` in
 * the tsconfigs, and the only mechanical difference between a clone and a worktree is `.git`
 * being a directory or a file — a separator that identifies the harness, not build intent,
 * so reading it would be manufacturing belief. So no smarter predicate is attempted here.
 * What closes the hole is structural and lives in the gate rather than in this module: §7.6's
 * composition leg now requires its arm to have RUN, so an arm that did not run cannot be
 * green in any vocabulary, and the claim below is bounded to exactly what this module reads.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, realpathSync } from 'node:fs'
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
  assertRepoRootIsToplevel(repoRoot)
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

/**
 * Review nit, and it is the same disease as everything else in this file: pointed at a
 * SUBDIRECTORY, every field this module reports is answered by the ENCLOSING repository.
 * Measured from a package directory, `outputRoot` came back `packages`, `manifestEntry.package`
 * came back `../../../package.json`, and the verdict still read `refused` — harmless only for
 * as long as every caller happens to pass the toplevel. A predicate that quietly answers for a
 * tree other than the one its caller is standing in has stopped being a predicate, so this is
 * raised rather than classified: the caller's bug is not a property of the artifact.
 */
function assertRepoRootIsToplevel(repoRoot) {
  const top = gitOut(repoRoot, ['rev-parse', '--show-toplevel'])
  if (top === null) {
    throw new Error(`artifactProvenance needs a git work tree: \`git rev-parse --show-toplevel\` did not answer in ${repoRoot}`)
  }
  // Compare realpaths so a checkout reached through a symlink is not called a misuse.
  const real = (p) => {
    try {
      return realpathSync(p)
    } catch {
      return resolve(p)
    }
  }
  if (real(top) !== real(repoRoot)) {
    throw new Error(
      `artifactProvenance was pointed at ${repoRoot}, which is not the git toplevel (${top}). ` +
        `Every field it would return is answered from ${top}, not from the directory passed in.`,
    )
  }
}

/** A one-line statement of the tree the leg measured, for a refusal reason. */
export function treeShape({ repoRoot }) {
  const head = gitOut(repoRoot, ['rev-parse', '--short', 'HEAD']) ?? 'unknown'
  const status = gitOut(repoRoot, ['status', '--porcelain'])
  if (status === null) return `HEAD ${head}, working-tree state UNREADABLE (git status did not answer)`
  const lines = String(status).split('\n').filter(Boolean)
  const untracked = lines.filter((line) => line.startsWith('??')).length
  const tracked = lines.length - untracked
  // F3, and the reason the line is worded awkwardly on purpose. `git status --porcelain`
  // reports one line per ENTRY and collapses an untracked DIRECTORY into that directory, so a
  // new folder holding three files is one line. Measured in review: three new files under one
  // new directory made the previous wording print "1 tracked file(s) not matching HEAD" — a
  // sentence about tracked files that had been counting a mixture of things, including
  // untracked ones. A reason string that misstates what it counted is the same failure as a
  // transcript with no results in it, so the two populations are counted apart and the
  // untracked one is labelled as entries, never as files.
  return (
    `HEAD ${head}, ${String(tracked)} tracked file(s) changed vs HEAD, ` +
    `${String(untracked)} untracked entr(ies) [counted from git-status entries: an untracked directory counts as one]`
  )
}

/**
 * The verdict for an ABSENT artifact. The precondition used to be prose ("`exists` is the caller's
 * problem"), and prose is not a rule: measured at `d6e786c7`, this helper was called twice inside an
 * hour on a tree where the artifact was PRESENT and it answered `failed` with "…is missing while
 * packages/client/dist carries 400 other file(s)…" — a false statement about the tree, reported as a
 * verdict, which is finding F2/F3 with a new author (`review-round-verdicts-at-d6e786c7.txt` keeps
 * the out-of-contract call in its own header). So the precondition is enforced here instead of
 * remembered out there, and §7.6 pins it with a leg that calls it on a healthy tree.
 */
export function absentArtifactVerdict(prov, { command = 'pnpm build' } = {}) {
  const where = prov.outputRoot ?? 'its containing directory'
  if (prov.exists) {
    // Wrong question, answered as a refusal rather than a verdict: this helper's whole vocabulary
    // is about absence, and it cannot read file contents. A caller standing in front of a present
    // artifact has to judge the artifact, not ask this function what its absence means.
    return {
      verdict: 'refused',
      why:
        `${prov.label}: ${prov.rel} IS on disk, so there is no absence to classify — you asked the absent-artifact helper ` +
        `the wrong question. This function never reads the artifact's contents; every sentence it can produce is about a ` +
        `missing file, and returning one over a present file would state something false about the tree (which is what it ` +
        `did before this guard existed). Judge the artifact itself, or route the present case elsewhere: ` +
        `${where} currently holds ${String(prov.outputFileCount)} file(s) and the declared entry ${prov.manifestEntry === null ? 'is not consulted by this helper' : `resolves ${prov.manifestEntry.resolves ? 'on disk' : 'to nothing on disk'}`}. ` +
        `Tree this leg measured: ${prov.treeShape ?? '(unstated)'}. refused is not passed — a leg that reaches this branch ` +
        `has a caller bug to fix, and fixing it is not the same act as making the tree green.`,
    }
  }
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
      `${prov.label}: ${prov.rel} is not on disk and there is no trace of it in ${where} — ${where} ` +
      `${prov.outputRootExists ? 'exists but is empty' : 'does not exist'} (${String(prov.outputFileCount)} file(s) in it), ` +
      `${prov.rel} is gitignored and untracked, and it is in no install surface (the surfaces that ship are ${INSTALL_SURFACES.join(', ')}), ` +
      `so no install of this repository ever carries it` +
      (prov.manifestEntry === null
        ? ''
        : `; the owning manifest declares ${prov.manifestEntry.declared} → ${prov.manifestEntry.target}, which ${prov.manifestEntry.resolves ? 'does resolve' : 'also has no file on disk'}`) +
      `. The limit of that sentence, stated rather than left to the reader: this verdict is drawn from ${where} ALONE, nothing ` +
      `outside the declared output root is examined, and there is nothing outside it to examine — so a build that ran and whose ` +
      `output was then moved elsewhere is indistinguishable, here, from a build that never ran, and \`${command}\` would not fix ` +
      `that. The two states this check genuinely cannot separate are also byte-identical: an unbuilt tree and a build that ran ` +
      `and emitted NOTHING. Run \`${command}\` and re-run this leg. Tree this leg measured: ${prov.treeShape ?? '(unstated)'}. ` +
      `refused is not passed — this leg blocks the merge exactly as a failure does, and no reading of this message makes it green.`,
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
