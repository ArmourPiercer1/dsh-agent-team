#!/usr/bin/env node
/**
 * check-artifacts-at-head.mjs — does the COMMITTED install surface match what a
 * build of that same commit produces? The question `check:artifacts` cannot ask.
 *
 * WHY A SECOND INSTRUMENT AND NOT A FIX TO THE FIRST.
 * `scripts/check-artifacts-committed.mjs` compares the WORKING TREE against the git
 * INDEX. That is the right question for one job — "you just built, did you `git add`
 * it?" — and it is structurally incapable of the other job. A tree whose `dist` was
 * never rebuilt has working == index, so the check prints
 * `OK: 1508 files; committed install-surface artifacts match the fresh build` over a
 * surface no build has produced in days. Measured at `f0485b15`: that exact sentence,
 * exit 0, while 20 tracked files under `packages/runtime/dist` were one or two merged
 * commits behind the source that emits them, the shipped `schema.js` still reading
 * `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [1, 2, 3]` five commits after the tree
 * narrowed it to `[3]`, and five shipped modules still gating the §E.2 requirements
 * grammar on `blueprint.schemaVersion === 2` — a version that build no longer admits.
 * The same gate that prints it passed 26/26 on that tree.
 * Evidence: dev/agent-workflow/evidence/a4-pr7/7-8-dist-rebase/STALENESS.md.
 *
 * THE MECHANISM: never read the working tree's artifacts. Materialise the commit under
 * test in a throwaway worktree, build it there, and run the EXISTING check inside it —
 * where "working tree" and "index" are both that commit, so the only way to print OK is
 * for the commit to carry its own build. No new comparison semantics: the arms (A/B/C/D),
 * the ignore handling and the non-emptiness guard are the ones already reviewed.
 *
 * WHY A WORKTREE AND NOT `/tmp`: tsc bakes the outDir→rootDir relationship into every
 * `.js.map` / `.d.ts.map` it emits. Built at a different relative path the maps differ
 * byte-wise from the committed ones, so a scratch build elsewhere would report drifts that
 * are the harness's own artefact. Measured here: two independent builds at the same
 * relative layout produced byte-identical output, so bytes are a sound verdict channel.
 *
 * WHERE THE SCRATCH GOES IS PART OF THIS INSTRUMENT, not an implementation detail. The
 * first version wrote `<root>/.tmp-artifact-at-head-<pid>-<ts>` and this header claimed the
 * path was "git- and lint-ignored". The lint half was true (a root-anchored `.tmp-` glob is
 * in the tracked flat config); the git half was false — `.tmp-*` was ignored only by
 * `.git/info/exclude`, which is NOT tracked, so on a fresh clone the scratch is 376 MB of
 * untracked duplicate source and every `git status --porcelain` assertion in the repository
 * reads it as uncommitted work. The same shape of accident was measured on another lane's
 * nested clone in the same working tree: `lint-identities --diff` went from `universe: 1109
 * … new 0, resolved 0` to `universe: 2782 file(s) linted, 1673 of them gitignored … new 750,
 * resolved 0`, 751 of those lines naming the clone. A gate that changes another gate's
 * measurement is not a gate, and ESLint does not read `.gitignore`, so the immunity has to
 * exist in each mechanism separately. The scratch is therefore a DIRECT CHILD of the running
 * checkout at `.scratch/artifact-at-head/<pid>-<stamp>`, ignored by the tracked `.gitignore`
 * and by a root-anchored `.scratch` glob in the tracked flat config, and the fence is immune
 * by construction because it enumerates `git ls-files`. All of that, including why the path
 * must be a direct child rather than nested under `.worktrees/`, is written down in
 * `scripts/artifact-check-scratch.mjs`, which exports the path so the guard leg and this
 * instrument cannot disagree about where it is.
 *
 * WHAT IT CANNOT SEE, stated rather than implied:
 *   - uncommitted work — by design, the subject is a commit;
 *   - a `dist` file a build no longer emits and tsc left on disk (the check's own
 *     documented "known narrow gap"; it is dead weight in the mirror, not drift);
 *   - a published tarball that diverges from the repository it came from;
 *   - nothing about the OTHER eight packages: only `packages/runtime/dist` and
 *     `packages/client/composition-shim` ship (root `files`), and those are the two
 *     surfaces `INSTALL_SURFACES` names.
 *
 * Exit codes, four answers, never collapsed:
 *   0 the commit carries its own build (the check said OK, non-empty set)
 *   1 the commit's committed surface is STALE — the check's own list is relayed
 *   2 the check REFUSED (empty produced set, missing surface) — relayed verbatim
 *   3 NOT-RUN — the scratch could not be made, or install/build failed. A build that
 *     never ran has no opinion about freshness, and this script never reports one.
 */
