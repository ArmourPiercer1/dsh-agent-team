/**
 * artifact-check-scratch.mjs — where `check-artifacts-at-head.mjs` materialises its throwaway
 * build, stated in ONE place so the instrument and the leg that guards it cannot drift.
 *
 * WHY A MODULE AND NOT A CONSTANT IN THE SCRIPT. The leg that keeps this fixed
 * (`a4p7-merge-gate.test.ts`, "the scratch instrument cannot change another instrument's
 * measurement") has to ask the same question the script answers: WHICH path are you going to
 * write into? Reading the script's source out of the test to find out would be a second
 * parser of someone else's decision — the exact pattern that made the merge gate's artifact
 * leg a substring test on prose. So the decision is exported and both sides call it.
 * (This module has no side effects on import, unlike the instrument, which is a CLI and
 * exits; a test importing that would start a build.)
 *
 * WHY THE LOCATION IS PART OF THE INSTRUMENT. The first version put the scratch at
 * `<root>/.tmp-artifact-at-head-<pid>-<ts>` and the header claimed it was "git- and
 * lint-ignored". Half of that was false, and the false half was load-bearing:
 *   - the root-anchored `.tmp-` glob IS in the tracked `eslint.config.mjs` ignores, so the
 *     LINT never saw the scratch at either location;
 *   - but `.tmp-*` was ignored only by `.git/info/exclude` on the machine that wrote the
 *     claim. That file is NOT tracked. On any other clone the scratch is ordinary untracked
 *     noise, so every `git status --porcelain` assertion in this repository — including the
 *     ones this lane was told to end its report with — would read a 376 MB directory full of
 *     duplicate source as uncommitted work.
 * The general form of that bug landed on another lane first and was measured there: a nested
 * clone checked out at this branch's rebuild commit, `.swt/`, present in the main working
 * tree, moved `node scripts/lint-identities.mjs --diff` from `universe: 1109 …  new 0,
 * resolved 0` to `universe: 2782 file(s) linted, 1673 of them gitignored … new 750,
 * resolved 0`, with 751 output lines naming `.swt/`. ESLint does not read `.gitignore`, so
 * gitignoring the scratch buys nothing against that instrument; the ignore has to exist in
 * each mechanism, on its own terms.
 *
 * So the scratch lives at `<root>/.scratch/artifact-at-head/<pid>-<stamp>`, a DIRECT CHILD of
 * the checkout the instrument runs from, and each of the three instruments that could be
 * poisoned is covered by the mechanism that instrument actually uses:
 *   1. ESLint / `lint-identities` — a file walk that reads the flat config's `ignores` and
 *      nothing else. Covered by the root-anchored `.scratch` glob added there. Root-anchored
 *      is deliberate and is also why the scratch must be a direct child of the running
 *      checkout: `.worktrees/**` would have covered a lane worktree's scratch from the MAIN
 *      root but not from inside that worktree, because the config that governs a run is the
 *      one at that run's root (the same root-anchoring trap that let
 *      `packages/testkit/test/.tmp-fault/` into the universe; recorded in
 *      `eslint.config.mjs`). Every checkout carries the same tracked config, so a direct
 *      child is covered whichever checkout runs the instrument.
 *   2. `verify-blueprint-version-clean.mjs` (the version fence) — enumerates
 *      `git ls-files -z`, i.e. TRACKED files only, which is why it is immune to fixture
 *      residue by construction (its own header, "WHY `git ls-files` AND NOT A FILESYSTEM
 *      WALK"). The scratch is never tracked, so it is out of scope regardless of name; the
 *      tracked `.gitignore` entry keeps it out of `git status` too.
 *   3. `p4t6`'s session-event scanner — walks `packages/` under its own checkout, so a
 *      root-level directory is not in its scope. (It counts what it discovers, and the leg
 *      asserts that count, so a scratch that WERE in scope would show up as a wrong total
 *      rather than as a silent pass.)
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, join } from 'node:path'

/** Path segments under the running checkout. Dot-prefixed: it is scratch, not content. */
export const SCRATCH_PARENT = join('.scratch', 'artifact-at-head')

/**
 * The scratch directory for one run. `stamp` carries the caller's pid so the sweep below can
 * tell a crashed run's residue from a live run's in-progress build.
 */
