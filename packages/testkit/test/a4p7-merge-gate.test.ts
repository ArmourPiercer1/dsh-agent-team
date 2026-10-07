/**
 * a4p7-merge-gate.test.ts — A4-PR7 Task 7.6: the code merge gate, run by the suite.
 *
 * WHY THIS FILE EXISTS. Plan §7.6 lists the machine-checkable legs a PR7 merge must
 * pass, and the plan's own §7.5 lesson is that an instrument nothing invokes is not a
 * gate at all — it names `verify-zero-core.mjs` as the cautionary precedent ("a script
 * no test calls is not a gate"). `pnpm smoke:composition`, `pnpm check:artifacts`,
 * `pnpm build:composition` and the client lane were exactly that: real commands, listed
 * in a plan document, executed by whoever remembered to execute them. This file calls
 * them, by name, from the suite, so a merge that skips a leg has to skip a red test
 * instead of a line in a README.
 *
 * THREE OUTCOMES, BECAUSE A SUBPROCESS HAS THREE ANSWERS. Every leg here classifies its
 * run as `passed`, `failed`, or `refused` — refused meaning the instrument never got to
 * check anything. Collapsing those two ways is how this phase produced two measured
 * incidents, one in each direction:
 *
 *   - `pnpm smoke:composition` exited 0 while its client leg printed a named SKIP
 *     (plan amendment 7, and the reason the ruling forbids asserting the exit code).
 *     A SKIP is a step that did not run: this gate classifies it `refused`, and
 *     refused fails the merge while quoting the SKIP text.
 *   - `scripts/verify-blueprint-version-clean.mjs` run from a SUBDIRECTORY of this
 *     repository reports `RESULT verdict: clean (dirty 0, unknown 0)` and exit 0,
 *     measured at this commit, because it enumerates `git ls-files` relative to cwd —
 *     while the same command at the toplevel reports `RESULT dirty(120 files, 259
 *     sites)` and `RESULT unknown(16 files, 24 sites)`. An instrument that cannot see
 *     the tree must refuse, not report clean. That defect is filed in
 *     `dev/agent-workflow/evidence/a4-pr7/7-6-merge-gate/FINDINGS.md`; this file does
 *     not repeat it, it refuses to be fooled by it (`classifyFenceRun` returns
 *     `partial-scan`, never `passed`).
 *
 * THE THREE SHAPES THIS GATE MAY NEVER ASSERT, per the coordinator's ruling of
 * 2026-10-08, and what it asserts instead:
 *   - NEVER an exit code alone (it read 0 while the client leg was skipped). Exit codes
 *     are recorded in the failure text; no test here keys on one.
 *   - NEVER a literal arm count. The plugin legs come from the gate's own `targets`
 *     array and the bundle arms from the `REQUIRED_CHECK_IDS` it prints from, both read
 *     from the instrument at run time, so a renamed or dropped arm fails by name and an
 *     added arm is required automatically.
 *   - NEVER "the root suite covers the client lane". Root vitest includes
 *     root include covers only files ending in `.test.ts` under `packages` and one test
 *     directory deep; the client specs end in `.client.spec.ts` or `.client.spec.tsx`,
 *     which that pattern cannot match — asserted from the config and the file list
 *     below, not claimed in prose.
 *
 * WHAT IS NOT HERE, AND SAYS SO. Plan §7.6 also lists the full root `pnpm test`, the
 * targeted `a4p7-v3-cutover-acceptance.test.ts`, and any leg needing a booted host on
 * the 3180 family. The first two are the root suite's own content: invoking them from
 * inside it is recursion, not a check (and `pnpm test` from inside `pnpm test` is an
 * infinite regress with extra steps). Booted-host legs cannot run in this environment at
 * all (`tests/deepseek-harness-test-use/packages/cli/dist` absent, empty Playwright
 * cache, no chrome binary) and are recorded NOT_RUN, never implied by a green static leg.
 * `pnpm build` and `pnpm build:composition` write into the working tree — including into
 * the *committed* surface `packages/client/composition-shim` — so they stay outer legs;
 * this file runs the freshness check they exist to satisfy (`check:artifacts`) and
 * records the split. The full list, with reasons, is in FINDINGS.md in this directory.
 */

import { describe, expect, it } from 'vitest'
import { spawn, spawnSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REQUIRED_CHECK_IDS } from '../../../scripts/composition-smoke-bundle.mjs'
import { PLUGIN_TARGETS } from '../../../scripts/composition-smoke-targets.mjs'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(TEST_DIR, '..', '..', '..')

/**
 * Plan §7.6's lint closure reference. Revoked predecessors
 * (`lint-identities-11e1609c.txt` and its 162 pair) are deliberately not accepted:
 * closure is "no new identity", and the file is named here so a silent retarget shows
 * up as a diff of this line.
 */
const LINT_BASELINE = 'dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt'

/**
 * The client lane's disclosed pre-existing failures, by NAME, from
 * `dev/agent-workflow/evidence/a4-client-baseline/README.md` (the trio is identical at
 * `11e1609c` and `d21effba`, i.e. pre-Alpha.4) with their titles as the suite prints
 * them today. Matching is by file + title, so a renamed test inside these files fails
 * the gate and forces the baseline record to be updated on purpose rather than by
 * drift. `s3-client-generation-spike.test.ts` is disclosed separately below: it is
 * location-dependent (its import climbs five directories, so it collects in a worktree
 * and fails in the main checkout), and that fact is in the same README.
 */
const CLIENT_BASELINE_FAILURES: readonly string[] = [
  'test/team-creation-panel.client.spec.tsx > TeamCreationPanel > selecting a blueprint loads the detail block and fires the persona-fact probe (S5-A, UI §6/§7)',
  'test/team-creation-panel.client.spec.tsx > TeamCreationPanel > switching the runtime preset re-runs the probe with the new persona fact (UI §7.3)',
  'test/team-governance.client.spec.tsx > TeamGovernance > an override reset targets the member instance (scope instance) and pulls once on success',
]
const CLIENT_DISCLOSED_LOCATION_DEPENDENT = 'test/s3-client-generation-spike.test.ts'

/**
 * The spec FILES the disclosed trio lives in, derived from the names above rather than
 * written out a second time: 3 named tests across 2 files, and a list that could drift
 * from the list it is supposed to guard is its own small defect.
 */