import { spawnSync } from 'node:child_process'
import { accessSync, constants, existsSync, mkdirSync, readFileSync, rmdirSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'

import { resolveScratchPath, sweepStaleScratches } from './artifact-check-scratch.mjs'

const TAG = '[check-artifacts-at-head]'

/**
 * Machine-readable verdict channel, same grammar as `check-artifacts-committed.mjs`:
 *
 *   DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=<rev> verdict=<ok|stale|refused|not-run> [k=v…]
 *
 * `subject=commit` is the difference between the two instruments and is therefore part of
 * the token, not of the prose. Both tokens can appear in this script's stdout — the inner
 * instrument's token is relayed verbatim — so a consumer must select by `script=`. A
 * consumer that greps for the first `verdict=` it finds would grade the inner run against
 * the wrong subject, which is the mistake this instrument exists to stop.
 */
function verdict(fields) {
  process.stdout.write(`DSH-ARTIFACT-VERDICT ${Object.entries(fields).map(([k, v]) => `${k}=${String(v)}`).join(' ')}\n`)
}

/** Pull one field out of a verdict line emitted by `script=<name>`. */
function verdictField(text, script, field) {
  const line = new RegExp(`DSH-ARTIFACT-VERDICT[^\\n]*script=${script}[^\\n]*`).exec(text ?? '')
  if (line === null) return null
  const kv = new RegExp(`\\b${field}=(\\S+)`).exec(line[0])
  return kv === null ? null : kv[1]
}

function parseArgs(argv) {
  const opts = { rev: 'HEAD', storeDir: null, keep: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--rev') opts.rev = argv[(i += 1)]
    else if (a === '--store-dir') opts.storeDir = argv[(i += 1)]
    else if (a === '--keep') opts.keep = true
    else throw new Error(`unknown argument: ${String(a)}`)
  }
  if (!opts.rev) throw new Error('--rev requires a value')
  return opts
}

/**
 * Run one step inside the scratch. A step that could not be spawned or was killed by a
 * signal is NOT-RUN: it is represented by throwing to `main`, never by `process.exit` —
 * `process.exit()` inside the `try` below skips its `finally`, and a skipped `finally`
 * leaks the scratch worktree into `git worktree list` (measured: one leaked registration
 * per failed run, before this was rewritten).
 */
class NotRun extends Error {
  /** `reason` is the machine-readable half of the refusal (`verdict=not-run reason=…`). */
  constructor(message, reason = 'unknown') {
    super(message)
    this.name = 'NotRun'
    this.reason = reason
  }
}

function step(label, command, args, cwd) {
  const r = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env })
  if (r.error) throw new NotRun(`${label} could not be spawned (${r.error.message}) — no verdict about freshness is available`, 'spawn-failed')
  if (r.signal) throw new NotRun(`${label} was killed by ${r.signal} — the instrument never reported`, 'killed')
  return r
}

function relaunch(r) {
  const out = `${r.stdout ?? ''}${r.stderr ?? ''}`.trimEnd()
  return out.split('\n').slice(-12).join('\n')
}

const opts = parseArgs(process.argv.slice(2))

const top = spawnSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' })
if (top.status !== 0 || !top.stdout.trim()) {
  process.stdout.write(`${TAG} NOT-RUN: not inside a git work tree, so there is no commit to materialise.\n`)
  process.exit(3)
}
const ROOT = top.stdout.trim()

// The store has to be one pnpm can write. In a sandboxed harness the default store is
// read-only and `pnpm install` dies on `unable to open database file` — which MUST surface
// as NOT-RUN (3), never as a green. Discovery order, widest-scope last:
//   1. `--store-dir` (an operator saying so explicitly);
//   2. `DSH_ARTIFACT_CHECK_STORE_DIR`;
//   3. the store THIS checkout was installed from, read back out of
//      `node_modules/.modules.yaml` (`storeDir:`) — the scratch then installs from the
//      same store the reviewed tree used, which is the closest thing to a like-for-like
//      build the machine can offer;
//   4. `npm_config_store_dir`, when pnpm itself was invoked with one;
//   5. nothing: pnpm's default.
// Whatever is discovered is probed for writability, because the failure mode without a
// probe is a pnpm stack trace where a one-line cause belongs.
function storeFromModulesYaml() {
  const p = join(ROOT, 'node_modules', '.modules.yaml')
  if (!existsSync(p)) return null
  // pnpm records the store the install actually used, with the content-version subdir on
  // the end (`…/.pnpm-store/v11`). `--store-dir` documents the ROOT and appends the version
  // itself, so the suffix comes off. Measured on pnpm 11.7.0: both forms install cleanly
  // and neither creates a nested `v11/v11`, so the strip is conformance to the documented
  // form, not a workaround for an observed failure.
  const m = /"?storeDir"?\s*:\s*"([^"]+)"/.exec(readFileSync(p, 'utf8'))
  if (!m?.[1]) return null
  return resolve(m[1].replace(/\/v\d+$/, ''))
}