export function resolveScratchPath(root, stamp) {
  return join(root, SCRATCH_PARENT, stamp)
}

/** Is this pid still alive? ESRCH means the process is gone and its scratch is residue. */
export function isLive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e?.code !== 'ESRCH'
  }
}

function pidOf(entry) {
  const m = /^(\d+)-/.exec(entry)
  return m ? Number(m[1]) : null
}

/**
 * Remove scratch trees a killed run could not remove. SIGKILL is not catchable, so a crash
 * leaves both the directory and its `git worktree` registration behind, and a stale
 * registration is a side effect on every later lane. Entries belonging to a LIVE pid are left
 * alone: concurrent runs are normal here, and deleting another run's scratch would replace its
 * honest NOT-RUN with a lie about the tree.
 *
 * TWO ages decide "residue", and the pid is only advisory, because it cannot be trusted across
 * process boundaries here: these commands run in PID namespaces where node has measured
 * `process.pid` as low as 3, and a later command in the SAME working tree gets a different
 * namespace, so a stale entry's pid reads as dead when its owner is merely invisible and as
 * live when it belongs to an unrelated process. Measured, not theorised: a scratch created by
 * one run as `3-…` was reported removable by the next run's `isLive(3)`.
 *
 *   - `recentMs` (default 5 min): nothing is touched this young. One materialisation measured
 *     12-25 s end to end, so 5 minutes is 12x the worst case and is what protects a CONCURRENT
 *     run's in-progress scratch — the only thing that can, given pids mean nothing across
 *     namespaces. Two concurrent runs in one checkout are therefore tolerated, not supported:
 *     if a run ever outlives `recentMs`, another run may sweep it. Raising this is the fix.
 *   - `maxAgeMs` (default 1 h): older than this, an entry is residue even if its pid looks
 *     alive. Leaving it is the 1.1 GB / 55941-file side effect (measured for one populated
 *     scratch) this sweep exists to remove.
 *
 * `isLivePid` is injectable so the leg can pin the four cells of this rule deterministically.
 * That is not test convenience, it is the finding: liveness is a property of the CALLER'S
 * namespace, measured two ways in one working tree — `process.kill(3, 0)` inside a `bash -c`
 * node process said alive (the scratch a run had just written was named `3-…`), and the same
 * call inside the vitest worker said `ESRCH`, which swept an entry the same rule had just
 * protected. A leg that asserted against the environment's answer would be a leg that changes
 * colour with the runner, so the leg supplies the answer and the default stays the OS.
 *
 * `legacyPrefixes` names entries sitting directly in `root` that an EARLIER version of the
 * instrument created (`.tmp-artifact-at-head-` before the move to `.scratch/`), so relocating
 * the path does not abandon the residue the old path left behind. An entry whose name carries
 * no pid is not ours and is left alone, whatever it is.
 */
export function sweepStaleScratches(
  root,
  { legacyPrefixes = [], recentMs = 5 * 60 * 1000, maxAgeMs = 60 * 60 * 1000, isLivePid = isLive } = {},
) {
  const removed = []
  const candidates = []
  if (existsSync(join(root, SCRATCH_PARENT))) {
    for (const entry of readdirSync(join(root, SCRATCH_PARENT))) {
      candidates.push(join(root, SCRATCH_PARENT, entry))
    }
  }
  for (const prefix of legacyPrefixes) {
    for (const entry of readdirSync(root)) {
      if (entry.startsWith(prefix)) candidates.push(join(root, entry))
    }
  }
  for (const path of candidates) {
    const pid = pidOf(basename(path))
    if (pid === null) continue // not ours, whatever it is
    let ageMs = 0
    try {
      ageMs = Date.now() - statSync(path).mtimeMs
    } catch {
      continue // vanished between the listing and the stat
    }
    if (ageMs <= recentMs) continue
    if (isLivePid(pid) && ageMs <= maxAgeMs) continue
    spawnSync('git', ['worktree', 'remove', '--force', path], { cwd: root, encoding: 'utf8' })
    if (existsSync(path)) rmSync(path, { recursive: true, force: true })
    removed.push(path)
  }
  return removed
}