const CLIENT_TRIO_FILES: readonly string[] = [
  ...new Set(CLIENT_BASELINE_FAILURES.map((name) => (name.split(' > ')[0] ?? '').replace(/^test\//, ''))),
]

/**
 * Read the client lane's vitest report. This lives at module scope so the tolerance below
 * can be tested directly against reports it has never seen — including the one this file
 * could not previously tell apart (F5).
 *
 * THE TOLERANCE AND ITS LIMIT. §7.6 closes on three NAMED pre-existing client failures, so
 * a run reporting zero failures is acceptable: the trio may be fixed, and a gate that
 * requires failure would block the fix. It was implemented as "zero failures and zero name
 * matches ⇒ passed", which is vacuous in a way that matters — deleting the trio's spec
 * files also reports zero failures and zero matches, so the loudest way to satisfy this leg
 * was to erase what it inspects. Absence is now a separate answer from green: the files the
 * trio lives in must be in the directory listing, checked before the report is even read.
 * Green with the files present is a pass; a vanished file is a failure that says which one
 * and what to update if the removal was deliberate.
 */
function classifyClientLaneReport(run: { out: string; missingTrioFiles: readonly string[] }): {
  verdict: Verdict
  why: string
} {
  const out = run.out
  const summary = out.split('\n').filter((l) => /^\s*(Test Files|Tests)\s/.test(l)).join(' / ')
  if (summary.length === 0) {
    return { verdict: 'refused', why: `the client lane produced no vitest summary at all; tail: ${tail(out)}` }
  }
  const reportedFailures = /Tests\s+(\d+) failed/.exec(out)?.[1] ?? '0'
  const failed = [...out.matchAll(/^\s*FAIL\s+(.+)$/gm)].map((m) => (m[1] as string).trim())
  const outside = failed.filter(
    (f) => !CLIENT_BASELINE_FAILURES.some((b) => f.startsWith(b)) && !f.startsWith(CLIENT_DISCLOSED_LOCATION_DEPENDENT),
  )
  if (outside.length > 0) {
    return { verdict: 'failed', why: `new client-lane failures outside the disclosed baseline: ${outside.slice(0, 5).join(' | ')}` }
  }
  if (run.missingTrioFiles.length > 0) {
    return {
      verdict: 'failed',
      why:
        `${String(run.missingTrioFiles.length)} of the ${String(CLIENT_TRIO_FILES.length)} files the disclosed client baseline lives in is not in ` +
        `packages/client/test (${run.missingTrioFiles.join(', ')}) — a test that is not in the tree cannot fail, so a zero-failure ` +
        `report from this lane measures nothing. §7.6 closes ON the three named failures; if they were fixed or the files renamed, ` +
        `update dev/agent-workflow/evidence/a4-client-baseline/README.md and this file's CLIENT_BASELINE_FAILURES in the same change ` +
        `rather than letting the absence pass as a green.`,
    }
  }
  const matched = CLIENT_BASELINE_FAILURES.filter((b) => out.includes(b))
  if (reportedFailures !== '0' && matched.length === 0) {
    // The guard against a vacuous name set: failures were reported, none of them matched
    // the disclosed names, and nothing above caught it because the filter is a prefix match
    // over a set that may itself have drifted.
    return {
      verdict: 'failed',
      why: `${reportedFailures} client-lane failure(s) reported and NONE matched the disclosed names — the baseline record in a4-client-baseline/README.md has drifted and must be re-derived, not re-pinned silently: ${failed.slice(0, 5).join(' | ')}`,
    }
  }
  return {
    verdict: 'passed',
    why: `${summary} — every reported failure is disclosed, the trio's ${String(CLIENT_TRIO_FILES.length)} spec files are present, and ${String(matched.length)} of the baseline trio matched by name${reportedFailures === '0' ? '; the trio is GREEN, which §7.6 allows because the files are there to be re-run' : ''} (the s3 spike is location-dependent, see a4-client-baseline/README.md)`,
  }
}

type Verdict = 'passed' | 'failed' | 'refused'

interface LegRun {
  verdict: Verdict
  /** What the instrument said, or why it never got to speak. Always non-empty for a
   *  non-passed verdict: "refused" without a reason is the same hole as a mute. */
  why: string
  code: number | null
  stdout: string
  stderr: string
  signal: string | null
}

/** The tail of a capture, for a failure message that has to be readable in a terminal. */
function tail(text: string, lines = 12): string {
  const kept = text.trimEnd().split('\n').filter((l) => l.length > 0)
  return kept.slice(-lines).join('\n    ')
}

/**
 * Run one instrument and report which of the three answers it gave.
 *
 * THE RUNNER OWNS THREE REFUSALS, non-negotiably: the command is not there (ENOENT — the
 * `verify-zero-core.mjs` shape, a gate whose instrument is missing), it was killed by a
 * signal, and it hit its own timeout. A run that DID report is handed to `classify`,
 * whose contract is to answer `refused` for "reported nothing I can read" — every
 * classifier here does, because "no output" is never a green and the runner cannot know
 * what a given instrument's report is supposed to look like.
 */
async function runLeg(
  command: string,
  args: string[],
  opts: {
    cwd: string
    classify: (r: { stdout: string; stderr: string; code: number | null }) => { verdict: Verdict; why: string }
    timeoutMs: number
    label: string
  },
): Promise<LegRun> {
  return await new Promise<LegRun>((resolveLeg) => {
    // ASYNC ON PURPOSE. The first version of this runner used `spawnSync`, and the leg
    // then blocked the vitest worker thread for its whole duration: the test's own
    // timeout could not fire while the thread was blocked, so it fired the instant the
    // child exited and a leg that had just gone GREEN was reported as `Test timed out
    // in 5000ms`. A gate that cannot tell "slow" from "wrong" is the same defect it is
    // here to catch, so the child runs on the event loop and `opts.timeoutMs` is the
    // only bound that applies.
    const child = spawn(command, args, { cwd: opts.cwd, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, opts.timeoutMs)
    child.stdout.on('data', (chunk: Buffer) => {
      stdout += chunk.toString('utf8')
    })
    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8')
    })
    child.on('error', (error: NodeJS.ErrnoException) => {
      clearTimeout(timer)
      const why =
        error.code === 'ENOENT'
          ? `${opts.label}: the instrument is not there (${command} not found) — a gate whose command does not exist is not a gate that passed`
          : `${opts.label}: could not run (${error.message})`
      resolveLeg({ verdict: 'refused', why, code: null, stdout, stderr, signal: null })
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      if (timedOut) {
        resolveLeg({
          verdict: 'refused',
          why: `${opts.label}: killed after ${opts.timeoutMs}ms without reporting — an instrument that never finished has not checked anything. Output tail:\n    ${tail(stdout || stderr)}`,
          code,
          stdout,
          stderr,
          signal: signal ?? 'SIGKILL',
        })
        return
      }
      if (signal !== null) {
        // F2, and the reason this branch exists separately from the timeout above: a child
        // killed from OUTSIDE — OOM killer, a `pkill` in a cleanup path, a harness tearing
        // the tree down — can die AFTER flushing a syntactically complete report. Handing
        // that to `classify` would return `passed`, because the classifier is reading a
        // report and has no idea the author of that report was killed mid-sentence. A run
        // that did not reach its own exit is not a run that checked anything, however
        // well-formed its last line looked.
        resolveLeg({
          verdict: 'refused',
          why: `${opts.label}: terminated by signal ${signal} before it exited (code ${String(code)}) — whatever it printed last, it did not finish. Output tail:\n    ${tail(stdout || stderr)}`,
          code,
          stdout,
          stderr,
          signal,
        })
        return
      }
      const classified = opts.classify({ stdout, stderr, code })
      resolveLeg({ verdict: classified.verdict, why: classified.why, code, stdout, stderr, signal })
    })
  })
}

/**
 * This repository, resolved the way the instruments resolve it. Not `process.cwd()`: a
 * test file that trusts the cwd of whoever started vitest is how the subdirectory
 * false-clean gets into a gate (see the header).
 */
function repoToplevel(): string | null {
  const spawned = spawnSync('git', ['rev-parse', '--show-toplevel'], {
    cwd: TEST_DIR,
    encoding: 'utf8',
  })
  if (spawned.status !== 0) return null
  return spawned.stdout.trim()
}

/**
 * The plugin legs the composition gate intends to run, read OUT OF THE GATE — the same
 * frozen `PLUGIN_TARGETS` the gate iterates (`composition-smoke.mjs`'s step count is
 * documented as `PLUGIN_TARGETS.length + REQUIRED_CHECK_IDS.length`). A renamed target
 * moves this gate automatically; a target deleted without the plan changing shows up as
 * an arm that stopped being required, which is the reviewable form of that change.
 *
 * This replaced a source-text parse of `const targets = [`, and the parse is gone for a
 * reason worth keeping: the skip-fails round (`12a76047`) moved the table into
 * `composition-smoke-targets.mjs`, the parse silently read an empty block, and the
 * non-emptiness guard below is what stopped the loop that consumes it from becoming a
 * gate with no plugin arms required at all. Import what the instrument imports.
 */
function compositionTargets(): { label: string; expectedName: string }[] {
  const out = (PLUGIN_TARGETS as readonly { label: string; expectedName: string }[]).map((t) => ({
    label: t.label,
    expectedName: t.expectedName,
  }))
  // An empty derivation must not read as "no arms are required".
  if (out.length === 0) {
    throw new Error('compositionTargets() derived zero plugin targets from PLUGIN_TARGETS — no plugin arm would be required by this gate')
  }
  return out
}

/**
 * The bundle arms the composition gate intends to run, from the same frozen list it
 * renders them from. The symmetric tripwire to the one above: the plugin half is 2 of the
 * 11 arms today and the bundle half is 9, so an empty derivation here loses MORE of the
 * gate, and every consumer below is a `for` loop that would simply stop iterating. An
 * import that resolves to `[]` — a renamed export, a build step that stops writing it, a
 * merge that deletes entries — must be a loud failure at derivation time, not a green with
 * fewer requirements. See FINDINGS §15 for the residual this guard does NOT cover.
 */
function bundleArms(): readonly string[] {
  const ids = REQUIRED_CHECK_IDS as readonly string[]
  if (ids.length === 0) {
    throw new Error('bundleArms() derived zero ids from REQUIRED_CHECK_IDS — the bundle half of the composition gate (9 of the 11 arms today) would stop being required at all')
  }
  for (const id of ids) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new Error(`bundleArms() read a malformed id out of REQUIRED_CHECK_IDS (${String(id)}) — an arm that cannot be named cannot be required`)
    }
  }
  return ids
}