function probe(dir, source) {
  try {
    accessSync(dir, constants.W_OK)
    process.stdout.write(`${TAG} installing the scratch from ${source}: ${dir}\n`)
    return dir
  } catch {
    throw new NotRun(`the only discoverable pnpm store (${source}: ${dir}) is not writable, so the scratch cannot be installed. Pass --store-dir <writable path>; a refusal is not a verdict of "fresh".`, 'store-not-writable')
  }
}

const stamp = `${process.pid}-${Date.now()}`
const SCRATCH = resolveScratchPath(ROOT, stamp)
const SCRATCH_PARENT_DIR = dirname(SCRATCH)

function cleanup() {
  if (opts.keep) {
    process.stdout.write(`${TAG} --keep: scratch left at ${SCRATCH} (remove it with \`git worktree remove --force ${SCRATCH}\`).\n`)
    return
  }
  // Both removals, in this order: `git worktree remove` takes the registration with it, and
  // the rm covers the case where the directory exists but was never registered (a `worktree
  // add` that died partway). `prune` then clears any registration whose directory the OS
  // already reclaimed, which is what a SIGKILL mid-build tends to leave.
  spawnSync('git', ['worktree', 'remove', '--force', SCRATCH], { cwd: ROOT, encoding: 'utf8' })
  if (existsSync(SCRATCH)) rmSync(SCRATCH, { recursive: true, force: true })
  spawnSync('git', ['worktree', 'prune'], { cwd: ROOT, encoding: 'utf8' })
  // The parent directories exist only to hold this run's scratch; leaving them empty means
  // every later reader of the tree has to explain a directory with no content in it.
  // `rmdirSync` and NOT `rmSync({ recursive: false })`: the latter raises ERR_FS_EISDIR on a
  // directory, and an exception thrown from this `finally` replaced a computed `verdict=ok`
  // with exit 1 on the first run at this path — the instrument had already graded the commit
  // correctly, printed `verdict=ok compared=1508`, and then reported failure because it could
  // not tidy up. Tidy-up failure is not a verdict, and it must never become one. An
  // empty-only rmdir also cannot touch a concurrent run's scratch: it simply fails.
  try {
    rmdirSync(SCRATCH_PARENT_DIR)
    rmdirSync(dirname(SCRATCH_PARENT_DIR))
  } catch {
    // Not empty (another run is materialising) or already gone. Neither is a verdict.
  }
}

function discoverStore() {
  const discovered = opts.storeDir
    ?? process.env.DSH_ARTIFACT_CHECK_STORE_DIR
    ?? storeFromModulesYaml()
    ?? (process.env.npm_config_store_dir ? resolve(process.env.npm_config_store_dir) : null)
  if (discovered === null) return null
  const source = opts.storeDir !== null
    ? '--store-dir'
    : discovered === process.env.DSH_ARTIFACT_CHECK_STORE_DIR
      ? 'DSH_ARTIFACT_CHECK_STORE_DIR'
      : 'store recorded in node_modules/.modules.yaml'
  return probe(resolve(discovered), source)
}