/**
 * Read the composition gate's own step lines. A SKIP is returned as its own category on
 * purpose: it is a step that did not run, and the historical defect this gate exists to
 * make impossible is the run that exited 0 while printing one.
 */
function classifyCompositionSmoke(run: { stdout: string; stderr?: string; code: number | null }): {
  verdict: Verdict
  why: string
  steps: string[]
  skipped: string[]
  failed: string[]
  footer: string | null
} {
  const all = run.stdout.split('\n').filter((l) => /^(PASS|FAIL|SKIP) /.test(l))
  // The footer is a line ABOUT the run, not a step OF it. Since `12a76047` a SKIP also
  // makes the footer read `FAIL composition-smoke — 1 step NOT RUN and NOT passed: …`,
  // and a classifier that counts that as an ordinary FAIL line loses the distinction this
  // gate exists to keep: the run failed BECAUSE a step never ran.
  const isFooter = (l: string) => /^(PASS|FAIL) composition-smoke/.test(l)
  const steps = all.filter((l) => !isFooter(l))
  const footer = run.stdout.split('\n').filter(isFooter).pop() ?? null
  if (all.length === 0) {
    return {
      verdict: 'refused',
      why: `composition-smoke printed no step line at all (exit ${run.code}); its output cannot be read as a green: ${tail(run.stdout || run.stderr || '')}`,
      steps,
      skipped: [],
      failed: [],
      footer,
    }
  }
  const failed = steps.filter((l) => l.startsWith('FAIL '))
  const skipped = steps.filter((l) => l.startsWith('SKIP '))
  if (failed.length > 0) {
    return { verdict: 'failed', why: `FAIL lines: ${failed.join(' | ')}`, steps, skipped, failed, footer }
  }
  if (skipped.length > 0) {
    return {
      verdict: 'refused',
      why:
        `steps NOT RUN: ${skipped.join(' | ')} — the footer reads "${footer ?? '(no footer line)'}" and the exit code was ` +
        `${String(run.code)}; neither is what this gate reads, because the step is the unit that did not run`,
      steps,
      skipped,
      failed,
      footer,
    }
  }
  return { verdict: 'passed', why: `${steps.length} step lines, none skipped, none failed`, steps, skipped, failed, footer }
}

/**
 * The fence's RESULT lines, read as the contract they are. Two invariants, both shape
 * rather than counts, because the fence's own closure condition is owned by
 * `a4p7-blueprint-version-clean.test.ts` (another lane, in review) and this gate must
 * not silently inherit that judgement:
 *   - `not-run` is never a clean, whatever the exit code says;
 *   - a `clean` verdict is only believed when the dirty and unknown counts beside it are
 *     zero, and only when the scan saw the whole repository (see `universe`).
 */
function classifyFenceRun(
  run: { stdout: string; code: number | null; stderr: string },
  universe: { cwd: string; toplevel: string; filesAtToplevel: number; filesScannedHere: number },
): { verdict: Verdict; why: string; counts: Record<string, { files: number; sites: number }> } {
  const lines = run.stdout.split('\n').filter((l) => l.startsWith('RESULT '))
  const counts: Record<string, { files: number; sites: number }> = {}
  for (const line of lines) {
    const m = /^RESULT (\w+)(?:\((\d+) files?, (\d+) sites?\))?/.exec(line)
    if (m === null) continue
    counts[m[1] as string] = { files: Number(m[2] ?? -1), sites: Number(m[3] ?? -1) }
  }
  if (lines.length === 0) {
    return {
      verdict: 'refused',
      why: `the fence printed no RESULT line at all (exit ${run.code}); silence is not a clean tree: ${tail(run.stdout || run.stderr || '')}`,
      counts,
    }
  }
  if (run.stdout.includes('RESULT not-run')) {
    return {
      verdict: 'refused',
      why: `the fence refused: ${lines.find((l) => l.startsWith('RESULT not-run'))}`,
      counts,
    }
  }
  if (universe.cwd !== universe.toplevel && universe.filesScannedHere < universe.filesAtToplevel) {
    return {
      verdict: 'refused',
      why:
        `partial scan: run from ${relative(universe.toplevel, universe.cwd) || '.'} enumerated ${universe.filesScannedHere} of ` +
        `${universe.filesAtToplevel} tracked files and reported "${lines.find((l) => l.includes('verdict')) ?? '(no verdict line)'}". ` +
        `A repo-scoped instrument run below the toplevel sees a subtree; accepting that as clean is the false-clean class.`,
      counts,
    }
  }
  const verdictLine = lines.find((l) => l.includes('verdict')) ?? ''
  const claimsClean = /verdict:\s*clean/.test(verdictLine)
  const dirty = counts.dirty?.files ?? -1
  const unknown = counts.unknown?.files ?? -1
  if (claimsClean && (dirty !== 0 || unknown !== 0)) {
    return {
      verdict: 'failed',
      why: `the fence says clean while reporting dirty(${dirty}) / unknown(${unknown}) — the verdict line contradicts its own counts: ${verdictLine}`,
      counts,
    }
  }
  if (claimsClean) return { verdict: 'passed', why: `clean at the toplevel: ${verdictLine}`, counts }
  // Not clean: dirty and/or unknown sites exist. Whether they are ADJUDICATED is the
  // wrapper test's call (its deferral list names the owning lane per path), so this leg
  // reports the state instead of pretending to own it; the FINDINGS entry marks the
  // dependency. The merge gate still gets a hard assertion from this run: the counts
  // came back, per class, and the offending set is enumerated by path.
  const enumerated = run.stdout.split('\n').filter((l) => /^(OFFENDING|UNKNOWN)\s/.test(l)).length
  if (enumerated < Math.max(dirty, 0)) {
    return {
      verdict: 'failed',
      why: `the fence reported ${dirty} dirty files but enumerated only ${enumerated} — a verdict without the offending set by path cannot be reviewed`,
      counts,
    }
  }
  return {
    verdict: 'passed',
    why: `ran at the toplevel and reported every class with its set by path: ${lines.map((l) => l.replace('RESULT ', '')).join(' / ')}`,
    counts,
  }
}