function main() {
  const storeDir = discoverStore()
  mkdirSync(SCRATCH_PARENT_DIR, { recursive: true })
  const add = step('git worktree add', 'git', ['worktree', 'add', '--detach', SCRATCH, opts.rev], ROOT)
  if (add.status !== 0) throw new NotRun(`\`git worktree add --detach <scratch> ${opts.rev}\` failed:\n${relaunch(add)}`, 'worktree-add')
  process.stdout.write(`${TAG} materialised ${opts.rev} in a scratch worktree and is building it there\n`)

  const installArgs = ['install', '--frozen-lockfile']
  if (storeDir !== null) installArgs.push(`--store-dir=${storeDir}`)
  const install = step('pnpm install', 'pnpm', installArgs, SCRATCH)
  if (install.status !== 0) {
    throw new NotRun(`the scratch could not be installed (exit ${String(install.status)}). A build that never installed has no opinion about freshness. Tail:\n${relaunch(install)}`, 'install')
  }

  const build = step('pnpm build', 'pnpm', ['build'], SCRATCH)
  if (build.status !== 0) {
    throw new NotRun(`\`pnpm build\` failed in the scratch (exit ${String(build.status)}); a failing build is not a stale artifact. Tail:\n${relaunch(build)}`, 'build')
  }

  const glue = step('place-dist-glue', process.execPath, ['scripts/place-dist-glue.mjs'], SCRATCH)
  if (glue.status !== 0) throw new NotRun(`glue placement failed (exit ${String(glue.status)}). Tail:\n${relaunch(glue)}`, 'glue-placement')
  const comp = step('build-client-composition', process.execPath, ['scripts/build-client-composition.mjs', 'packages/client', 'packages/client/composition-shim'], SCRATCH)
  if (comp.status !== 0) throw new NotRun(`the client composition build failed (exit ${String(comp.status)}). Tail:\n${relaunch(comp)}`, 'client-composition')

  // The reviewed instrument, run where "the tree" IS the commit. Its exit code is the
  // verdict and its text is the evidence; nothing here re-implements a comparison.
  const check = step('check-artifacts-committed', process.execPath, ['scripts/check-artifacts-committed.mjs'], SCRATCH)
  process.stdout.write(check.stdout ?? '')
  process.stderr.write(check.stderr ?? '')

  // The verdict is read from the inner instrument's TOKEN, never from its prose and never
  // from its exit code alone. Absence of a token is a refusal: an instrument that finished
  // without stating a verdict compared nothing this script can stand behind.
  const inner = verdictField(check.stdout, 'check-artifacts-committed', 'verdict')
  const compared = Number(verdictField(check.stdout, 'check-artifacts-committed', 'compared') ?? '0')
  const drift = Number(verdictField(check.stderr, 'check-artifacts-committed', 'drift')
    ?? verdictField(check.stdout, 'check-artifacts-committed', 'drift') ?? '0')
  if (inner === null) {
    process.stdout.write(`${TAG} NOT-RUN: the check exited ${String(check.status)} without emitting a ${'DSH-ARTIFACT-VERDICT'} line, so there is nothing to grade.\n`)
    verdict({ script: 'check-artifacts-at-head', subject: 'commit', rev: opts.rev, verdict: 'not-run', reason: 'no-verdict-token', code: check.status })
    return 3
  }
  if (inner === 'ok') {
    if (compared === 0) {
      process.stdout.write(`${TAG} NOT-RUN: the check reported OK over zero files — that is a false green, not a verdict.\n`)
      verdict({ script: 'check-artifacts-at-head', subject: 'commit', rev: opts.rev, verdict: 'not-run', reason: 'checker-ok-over-zero-files' })
      return 2
    }
    verdict({ script: 'check-artifacts-at-head', subject: 'commit', rev: opts.rev, verdict: 'ok', compared, drift: 0 })
    process.stdout.write(`${TAG} ${opts.rev} carries its own build: the committed surface IS a fresh build of itself (${String(compared)} compared file(s)).\n`)
    return 0
  }
  if (inner === 'stale') {
    verdict({ script: 'check-artifacts-at-head', subject: 'commit', rev: opts.rev, verdict: 'stale', compared, drift })
    process.stdout.write(`${TAG} ${opts.rev} does NOT carry its own build — the ${String(drift)} listed path(s) (relayed above on stderr) are what a build of this commit changes and this commit did not include.\n`)
    return 1
  }
  process.stdout.write(`${TAG} the check REFUSED (exit ${String(check.status)}, reason=${verdictField(check.stdout, 'check-artifacts-committed', 'reason') ?? 'unstated'}) — nothing was compared, so there is no verdict.\n`)
  verdict({ script: 'check-artifacts-at-head', subject: 'commit', rev: opts.rev, verdict: 'refused', reason: verdictField(check.stdout, 'check-artifacts-committed', 'reason') ?? 'checker-refused', code: check.status })
  return 2
}

// Sweep scratch trees a killed run could not remove (SIGKILL is not catchable, and a stale
// registration in `git worktree list` is a side effect on every later lane). The sweep only
// touches entries whose pid is gone, so a concurrent run's scratch is never deleted, and it
// includes the pre-`.scratch/` location so the move does not abandon residue. This runs
// BEFORE the build, not in the `finally`: a sweep that only runs on success leaves the residue
// of the very crash it is meant to clean until some later run happens to succeed.
sweepStaleScratches(ROOT, { legacyPrefixes: ['.tmp-artifact-at-head-'] })

let code = 3
try {
  code = main()
} catch (e) {
  if (e instanceof NotRun) {
    process.stdout.write(`${TAG} NOT-RUN: ${e.message}\n`)
    // The runner case, pinned: a leg that could not run states `verdict=not-run` and exits
    // 3. It never states `verdict=ok`, so a gate cannot be green because it never ran.
    verdict({ script: 'check-artifacts-at-head', subject: 'commit', rev: opts.rev, verdict: 'not-run', reason: e.reason })
  }
  else throw e
} finally {
  cleanup()
}
process.exit(code)