function trackedFileCount(cwd: string): number {
  // maxBuffer is explicit: this repository tracks thousands of files and the spawnSync
  // default (1MB) truncates the list, which would read as a small universe.
  const spawned = spawnSync('git', ['ls-files'], { cwd, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (spawned.status !== 0) return -1
  return spawned.stdout.split('\n').filter((l) => l.length > 0).length
}

function classifyArtifactsRun({ stdout, stderr, code }: {
  stdout: string
  stderr: string
  code: number | null
}): { verdict: Verdict; why: string } {
    const out = `${stdout}${stderr}`
    const ok = /OK: (\d+) files/.exec(out)
    if (ok !== null) {
      return Number(ok[1] as string) > 0
        ? { verdict: 'passed' as Verdict, why: ok[0] as string }
        : { verdict: 'refused' as Verdict, why: 'check:artifacts compared zero files — nothing was checked' }
    }
    if (/NOT-RUN: the produced set is empty/.test(out)) {
      return {
        verdict: 'refused' as Verdict,
        why: `check:artifacts compared an empty produced set and refused to report OK (exit ${code}): ${out.split('\n').find((l) => l.includes('NOT-RUN')) ?? ''}`,
      }
    }
    if (/missing — run `pnpm build/.test(out)) {
      // Note what this branch cannot say: a run from a SUBDIRECTORY lands here too,
      // because the script's ROOT is `process.cwd()`. Measured at this commit, cwd
      // `packages/testkit` prints "packages/runtime/dist missing — run `pnpm build
      // && pnpm build:composition` first" when the actual cause is the cwd. Refused
      // either way (nothing was compared); the misdiagnosis is filed in FINDINGS §5.
      return {
        verdict: 'refused' as Verdict,
        why: `the install surface is not there where this run was standing, so the freshness check compared nothing (exit ${code}) — either it was never built or the cwd is not the toplevel`,
      }
    }
    if (/STALE install-surface artifacts/.test(out)) {
      return { verdict: 'failed' as Verdict, why: `stale install-surface artifacts: ${tail(out)}` }
    }
    return { verdict: 'refused' as Verdict, why: `check:artifacts produced no verdict at all (exit ${code}); tail: ${tail(out)}` }
  }

describe('A4-PR7 §7.6 — the code merge gate, driven by real commands', () => {
  it('runs where its instruments can see the tree, and refuses to run anywhere else', () => {
    const toplevel = repoToplevel()
    expect(toplevel, 'this spec resolves its instruments from a git work tree; outside one every repo-scoped leg below would be a false clean').not.toBeNull()
    expect(resolve(toplevel as string)).toBe(resolve(REPO_ROOT))
    expect(existsSync(join(REPO_ROOT, 'scripts', 'composition-smoke.mjs')), 'the merge gate names scripts/composition-smoke.mjs; it must exist').toBe(true)
    expect(existsSync(join(REPO_ROOT, LINT_BASELINE)), `the revoked lint baselines are not acceptable; ${LINT_BASELINE} must be present`).toBe(true)
  })

  describe('the composition smoke leg (plan 7.5/7.6: a red here blocks the merge)', () => {
    const run = async () =>
      await runLeg(process.execPath, ['scripts/composition-smoke.mjs'], {
        cwd: REPO_ROOT,
        timeoutMs: 300_000,
        label: 'pnpm smoke:composition',
        classify: classifyCompositionSmoke,
      })

    it('is green, asserted by arm name and by absence of a skip — never by the exit code', { timeout: 330000 }, async () => {
      const r = await run()
      const parsed = classifyCompositionSmoke({ stdout: r.stdout, code: r.code })
      expect(r.verdict, `composition-smoke did not pass. why: ${r.why}\n    output tail:\n    ${tail(r.stdout || r.stderr)}`).toBe('passed')

      for (const target of compositionTargets()) {
        expect(
          parsed.steps.some((l) => l.startsWith(`PASS ${target.label}: `) && l.includes(`name="${target.expectedName}"`)),
          `the ${target.label} leg is not a PASS line naming plugin "${target.expectedName}": ${parsed.steps.filter((l) => l.includes(target.label)).join(' | ') || '(no line for this target at all)'}`,
        ).toBe(true)
      }
      for (const id of bundleArms()) {
        expect(
          parsed.steps.some((l) => l.startsWith('PASS ') && l.includes(` ${id} (`)),
          `required bundle arm "${id}" did not print a PASS line — an arm that stopped reporting is a closed gate, not a green one`,
        ).toBe(true)
      }
      // Derived, never literal: the gate documents its own step count as
      // `PLUGIN_TARGETS.length + REQUIRED_CHECK_IDS.length`, so the number of STEPS it
      // printed is checked against the two lists it prints from, not against a number
      // written in this file.
      expect(parsed.steps.length, 'the number of step lines must equal the two derived arm lists the gate prints from').toBe(
        compositionTargets().length + bundleArms().length,
      )
      expect(parsed.footer, 'the summary line must be the unqualified one').toBe('PASS composition-smoke')
      expect(r.stdout).not.toMatch(/NOT RUN/)
    })

    it('treats a step that did not run as a failure that says why, even at exit 0', () => {
      // The historical shape, quoted from the base this lane was opened on: a named SKIP
      // and a footer that admitted it, with the process exiting 0 anyway.
      const historical = classifyCompositionSmoke({
        stdout:
          'PASS host plugin (packages/runtime): name="dsh-agent-team", apply fails loud on degenerate context\n' +
          'SKIP client plugin (packages/client): host module closure unavailable — 17 unresolvable: clsx, anser, katex\n' +
          'PASS composition-smoke — 1 step NOT RUN and NOT passed: client plugin (packages/client). A skipped step is an unverified claim, not a green one.\n',
        code: 0,
      })
      expect(historical.verdict).toBe('refused')
      expect(historical.why).toContain('17 unresolvable: clsx')
      expect(historical.why).toContain('exit code was 0')
      // And the mirror-image mistake: a missing built artifact is a FAILURE, not a skip.
      const missingArtifact = classifyCompositionSmoke({
        stdout: 'FAIL client plugin (packages/client): built entry is missing — run `pnpm build` first (a missing artifact is a failure, never a skip)\n',
        code: 1,
      })
      expect(missingArtifact.verdict).toBe('failed')
    })

    it('says so by name when the built client entry is gone, and does not skip past it', { timeout: 330000 }, async () => {
      const dist = join(REPO_ROOT, 'packages', 'client', 'dist')
      const held = `${dist}.held-by-7-6-gate`
      expect(existsSync(dist), 'packages/client/dist must exist for this leg to mutate it — run `pnpm build` first').toBe(true)
      spawnSync('mv', [dist, held], { cwd: REPO_ROOT })
      try {
        const r = await runLeg(process.execPath, ['scripts/composition-smoke.mjs'], {
          cwd: REPO_ROOT,
          timeoutMs: 300_000,
          label: 'composition-smoke with the built client entry removed',
          classify: classifyCompositionSmoke,
        })
        expect(r.verdict, `a missing artifact must read as failed, not refused/passed: ${r.why}`).toBe('failed')
        expect(r.stdout).toMatch(/^FAIL client plugin \(packages\/client\): built entry is missing/m)
        expect(r.stdout).not.toMatch(/^SKIP client plugin/m)
      } finally {
        spawnSync('mv', [held, dist], { cwd: REPO_ROOT })
      }
      expect(existsSync(dist), 'the mutation was not restored — the worktree is left dirty').toBe(true)
    })

    it('refuses the leg, by name, when the host module closure cannot be traversed', { timeout: 330000 }, async () => {
      // The cheapest honest way to break the closure is to hide ONE hoisted copy the
      // upstream entry resolves through — the same lever documented in
      // dev/agent-workflow/evidence/a4-pr7/7-6-client-leg/hoist-pattern-experiment.txt.
      const hoist = join(REPO_ROOT, 'node_modules', '.pnpm', 'node_modules', 'clsx')
      const held = `${hoist}.held-by-7-6-gate`
      expect(existsSync(hoist), 'node_modules/.pnpm/node_modules/clsx must exist — `hoistPattern` is declared in pnpm-workspace.yaml and an install must restore it').toBe(true)
      spawnSync('mv', [hoist, held], { cwd: REPO_ROOT })
      try {
        const r = await runLeg(process.execPath, ['scripts/composition-smoke.mjs'], {
          cwd: REPO_ROOT,
          timeoutMs: 300_000,
          label: 'composition-smoke with one hoisted package hidden',
          classify: classifyCompositionSmoke,
        })
        expect(r.verdict, `a broken closure must read as refused (a step that did not run): ${r.why}`).toBe('refused')
        expect(r.stdout).toMatch(/^SKIP client plugin \(packages\/client\): host module closure unavailable.*clsx/m)
      } finally {
        spawnSync('mv', [held, hoist], { cwd: REPO_ROOT })
      }
      expect(existsSync(hoist), 'the mutation was not restored — the worktree is left dirty').toBe(true)
    })
  })

  describe('the fence leg (plan 7.6: the wrapper must be green; this leg owns the cwd doctrine)', () => {

    it('reports every verdict class with its set by path when run at the toplevel', { timeout: 630000 }, async () => {
      const toplevel = repoToplevel() as string
      const r = await runLeg(process.execPath, ['scripts/verify-blueprint-version-clean.mjs'], {
        cwd: REPO_ROOT,
        timeoutMs: 600_000,
        label: 'the blueprint-version fence',
        classify: (x) => classifyFenceRun(x, { cwd: REPO_ROOT, toplevel, filesAtToplevel: trackedFileCount(REPO_ROOT), filesScannedHere: trackedFileCount(REPO_ROOT) }),
      })
      expect(r.verdict, `the fence did not report cleanly. why: ${r.why}`).toBe('passed')
      for (const cls of ['dirty', 'unknown', 'advisory', 'refused', 'prose', 'adjudicated', 'verdict']) {
        expect(r.stdout, `the fence stopped reporting the "${cls}" class`).toContain(`RESULT ${cls}`)
      }
      // The universe it scanned is printed, so every count can be read against a size.
      const scanned = /scanned-in-scope: (\d+) tracked files/.exec(r.stdout)?.[1] ?? '0'
      expect(scanned, 'the fence stopped reporting `scanned-in-scope: N tracked files`; a verdict with no stated universe cannot be reviewed').not.toBe('0')
    })

    it('refuses a directory that is not a repository, and is never believed as clean', { timeout: 150000 }, async () => {
      const scratch = join(REPO_ROOT, '.tmp-7-6-gate-not-a-repo')
      spawnSync('mkdir', ['-p', scratch], { cwd: REPO_ROOT })
      try {
        const r = await runLeg(process.execPath, [join(REPO_ROOT, 'scripts', 'verify-blueprint-version-clean.mjs')], {
          cwd: scratch,
          timeoutMs: 120_000,
          label: 'the blueprint-version fence outside a repository',
          classify: (x) => classifyFenceRun(x, { cwd: scratch, toplevel: REPO_ROOT, filesAtToplevel: -1, filesScannedHere: -1 }),
        })
        expect(r.verdict).toBe('refused')
        expect(r.stdout).toContain('RESULT not-run')
        expect(r.stdout).not.toContain('RESULT clean')
        expect(r.stdout).not.toMatch(/verdict:\s*clean/)
      } finally {
        spawnSync('rm', ['-rf', scratch], { cwd: REPO_ROOT })
      }
    })

    it('will not accept a run from below the toplevel as a whole-tree clean (measured false-clean)', { timeout: 630000 }, async () => {
      const toplevel = repoToplevel() as string
      const sub = join(REPO_ROOT, 'packages', 'testkit')
      const r = await runLeg(process.execPath, [join(REPO_ROOT, 'scripts', 'verify-blueprint-version-clean.mjs')], {
        cwd: sub,
        timeoutMs: 600_000,
        label: 'the blueprint-version fence from packages/testkit',
        classify: (x) =>
          classifyFenceRun(x, { cwd: sub, toplevel, filesAtToplevel: trackedFileCount(REPO_ROOT), filesScannedHere: trackedFileCount(sub) }),
      })
      // Measured at `79aeddb2` this run printed `RESULT verdict: clean (dirty 0, unknown
      // 0)` at exit 0 while the toplevel reported dirty(120)/unknown(16) — the finding
      // FINDINGS §5 files. The fence lane has since fixed it: at `ff9218a3` the same run
      // prints `RESULT not-run :: cwd … is not the repository toplevel …; the fence gates
      // on the WHOLE tree` and exits 2. Both halves are asserted because they are two
      // different promises: the instrument refuses, AND this gate would refuse even if it
      // stopped to.
      expect(r.stdout, 'the fence itself must refuse a subtree run, and must not report a verdict for it').toContain('RESULT not-run')
      expect(r.stdout).not.toMatch(/verdict:\s*clean/)
      expect(r.verdict, `a subtree run must never be believed as a whole-tree clean; it returned: ${r.why}`).toBe('refused')
    })
  })

  describe('the static legs', () => {
    it('lint closes as an identity diff against the named baseline, not against a count', { timeout: 930000 }, async () => {
      const r = await runLeg(process.execPath, ['scripts/lint-identities.mjs', '--diff', LINT_BASELINE], {
        cwd: REPO_ROOT,
        timeoutMs: 900_000,
        label: 'pnpm lint:identities --diff <baseline>',
        classify: ({ stdout, code }) => {
          const m = /new (\d+), resolved (\d+)/.exec(stdout)
          if (m === null) {
            return { verdict: 'refused' as Verdict, why: `the identity diff produced no "new N, resolved N" verdict (exit ${code}); output tail: ${tail(stdout || '')}` }
          }
          const reported = /identity lines/.test(stdout)
          if (!reported) {
            return { verdict: 'refused' as Verdict, why: 'the lint normaliser reported no identity lines — an empty scan is not a clean one' }
          }
          return Number(m[1] as string) === 0
            ? { verdict: 'passed' as Verdict, why: stdout.trim().split('\n').slice(-1)[0] as string }
            : { verdict: 'failed' as Verdict, why: `new lint identities against the accepted baseline: ${stdout.trim().split('\n').slice(-3).join(' | ')}` }
        },
      })
      expect(r.verdict, `lint leg did not close. why: ${r.why}\n    tail:\n    ${tail(r.stdout || r.stderr)}`).toBe('passed')
    })

    it('the committed install surface is fresh against the tree, and a missing surface is refused', { timeout: 330000 }, async () => {
      const r = await runLeg(process.execPath, ['scripts/check-artifacts-committed.mjs'], {
        cwd: REPO_ROOT,
        timeoutMs: 300_000,
        label: 'pnpm check:artifacts',
        classify: classifyArtifactsRun,
      })
      expect(r.verdict, `check:artifacts did not pass. why: ${r.why}`).toBe('passed')
      // The refused branches, pinned against the strings the script actually prints
      // (checked against `scripts/check-artifacts-committed.mjs` at this commit) without
      // wrecking the tree to produce them.
      expect(classifyArtifactsRun({ stdout: '', stderr: '[check-artifacts-committed] ERROR: packages/runtime/dist missing — run `pnpm build && pnpm build:composition` first.', code: 1 }).verdict).toBe('refused')
      expect(classifyArtifactsRun({ stdout: '', stderr: '[check-artifacts-committed] NOT-RUN: the produced set is empty (0 of 0 files on disk survived the ignore filter) — the gate compared nothing and must not report OK.', code: 2 }).verdict).toBe('refused')
      expect(classifyArtifactsRun({ stdout: '[check-artifacts-committed] OK: 1508 files; committed install-surface artifacts match the fresh build (incl. 1 glue placement(s))', stderr: '', code: 0 }).verdict).toBe('passed')
      expect(classifyArtifactsRun({ stdout: '[check-artifacts-committed] OK: 0 files; committed install-surface artifacts match the fresh build (incl. 0 glue placement(s))', stderr: '', code: 0 }).verdict).toBe('refused')
    })

    it('a check:artifacts run from a subdirectory is refused, never an OK over nothing', async () => {
      // The third cwd instance this phase measured, and the only one the instrument now
      // catches by itself: `ROOT = process.cwd()`, so from `packages/testkit` the surfaces
      // are "missing" relative to where the run is standing. It exits 1 rather than
      // printing OK — this asserts that the merge gate reads that as "nothing was
      // compared", not as "the artifacts are fine".
      const sub = join(REPO_ROOT, 'packages', 'testkit')
      const r = await runLeg(process.execPath, [join(REPO_ROOT, 'scripts', 'check-artifacts-committed.mjs')], {
        cwd: sub,
        timeoutMs: 120_000,
        label: 'check:artifacts from packages/testkit',
        classify: classifyArtifactsRun,
      })
      expect(r.verdict, `a subtree check:artifacts run must never be believed: ${r.why}`).toBe('refused')
      expect(`${r.stdout}${r.stderr}`).not.toContain('OK:')
    })

    it('every workspace package that declares a typecheck script typechecks', { timeout: 1830000 }, async () => {
      const expected = readdirSync(join(REPO_ROOT, 'packages'))
        .filter((p) => existsSync(join(REPO_ROOT, 'packages', p, 'package.json')))
        .filter((p) => {
          const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'packages', p, 'package.json'), 'utf8')) as { scripts?: Record<string, string> }
          return typeof manifest.scripts?.typecheck === 'string'
        })
        .map((p) => `packages/${p}`)
      expect(expected.length, 'the expected package set is derived from the workspace manifests; an empty set means the derivation broke').toBeGreaterThan(0)

      const r = await runLeg('pnpm', ['-r', 'run', 'typecheck'], {
        cwd: REPO_ROOT,
        timeoutMs: 1_800_000,
        label: 'pnpm -r run typecheck',
        classify: ({ stdout, stderr, code }) => {
          const out = `${stdout}${stderr}`
          if (!/typecheck/.test(out)) {
            return { verdict: 'refused' as Verdict, why: `typecheck output names no typecheck run at all (exit ${code}); tail: ${tail(out)}` }
          }
          const errors = out.split('\n').filter((l) => l.includes('error TS'))
          if (errors.length > 0) return { verdict: 'failed' as Verdict, why: `${errors.length} TypeScript error line(s): ${errors.slice(0, 3).join(' | ')}` }
          const missing = expected.filter((p) => !new RegExp(`${p} typecheck: Done`).test(out))
          if (missing.length > 0) {
            return { verdict: 'refused' as Verdict, why: `these packages declared a typecheck script and never reported Done (a package that did not run is not a package that passed): ${missing.join(', ')}` }
          }
          return { verdict: 'passed' as Verdict, why: `${expected.length} packages reported Done, 0 error TS lines` }
        },
      })
      expect(r.verdict, `typecheck leg did not pass. why: ${r.why}\n    tail:\n    ${tail(r.stdout || r.stderr)}`).toBe('passed')
    })
  })

  describe('the client lane (the root suite cannot see it, and this gate says why)', () => {
    it('no *.client.spec file is reachable from the root vitest include, so a root-suite claim proves nothing here', () => {
      const rootConfig = readFileSync(join(REPO_ROOT, 'vitest.config.ts'), 'utf8')
      const include = /include:\s*\[([^\]]*)\]/.exec(rootConfig)?.[1] ?? ''
      expect(include).toContain('packages/*/test/**/*.test.ts')
      const clientTests = readdirSync(join(REPO_ROOT, 'packages', 'client', 'test'))
      const clientSpecs = clientTests.filter((f) => f.endsWith('.client.spec.ts') || f.endsWith('.client.spec.tsx'))
      expect(clientSpecs.length, 'the client lane is defined by *.client.spec files; finding none means the check stopped meaning anything').toBeGreaterThan(0)
      const pattern = /\.test\.ts$/
      const visibleToRoot = clientSpecs.filter((f) => pattern.test(f))
      expect(visibleToRoot, `the root include ${include} cannot match *.client.spec files, so the client lane needs its own leg`).toEqual([])
    })

    it('the client lane runs, and no failure appears outside the disclosed baseline', { timeout: 1830000 }, async () => {
      // The listing is taken BEFORE the lane runs and never re-read: the answer about what
      // is in the tree must not be shapeable by the run whose honesty is in question.
      const listing = readdirSync(join(REPO_ROOT, 'packages', 'client', 'test'))
      const missingTrioFiles = CLIENT_TRIO_FILES.filter((f) => !listing.includes(f))
      const r = await runLeg('pnpm', ['--filter', './packages/client', 'run', 'test'], {
        cwd: REPO_ROOT,
        timeoutMs: 1_800_000,
        label: 'pnpm --filter @dsh-agent-team/client run test',
        // vitest writes its report to stderr and pnpm prefixes it with the package name, so
        // the lane is read from BOTH streams. Reading only stdout is how a lane that failed
        // loudly reads as a lane that said nothing.
        classify: ({ stdout, stderr }) => classifyClientLaneReport({ out: `${stdout}\n${stderr}`, missingTrioFiles }),
      })
      expect(r.verdict, `client lane did not close. why: ${r.why}\n    tail:\n    ${tail(`${r.stdout}\n${r.stderr}`, 25)}`).toBe('passed')
    })

    it('tolerates a green trio and refuses a vanished one — the two are different answers', () => {
      // F5. The tolerance above ("zero failures is acceptable, the trio may have been
      // fixed") was satisfied by an absence too, which means deleting the trio's spec
      // files used to turn this leg GREEN. The cases below are the report text the real
      // lane prints, with nothing but the file listing changed, so the distinction is
      // machine-checked rather than a comment that promises care.
      const green = ' Test Files  55 passed (55)\n      Tests  880 passed (880)\n'
      const trioRed =
        '      Tests  3 failed | 877 passed (880)\n' +
        CLIENT_BASELINE_FAILURES.map((n) => `   FAIL ${n}`).join('\n') +
        '\n'
      expect(classifyClientLaneReport({ out: green, missingTrioFiles: [] }).verdict, 'a green trio with the files present must pass — §7.6 must not require failure').toBe('passed')
      expect(
        classifyClientLaneReport({ out: green, missingTrioFiles: ['team-creation-panel.client.spec.tsx'] }).verdict,
        'the same green report with one trio file missing must FAIL: an erased test cannot fail',
      ).toBe('failed')
      expect(
        classifyClientLaneReport({ out: green, missingTrioFiles: ['team-creation-panel.client.spec.tsx'] }).why,
        'the failure has to name the file and say what to update, or the next reader cannot tell deletion from a bad listing',
      ).toContain('team-creation-panel.client.spec.tsx')
      expect(classifyClientLaneReport({ out: trioRed, missingTrioFiles: [] }).verdict, 'the measured state today: trio red by name, files present').toBe('passed')
      expect(classifyClientLaneReport({ out: green, missingTrioFiles: CLIENT_TRIO_FILES }).why).toContain('cannot fail')
      expect(
        classifyClientLaneReport({ out: ' Test Files  1 failed (1)\n      Tests  1 failed | 1 passed (2)\n   FAIL test/some-other.client.spec.tsx > x > y', missingTrioFiles: [] }).verdict,
        'an undisclosed failure is a failure even when the trio is quiet',
      ).toBe('failed')
      expect(classifyClientLaneReport({ out: 'no report, just noise', missingTrioFiles: [] }).verdict).toBe('refused')
      // The trio's file list is derived, so this guards the derivation too: 3 names, 2 files.
      expect(CLIENT_TRIO_FILES, 'the trio is 3 named tests across 2 files; anything else means CLIENT_BASELINE_FAILURES was edited without this check').toEqual([
        'team-creation-panel.client.spec.tsx',
        'team-governance.client.spec.tsx',
      ])
    })
  })

  describe('the runner itself refuses what never ran', () => {
    it('a missing instrument is a refusal that names it, never a pass', async () => {
      const r = await runLeg('a4p76-instrument-that-does-not-exist', [], {
        cwd: REPO_ROOT,
        timeoutMs: 10_000,
        label: 'the missing instrument',
        classify: () => ({ verdict: 'passed' as Verdict, why: 'unreachable — the runner must refuse before classify' }),
      })
      expect(r.verdict).toBe('refused')
      expect(r.why).toContain('a4p76-instrument-that-does-not-exist')
    })

    it('an instrument that is killed before reporting is a refusal that says so', async () => {
      const r = await runLeg(process.execPath, ['-e', 'setTimeout(() => process.exit(0), 30_000)'], {
        cwd: REPO_ROOT,
        timeoutMs: 500,
        label: 'the silent instrument',
        classify: () => ({ verdict: 'passed' as Verdict, why: 'unreachable — a killed child must not reach classify as a green' }),
      })
      expect(r.verdict).toBe('refused')
      expect(r.why).toContain('killed after 500ms')
    })

    it('a child killed by a signal is refused even when it printed a complete report', async () => {
      // F2. The distinction this leg pins is NOT "printed nothing" — the child below prints
      // a perfectly well-formed PASS line and flushes it, then kills itself. Handled at the
      // classifier, that reads `passed`; handled by the runner, it is a refusal naming the
      // signal. This is the OOM-killer / stray-pkill / teardown-during-shutdown case, and it
      // is the case the earlier version of this runner mislabelled.
      const r = await runLeg('sh', ['-c', 'printf "PASS synthetic-instrument: every arm reported, nothing to see\\n"; kill -KILL $$'], {
        cwd: REPO_ROOT,
        timeoutMs: 30_000,
        label: 'the instrument killed from outside',
        classify: () => ({ verdict: 'passed' as Verdict, why: 'unreachable — a signalled child must never reach classify as a green' }),
      })
      expect(r.verdict, `a signalled child reported '${r.stdout.trim()}' and must still be refused`).toBe('refused')
      expect(r.signal).toBe('SIGKILL')
      expect(r.why).toContain('terminated by signal SIGKILL')
      expect(r.stdout).toContain('PASS synthetic-instrument')
    })
  })

  describe('the gate is wired, not remembered', () => {
    it('every §7.6 command this gate claims is invoked from a test, so none becomes another verify-zero-core', () => {
      const testFiles = readdirSync(TEST_DIR).filter((f) => f.endsWith('.test.ts'))
      // A file may mention an instrument in a comment while invoking nothing, and this test
      // would have stayed green on that (F1). So the match is scoped to the head of a
      // `runLeg(` call, where the argv actually lives: the promise under review is "some
      // test spawns this", not "some test has heard of this".
      const spawnWindows = testFiles
        .map((f) => readFileSync(join(TEST_DIR, f), 'utf8'))
        .flatMap((text) => {
          const windows: string[] = []
          let at = text.indexOf('runLeg(')
          while (at !== -1) {
            windows.push(text.slice(at, at + 400))
            at = text.indexOf('runLeg(', at + 1)
          }
          return windows
        })
      const rootManifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
      // Each instrument must be reachable from a root script when plan §7.6 names one,
      // and named by a test that spawns it either way. The second half is the point:
      // `verify-zero-core.mjs` is the precedent the plan cites — a script that exists
      // and is invoked by nothing — and until this file existed the same was true of
      // `smoke:composition` and `check:artifacts`.
      const instruments: { file: string; rootScript: string | null }[] = [
        { file: 'composition-smoke.mjs', rootScript: 'smoke:composition' },
        { file: 'check-artifacts-committed.mjs', rootScript: 'check:artifacts' },
        { file: 'lint-identities.mjs', rootScript: 'lint:identities' },
        { file: 'verify-blueprint-version-clean.mjs', rootScript: null },
      ]
      for (const { file, rootScript } of instruments) {
        if (rootScript !== null) {
          expect(rootManifest.scripts[rootScript] ?? null, `root package.json has no "${rootScript}" script for ${file}`).not.toBeNull()
        }
        const quoted = new RegExp(`["'][^"']*${file.replace(/\./g, '\\.')}["']`)
        expect(
          spawnWindows.some((w) => quoted.test(w)),
          `${file} is not passed to any runLeg(...) argv under packages/testkit/test — a comment naming it is not an invocation, and an instrument nobody spawns is the verify-zero-core shape this test exists to catch`,
        ).toBe(true)
      }
    })

    it('this spec itself is counted by the p4t6 scannable-file ledger', () => {
      // A new file under a counted path is a p4t6 increment: the lane names its own path
      // and moves its own tie. Asserting the registration here means a rebase that
      // silently drops the lane entry reddens this file instead of quietly lowering the
      // scanner's total for the next reader.
      const p4t6 = readFileSync(join(TEST_DIR, 'p4t6-session-event-scan.test.ts'), 'utf8')
      const myPath = relative(REPO_ROOT, join(TEST_DIR, 'a4p7-merge-gate.test.ts')).replace(/\\/g, '/')
      // F1 again, same disease: `p4t6.toContain(myPath)` was satisfied by a COMMENT naming
      // the path, so deleting the array entry — the only part the scanner counts — left this
      // test green. Match the entry inside the lane's array literal instead. The derived-sum
      // assertion in p4t6 already reddens on such a deletion, so this is precision, not
      // teeth; precision is the reason the ledger exists.
      const laneList = /const SCANNED_PATHS_A4P76GATE[^=]*=\s*\[([^\]]*)\]/.exec(p4t6)
      expect(laneList, 'p4t6 has no `const SCANNED_PATHS_A4P76GATE = […]` array literal — re-add the lane list, and its own tie').not.toBeNull()
      expect(
        (laneList?.[1] ?? '').replace(/\s+/g, ' '),
        `${myPath} is not an ENTRY in SCANNED_PATHS_A4P76GATE — add the path and move that lane's own tie; never hand-write a total, and never count a mention`,
      ).toContain(`'${myPath}'`)
    })
  })
})
