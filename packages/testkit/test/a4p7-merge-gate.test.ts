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
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { REQUIRED_CHECK_IDS } from '../../../scripts/composition-smoke-bundle.mjs'
import { PLUGIN_TARGETS } from '../../../scripts/composition-smoke-targets.mjs'
import { INSTALL_SURFACES } from '../../../scripts/client-composition-surface.mjs'
import { describeStderr } from '../../../scripts/lint-identities.mjs'
import { absentArtifactVerdict, artifactProvenance, classifyAbsentArtifact, treeShape } from '../../../scripts/a4-artifact-provenance.mjs'
import type { ArtifactProvenance } from '../../../scripts/a4-artifact-provenance.mjs'

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
function compositionTargets(): { label: string; expectedName: string; rel: string; closureGate: boolean }[] {
  const out = (PLUGIN_TARGETS as readonly { label: string; expectedName: string; rel: string; closureGate?: boolean }[]).map((t) => ({
    label: t.label,
    expectedName: t.expectedName,
    // `rel` is the artifact the arm loads, and `closureGate` says which arm's load depends
    // on the host module closure. Both are carried so the legs that mutate an artifact read
    // the gate's own list instead of repeating a path this file would then have to keep true.
    rel: t.rel,
    closureGate: t.closureGate === true,
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
 * The plugin entries the composition gate loads, measured at the moment a run's report is
 * classified. This is a THUNK passed into the classifier rather than a value, and the reason
 * is ordering: the mutation legs move artifacts out of the way and put them back, so the
 * tree that produced a report is the tree that must be measured — measuring before the run
 * would describe a shape the run never saw.
 */
function compositionArtifacts(): { label: string; rel: string; prov: ReturnType<typeof artifactProvenance> }[] {
  return compositionTargets().map((t) => ({
    label: t.label,
    rel: t.rel,
    prov: artifactProvenance({ repoRoot: REPO_ROOT, rel: t.rel, label: t.label }),
  }))
}

/**
 * Read the composition gate's own step lines. A SKIP is returned as its own category on
 * purpose: it is a step that did not run, and the historical defect this gate exists to
 * make impossible is the run that exited 0 while printing one.
 *
 * A missing artifact used to be folded into that same `failed` bucket by this classifier,
 * and that was a lie of the opposite sign to the SKIP bug: `FAIL client plugin (packages/
 * client): built entry is missing — run \`pnpm build\` first` is the GATE doing the right
 * thing (a gate with two states must pick the strict one, and this instrument's header says
 * so out loud), but a MERGE GATE LEG that reports it as `failed` asserts "the composition
 * regressed" on evidence that only supports "this checkout was never built" — measured: 3 of
 * this file's 20 legs go red in a worktree that has `pnpm install` and no build, which is
 * what every clean checkout and every §7.6 clean-worktree receipt is.
 *
 * So a FAIL line naming a missing plugin entry is now asked WHERE it came from, via
 * `scripts/a4-artifact-provenance.mjs`, and only a positive finding of "no build output for
 * this target has ever existed in this tree" downgrades it to `refused`. A partial output
 * root, a tracked artifact, an artifact inside a shipped surface, or a provenance git could
 * not answer all stay `failed`. And `refused` is not a way to be green: every leg below
 * asserts `verdict === 'passed'`, so a refusal blocks the merge exactly as a failure does —
 * the vocabulary change buys the READER a cause, not the run a pass.
 */
function classifyCompositionSmoke(
  run: { stdout: string; stderr?: string; code: number | null },
  measureArtifacts?: () => { label: string; rel: string; prov: ReturnType<typeof artifactProvenance> }[],
): {
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
  // Every FAIL line that names a plugin entry the tree says was never built becomes a
  // REFUSAL CAUSE rather than a failure. Anything that is not fully explained that way stays
  // a failure, and a run with one explained and one unexplained FAIL is a failure that also
  // mentions the refusal — both truths, no laundering in either direction.
  const refusals: string[] = []
  const unexplained: string[] = []
  for (const line of failed) {
    const art = measureArtifacts?.().find((a) => line.startsWith(`FAIL ${a.label}:`) && /built entry is missing/.test(line))
    if (art === undefined) {
      unexplained.push(line)
      continue
    }
    const verdict = absentArtifactVerdict({ ...art.prov, treeShape: treeShape({ repoRoot: REPO_ROOT }) })
    if (verdict.verdict === 'refused') refusals.push(verdict.why)
    else unexplained.push(`${line} — and the tree agrees: ${verdict.why}`)
  }
  if (unexplained.length > 0) {
    return {
      verdict: 'failed',
      why: `FAIL lines: ${unexplained.join(' | ')}${refusals.length > 0 ? ` | a missing artifact with no trace in its declared output root also contributed: ${refusals.join(' | ')}` : ''}`,
      steps,
      skipped,
      failed,
      footer,
    }
  }
  if (skipped.length > 0) {
    return {
      verdict: 'refused',
      why:
        `steps NOT RUN: ${skipped.join(' | ')} — the footer reads "${footer ?? '(no footer line)'}" and the exit code was ` +
        `${String(run.code)}; neither is what this gate reads, because the step is the unit that did not run` +
        (refusals.length > 0 ? ` | and one of the steps could not have run in any case: ${refusals.join(' | ')}` : ''),
      steps,
      skipped,
      failed,
      footer,
    }
  }
  if (refusals.length > 0) {
    return {
      verdict: 'refused',
      why: refusals.join(' | '),
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

/**
 * The lint leg's classifier, at module level so its arms are testable against captured output
 * the way the composition classifier is (`treats a step that did not run as a failure that says
 * why, even at exit 0`). An arm that only the live tree can reach is an arm nobody has run:
 * the two refusal arms below are reachable only when the instrument is broken, and the last
 * round's review found exactly that class of code — a tolerance nobody had seen fire.
 *
 * Both streams are READ; only one is trusted. See the precedence rule inside.
 */
function classifyLintRun({ stdout, stderr, code }: {
  stdout: string
  stderr: string
  code: number | null
}): { verdict: Verdict; why: string } {
  // F4, the precedence rule. The verdict line and the two machine lines it depends on
  // (`identity lines`, `universe:`) are read from STDOUT, and from stdout alone; stderr is read
  // for the reason text and for nothing else. The previous version classified over
  // `stdout + stderr`. That is safe against a real red being drowned — stdout is scanned first,
  // and a verdict printed there still wins — but it admits a shape nobody asked for: an empty or
  // crashed stdout with a healthy trio printed on stderr reads `passed`. That shape is
  // unreachable today only because `scripts/lint-identities.mjs` happens to write its machine
  // lines to stdout and its NOT-RUN line to stderr, which is one script's habit rather than a
  // property of the protocol. The widening was needed for the WHY (the eslint stderr naming a
  // vanished file is the entire point of last round's fix), not for the verdict, so the two are
  // split: stdout decides, stderr explains. A verdict this leg cannot see on stdout is a
  // verdict this leg does not have.
  const said = stderr.trim() === ''
    ? `empty (${String(stderr.length)} bytes)`
    : `${String(stderr.length)} bytes: ${tail(stderr)}`
  const universe = /^lint-identities: universe: (.*)$/m.exec(stdout)?.[1] ?? null
  const m = /new (\d+), resolved (\d+)/.exec(stdout)
  if (m === null) {
    return {
      verdict: 'refused',
      why:
        `the identity diff produced no "new N, resolved N" verdict ON STDOUT (exit ${String(code)}), so nothing was compared. ` +
        `stdout (${String(stdout.length)} bytes): ${tail(stdout)}\n    stderr: ${said}`,
    }
  }
  if (!/identity lines/.test(stdout)) {
    return { verdict: 'refused', why: 'the lint normaliser reported no identity lines — an empty scan is not a clean one' }
  }
  if (universe === null) {
    return {
      verdict: 'refused',
      why:
        'the lint normaliser reported a verdict without reporting the universe it computed it over. The identity set is a function of ' +
        'the files ESLint read, and ESLint does not read .gitignore — without the `universe:` line this leg cannot tell a clean tree from ' +
        'a tree carrying someone else\'s scratch file, which is the difference between a red that means something and a red that wastes a round.',
    }
  }
  if (/universe provenance INCOMPLETE/.test(universe)) {
    // The count is stated but the ignored/untracked breakdown is not, because git would not
    // answer. A question git refused to answer never buys a belief — here or in
    // `scripts/a4-artifact-provenance.mjs`.
    return { verdict: 'refused', why: `the lint universe could not be established: ${universe}` }
  }
  const filesLinted = /^(\d+) file\(s\) linted/.exec(universe)?.[1] ?? null
  if (filesLinted === '0') {
    // The reason the universe is parsed rather than only echoed: `new 0, resolved 0` is what a
    // scan that read NO files reports against any baseline. Without this arm, "the target
    // matched nothing" and "the tree is clean" are the same line.
    return { verdict: 'refused', why: `the lint scan read no files at all, so its "new 0" compares nothing: ${universe}` }
  }
  const last = stdout.trim().split('\n').slice(-1)[0] as string
  const tail3 = stdout.trim().split('\n').slice(-3).join(' | ')
  const saidIfAny = stderr.trim() === '' ? '' : ` | stderr: ${said}`
  return Number(m[1] as string) === 0
    ? { verdict: 'passed', why: `universe: ${universe} :: ${last}` }
    : { verdict: 'failed', why: `new lint identities against the accepted baseline (universe: ${universe}): ${tail3}${saidIfAny}` }
}

/**
 * F6's candidate filter: the extensions this repository's flat config declares rules for. A
 * tracked file with any other extension is not lintable at all, which is a different fact from
 * "lintable but refused" and is not this leg's claim.
 */
const LINT_LINTABLE_EXT = /\.(?:mjs|cjs|js|jsx|ts|tsx|mts|cts)$/

// Invisibility this repository has RATIFIED, derived rather than hand-copied: the two committed
// install surfaces from `client-composition-surface.mjs` — what the `dist` and `composition-shim`
// ignore patterns exist for — plus the three documentation/evidence trees the config names in its
// own `ignores` list (`dev/`, `docs/`, `tests/`). A tracked file hidden anywhere else is a file no
// lint rule will ever read, which is what the leg is for.
//
// Written as line comments on purpose: the block-comment version of this paragraph contained the
// glob `**/dist/**`, whose `*/` closed the comment mid-sentence and left the rest of the sentence
// to be parsed as code — two `no-unused-expressions` errors from a doc comment. Globs and
// block comments do not mix; `eslint.config.mjs` keeps its patterns in line comments for the
// same reason.
const RATIFIED_INVISIBLE_PREFIXES: readonly string[] = [...INSTALL_SURFACES.map((s) => `${s}/`), 'dev/', 'docs/', 'tests/']

/**
 * ESLint's own bin rather than `npx`, and that is a measurement
 * (`review-round-eslint-argv-invocation.txt`): `npx eslint <the 2418 tracked lintable paths>` and
 * `npx eslint <2417 filtered>` both exit **249 in ~0.24 s having written 0 bytes** — npm never
 * starts eslint at an argv of that size, and the only thing it emits is an unrelated config
 * warning. The same list through the bin is exit 1 in 9.3 s with 3 754 774 bytes of JSON.
 *
 * The candidate list is additionally FILTERED TO EXISTING PATHS, and that half is load-bearing for
 * a reason worth knowing: one path that `git ls-files` lists but that is not a file on disk
 * (measured here: a tracked mode-120000 symlink whose absolute target lives in a gitignored sibling
 * worktree, so it dangles in this checkout while `git status` stays clean) makes the bin refuse the
 * WHOLE batch — exit 2, empty stdout, `No files matching the pattern "…upstream-resolver.mjs" were
 * found`. A leg that answers `refused` because of another lane's dead symlink is measuring the
 * wrong thing, so the leg filters and then prints what it filtered: a census is not allowed to make
 * its denominator smaller in silence.
 */
const ESLINT_BIN = join(REPO_ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js')

type EslintFileReport = { filePath?: unknown; messages?: unknown }

/** Every tracked file ESLint could lint, as relative paths, plus the ones it could not. */
function lintVisibilityCandidates(): { candidates: string[]; skipped: string[] } {
  const spawned = spawnSync('git', ['ls-files'], { cwd: REPO_ROOT, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (spawned.status !== 0) {
    throw new Error(`the lint-visibility census cannot enumerate the tracked tree: git ls-files exited ${String(spawned.status)}`)
  }
  const candidates: string[] = []
  const skipped: string[] = []
  for (const rel of spawned.stdout.split('\n').filter((l) => l.length > 0)) {
    if (!LINT_LINTABLE_EXT.test(rel)) continue
    // A tracked path that is not a file on disk is not a candidate, and it is disclosed rather
    // than dropped. Measured at `bfbd89a5`: one tracked SYMLINK under
    // `dev/agent-workflow/evidence/alpha2-capability-completion/a2c-1/` points at an ABSOLUTE
    // path inside a gitignored sibling worktree, so it dangles in every checkout but the one
    // that wrote it, `git status` still reports the tree clean (a symlink blob matches), and
    // handing the path to ESLint makes it exit 2 with `No files matching the pattern` — the
    // `NOT RUN` symptom the lint leg took last round from a vanishing directory, arriving again
    // from a completely different cause. Any census that trusts `git ls-files` as a file list
    // inherits it.
    if (!existsSync(join(REPO_ROOT, rel))) {
      skipped.push(rel)
      continue
    }
    candidates.push(rel)
  }
  return { candidates, skipped }
}

function classifyLintVisibility(
  run: { stdout: string; stderr: string; code: number | null },
  census: { candidates: string[]; skipped: string[] },
  ratified: readonly string[],
): { verdict: Verdict; why: string } {
  const skippedNote = census.skipped.length === 0
    ? ''
    : ` — ${String(census.skipped.length)} tracked lintable path(s) are not a file on disk and were skipped: ${census.skipped.join(', ')}`
  let reports: unknown
  try {
    reports = JSON.parse(run.stdout)
  } catch {
    return {
      verdict: 'refused',
      why:
        `eslint produced no JSON for the lint-visibility census (exit ${String(run.code)}), so nothing was counted${skippedNote}. ` +
        `stderr: ${tail(run.stderr)}`,
    }
  }
  if (!Array.isArray(reports)) {
    return { verdict: 'refused', why: `the lint-visibility census did not return a report array (exit ${String(run.code)})${skippedNote}` }
  }
  if (reports.length !== census.candidates.length) {
    // Every candidate gets exactly one report, ignored or not. A shortfall means eslint stopped
    // seeing part of the list mid-run — last round's vanishing-tree class — and a census with an
    // unexplained gap does not get to report a clean zero.
    return {
      verdict: 'refused',
      why:
        `eslint answered ${String(reports.length)} of ${String(census.candidates.length)} tracked lintable candidates, so the census is ` +
        `missing ${String(census.candidates.length - reports.length)} file(s)${skippedNote}. stderr: ${tail(run.stderr)}`,
    }
  }
  const hidden: string[] = []
  for (const entry of reports as EslintFileReport[]) {
    const messages = Array.isArray(entry.messages) ? (entry.messages as { ruleId?: unknown; message?: unknown }[]) : []
    // `ruleId` is NULL on these, not absent, and the message is longer than the folklore version of
    // it. Captured line (`review-round-eslint-instrument-shape.txt`):
    //   ruleId: null, fatal: false, severity: 1, nodeType: null,
    //   message: File ignored because of a matching ignore pattern. Use "--no-ignore" to disable
    //            file ignore settings or use "--no-warn-ignored" to suppress this warning.
    // `entry.ignored` is undefined on these entries, so the message text is the only marker.
    // A first version tested `ruleId === undefined`, matched nothing, and the leg reported "0
    // hidden" over 2417 tracked files while 1313 of them were in fact unread. The synthetic pin
    // below did not catch it, because that pin had been written from memory rather than copied from
    // a transcript — so it carried `ruleId` absent and validated a blind detector. A test that
    // invents its instrument's shape is worse than no test: it converts a detector nobody believes
    // into a detector everybody believes. Both halves now carry the captured object.
    const ignored = messages.some(
      (m) => (m.ruleId === undefined || m.ruleId === null)
        && typeof m.message === 'string'
        && /File ignored because of a matching ignore pattern/.test(m.message),
    )
    if (!ignored) continue
    const abs = typeof entry.filePath === 'string' ? entry.filePath : ''
    hidden.push(relative(REPO_ROOT, abs).split('\\').join('/'))
  }
  const counts = new Map<string, number>()
  const unexpected: string[] = []
  for (const p of hidden) {
    const hit = ratified.find((prefix) => p.startsWith(prefix))
    if (hit === undefined) {
      unexpected.push(p)
      continue
    }
    counts.set(hit, (counts.get(hit) ?? 0) + 1)
  }
  const stated = [...counts.entries()].map(([prefix, n]) => `${prefix} ${String(n)}`).join(', ')
  // The line has to be checkable off itself, and it has to name which population each number is
  // from. The first version printed "eslint read 1105 of 2418 tracked lintable file(s)" at
  // `992b416b` — where 2419 lintable paths were tracked — and "…of 2421…" at `d6e786c7`, where
  // 2422 were: in both cases the second number is what was OFFERED to eslint (tracked ∩ on disk),
  // and the gap was reconcilable only by reading the skipped note at the end of the line. Calling
  // that number "tracked" is the F3 failure — a reason string that misstates what it counted — so
  // `offered`, `tracked` and `skipped` are now three words for three sets, with the sum spelled out
  // so a reader can check it without re-running anything.
  const offered = reports.length
  const skipped = census.skipped.length
  const tracked = census.candidates.length + skipped
  const censusLine =
    `eslint read ${String(offered - hidden.length)} of ${String(offered)} OFFERED tracked lintable file(s); ` +
    `${String(hidden.length)} are hidden by an ignore pattern${stated === '' ? '' : ` (${stated})`}; ` +
    `${String(offered - hidden.length)} + ${String(hidden.length)} = ${String(offered)} offered, ` +
    `+ ${String(skipped)} skipped = ${String(tracked)} tracked lintable path(s)` +
    (skipped === 0 ? '; nothing skipped' : `; skipped: ${census.skipped.join(', ')}`)
  if (unexpected.length > 0) {
    return {
      verdict: 'failed',
      why:
        `${String(unexpected.length)} tracked file(s) are invisible to lint and outside every ratified prefix — ${unexpected.slice(0, 10).join(', ')}` +
        `${unexpected.length > 10 ? `, +${String(unexpected.length - 10)} more` : ''}. An entry in eslint.config.mjs's \`ignores\` swallows ` +
        `product source; those files cannot produce a lint identity, so the baseline and the universe line both understate the tree. ` +
        `Full census: ${censusLine}`,
    }
  }
  return { verdict: 'passed', why: censusLine }
}

/**
 * The verdict channel both artifact instruments emit — one line, `key=value` pairs, always
 * on stdout. See the headers of `scripts/check-artifacts-committed.mjs` and
 * `scripts/check-artifacts-at-head.mjs`. A consumer selects by `script=`, because the commit
 * instrument relays the other one's token through its own stdout: grepping for the first
 * `verdict=` would grade the inner run against the wrong subject, which is the very
 * confusion `check-artifacts-at-head.mjs` exists to remove.
 */
function verdictToken(text: string, script: string): Record<string, string> | null {
  const line = new RegExp(`DSH-ARTIFACT-VERDICT[^\\n]*script=${script}[^\\n]*`).exec(text)
  if (line === null) return null
  const fields: Record<string, string> = {}
  for (const m of line[0].matchAll(/\b([a-z][a-z-]*)=(\S+)/g)) fields[m[1] as string] = m[2] as string
  return fields
}

function classifyArtifactsRun({ stdout, stderr, code }: {
  stdout: string
  stderr: string
  code: number | null
}): { verdict: Verdict; why: string } {
  // VERDICT CHANNEL, NOT PROSE. Until a4-pr7/7.8 this arm asserted on `/OK: (\\d+) files/` —
  // a substring of a sentence the script writes about itself, which made the test's truth a
  // function of the script's phrasing. The same sentence was also false in a way no rewording
  // can fix by itself: it claimed the artifacts "match the fresh build", a claim about a build
  // `check-artifacts-committed.mjs` never runs (it compares the working tree to the INDEX, so
  // a tree nobody built in prints success — measured at `f0485b15` over 20 stale files, with
  // this gate 26/26 green). The script now says what it compares and both instruments state a
  // token; this arm reads the token and treats prose as unparseable noise.
  //
  // The directional rule F4 established is unchanged and still measured: **a green may only
  // come from stdout; a red may come from either stream** — the drift list legitimately goes
  // to stderr, and an `OK` arriving on stderr is a sentence, not a verdict.
  const token = verdictToken(stdout, 'check-artifacts-committed')
  const out = `${stdout}${stderr}`
  if (token?.verdict === 'ok') {
    return Number(token.compared ?? '0') > 0
      ? { verdict: 'passed' as Verdict, why: `verdict=ok subject=${token.subject ?? '?'} compared=${token.compared ?? '0'} glue=${token.glue ?? '0'}` }
      : { verdict: 'refused' as Verdict, why: 'verdict=ok with compared=0 — an empty compared set is not a pass, it is the old false green' }
  }
  if (token?.verdict === 'stale') {
    return { verdict: 'failed' as Verdict, why: `verdict=stale drift=${token.drift ?? '?'} — the tree owes its rebuild: ${tail(out)}` }
  }
  if (token?.verdict === 'refused') {
    if (token.reason === 'surface-missing') {
      // What this arm still cannot say, and the token cannot either: the script's ROOT is
      // `process.cwd()`, so a run from a SUBDIRECTORY reports a missing surface when the
      // actual cause is where it was standing (measured from `packages/testkit`). Refused
      // either way — nothing was compared. Misdiagnosis filed in FINDINGS §5.
      return { verdict: 'refused' as Verdict, why: `verdict=refused reason=surface-missing (exit ${code}) — no install surface where this run was standing; either never built, or not run at the toplevel` }
    }
    return { verdict: 'refused' as Verdict, why: `verdict=refused reason=${token.reason ?? 'unstated'} (exit ${code}) — nothing was compared: ${tail(out)}` }
  }
  return { verdict: 'refused' as Verdict, why: `check:artifacts emitted no DSH-ARTIFACT-VERDICT line on stdout (exit ${code}) — prose is not a verdict, whatever it says; tail: ${tail(out)}` }
}

/**
 * The commit-level sibling of `classifyArtifactsRun` — two classifiers for one subject,
 * because the subject has two different questions and the tree can only answer one of them.
 *
 * `check:artifacts` compares the WORKING TREE to the git INDEX. That answers "you just
 * built — did you `git add` the build?" and it is structurally blind to the merge question:
 * a checkout whose `dist` was never rebuilt has working == index, so it prints
 * `OK: 1508 files; committed install-surface artifacts match the fresh build` over a surface
 * no build produced. Measured at `f0485b15`: that sentence, exit 0, with 20 tracked files one
 * to two merged commits behind the source that emits them — the shipped `schema.js` still
 * advertising `[1, 2, 3]` after the tree narrowed it to `[3]`, and five shipped modules still
 * gating the §E.2 requirements grammar on `blueprint.schemaVersion === 2`, a version that
 * build no longer admits. This file passed 26/26 on that tree, its install-surface leg
 * reporting exactly that `OK` line.
 *
 * `check-artifacts-at-head.mjs` asks the other question — does THIS COMMIT carry its own
 * build — by materialising the commit in a scratch worktree, building it there, and running
 * the reviewed instrument inside it. Working tree and index are then the same commit, so the
 * only way to print OK is for the commit to contain its own output. No comparison semantics
 * are re-implemented here or there. Evidence:
 * `dev/agent-workflow/evidence/a4-pr7/7-8-dist-rebase/STALENESS.md`.
 */
function classifyAtHeadRun({ stdout, stderr, code }: {
  stdout: string
  stderr: string
  code: number | null
}): { verdict: Verdict; why: string } {
  // Its own token, selected by `script=`. The relayed inner token is in this stdout too, so
  // an unqualified grep would grade the scratch's working-tree-vs-index comparison and call
  // it a verdict about the commit — the conflation this instrument exists to separate.
  const token = verdictToken(stdout, 'check-artifacts-at-head')
  const out = `${stdout}${stderr}`
  if (token?.verdict === 'ok') {
    return Number(token.compared ?? '0') > 0
      ? { verdict: 'passed' as Verdict, why: `verdict=ok subject=${token.subject ?? '?'} rev=${token.rev ?? '?'} compared=${token.compared ?? '0'}` }
      : { verdict: 'refused' as Verdict, why: 'verdict=ok with compared=0 — the scratch compared nothing' }
  }
  if (token?.verdict === 'stale') {
    return { verdict: 'failed' as Verdict, why: `verdict=stale rev=${token.rev ?? '?'} drift=${token.drift ?? '?'} — the commit does not carry its own build; the rebuild it owes: ${tail(out)}` }
  }
  if (token?.verdict === 'refused') {
    return { verdict: 'refused' as Verdict, why: `verdict=refused reason=${token.reason ?? 'unstated'} (exit ${code}) — the instrument ran and declined to compare: ${tail(out)}` }
  }
  if (token?.verdict === 'not-run') {
    return { verdict: 'refused' as Verdict, why: `verdict=not-run reason=${token.reason ?? 'unstated'} (exit ${code}) — a leg that never ran has no opinion about freshness and is never a pass: ${tail(out)}` }
  }
  return { verdict: 'refused' as Verdict, why: `check:artifacts:head emitted no DSH-ARTIFACT-VERDICT line on stdout (exit ${code}); prose is not a verdict; tail: ${tail(out)}` }
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
        classify: (x) => classifyCompositionSmoke(x, compositionArtifacts),
      })

    it('is green, asserted by arm name and by absence of a skip — never by the exit code', { timeout: 330000 }, async () => {
      // F1, the review round. This leg admits exactly one word, `passed`, and it does not ask
      // the tree what it would accept instead. The previous version derived an expectation from
      // the artifact inventory and asserted THAT, which in a never-built checkout turned the
      // composition leg green-by-refusal: the arm never loaded, the gate reported the miss
      // honestly as `refused`, and the merge gate printed `23 passed (23)` with nothing on
      // stdout or stderr saying the arm had not run — measured `3 failed / 17 passed (20)` on
      // base `69f7fdad` for the same tree, so the green was the change, not the tree. A gate
      // that can be green because it never ran is not a milder bug than a gate that passes a
      // bad build; it is exactly as invisible, and the reviewer's line is the one to keep:
      // "Category: sound and tested. Honesty of the green: not yet."
      //
      // Where the tree-shape story lives instead: the synthetic leg
      // (`asks where a missing artifact came from…`) and the two mutation legs
      // (`reads a never-built checkout as refused…`, `reads a partial build output as failed…`)
      // own the `refused` / `failed` distinction and pin it against real runs and real trees.
      // This leg's job is to refuse the merge, and to say why in terms the reader can act on.
      const r = await run()
      const arts = compositionArtifacts()
      const parsed = classifyCompositionSmoke({ stdout: r.stdout, code: r.code }, () => arts)
      const absent = arts.filter((a) => !a.prov.exists)
      if (absent.length > 0) {
        // Say it out of the leg's own mouth, because this leg is RED in that tree on purpose
        // and a transcript reader must be able to see the difference between "the build
        // regressed" and "this checkout was never built" without opening this file.
        process.stderr.write(
          `composition-smoke leg: RED BY DESIGN — ${absent.map((a) => a.rel).join(', ')} ${absent.length === 1 ? 'is' : 'are'} not on ` +
            `disk, so the ${absent.map((a) => a.label).join(', ')} ${absent.length === 1 ? 'arm did' : 'arms did'} not run. ` +
            `Tree: ${treeShape({ repoRoot: REPO_ROOT })}. Run \`pnpm build\` and re-run this gate.\n`,
        )
      }
      expect(
        r.verdict,
        `the composition arms have to RUN for this gate to be green; a refusal that explains itself is still a red here. ` +
          `It read "${r.verdict}". why: ${r.why}\n    output tail:\n    ${tail(`${r.stdout}\n${r.stderr}`)}`,
      ).toBe('passed')

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
      // And the mirror-image mistake: with no tree consulted, a missing built artifact is a
      // FAILURE, not a skip — the classifier defaults to the strict answer and does not get
      // to invent a provenance it was not given.
      const missingArtifact = classifyCompositionSmoke({
        stdout: 'FAIL client plugin (packages/client): built entry is missing — run `pnpm build` first (a missing artifact is a failure, never a skip)\n',
        code: 1,
      })
      expect(missingArtifact.verdict).toBe('failed')
    })

    it('asks where a missing artifact came from before calling it a regression, on synthetic trees', () => {
      // The refused/failed boundary, driven by invented trees rather than by whatever this
      // worktree happens to contain — otherwise the branch is only ever exercised in one
      // direction, which is how the leg above came to assert `failed` unexamined.
      const MISSING_LINE = 'FAIL client plugin (packages/client): built entry is missing — run `pnpm build` first (a missing artifact is a failure, never a skip)\n'
      const ENTRY = 'packages/client/dist/packages/client/src/plugin/client.js'
      const prov = (over: Partial<ArtifactProvenance>): ArtifactProvenance => ({
        label: 'client plugin (packages/client)',
        rel: ENTRY,
        exists: false,
        tracked: false,
        gitignored: true,
        inInstallSurface: false,
        outputRoot: 'packages/client/dist',
        outputRootExists: false,
        outputFileCount: 0,
        manifestEntry: null,
        unreadable: [],
        treeShape: 'HEAD abc1234, 0 tracked file(s) changed vs HEAD, 0 untracked entr(ies) [counted from git-status entries: an untracked directory counts as one]',
        ...over,
      })
      const withProv = (over: Record<string, unknown>) =>
        classifyCompositionSmoke({ stdout: MISSING_LINE, code: 1 }, () => [{ label: 'client plugin (packages/client)', rel: ENTRY, prov: prov(over) }])

      // Never built: no output root at all.
      const neverBuilt = withProv({})
      expect(neverBuilt.verdict).toBe('refused')
      expect(neverBuilt.why).toContain(ENTRY)
      expect(neverBuilt.why).toContain('pnpm build')
      expect(neverBuilt.why).toContain('byte-identical') // the ambiguity is in the text, not in a footnote
      // Built, then wrong: the root is there with 399 siblings and the entry is not.
      expect(withProv({ outputRootExists: true, outputFileCount: 399 }).verdict).toBe('failed')
      // An artifact that ships: its absence is a defect whatever the checkout looks like.
      expect(withProv({ tracked: true, gitignored: false }).verdict).toBe('failed')
      expect(withProv({ inInstallSurface: true }).verdict).toBe('failed')
      // Provenance unknown is NOT provenance innocent.
      expect(withProv({ unreadable: ['git could not classify x:boom'] }).verdict).toBe('failed')
      // Empty-but-present output root is still "nothing was ever emitted".
      expect(withProv({ outputRootExists: true, outputFileCount: 0 }).verdict).toBe('refused')
      // And a second, unexplained FAIL is never swallowed by an explained one.
      const mixed = classifyCompositionSmoke(
        { stdout: `${MISSING_LINE}FAIL client bundle plugin-row-exports: the row lost its apply export\n`, code: 1 },
        () => [{ label: 'client plugin (packages/client)', rel: ENTRY, prov: prov({}) }],
      )
      expect(mixed.verdict).toBe('failed')
      expect(mixed.why).toContain('plugin-row-exports')
      expect(mixed.why).toContain('no trace in its declared output root')
      // F2, and the phrase is load-bearing rather than stylistic: the classifier may say what it
      // measured, which is the declared output root, and never that the tree "never produced"
      // something — an output built and then MOVED is indistinguishable from here.
      expect(mixed.why).toContain('nothing outside the declared output root is examined')
    })

    it('refuses the wrong question: the absent-artifact helper, called over a PRESENT artifact', () => {
      // §17's finding, closed. The precondition "the artifact is absent" used to be prose in a doc
      // comment, and prose is not a rule. Measured at `d6e786c7`, this helper was called twice
      // inside an hour on a healthy tree and answered `failed` with
      //   "…packages/client/dist/packages/client/src/plugin/client.js is missing while
      //    packages/client/dist carries 400 other file(s): a build ran in this tree…"
      // about a tree in which nothing was missing (`review-round-verdicts-at-d6e786c7.txt` keeps
      // the out-of-contract call in its header). Every sentence that function can write is about an
      // absence and it never reads file contents, so over a present file the only honest answer is
      // a refusal that names the question. A helper that is correct only while callers remember a
      // rule has no test for the rule — this leg is that test.
      const ENTRY = 'packages/client/dist/packages/client/src/plugin/client.js'
      const presentProv: ArtifactProvenance = {
        label: 'client plugin (packages/client)',
        rel: ENTRY,
        exists: true,
        tracked: false,
        gitignored: true,
        inInstallSurface: false,
        outputRoot: 'packages/client/dist',
        outputRootExists: true,
        outputFileCount: 400,
        manifestEntry: null,
        unreadable: [],
        treeShape: 'HEAD d6e786c7, 0 tracked file(s) changed vs HEAD, 0 untracked entr(ies) [counted from git-status entries: an untracked directory counts as one]',
      }
      const present = absentArtifactVerdict(presentProv)
      expect(present.verdict, `a present artifact is not a verdict this helper may write: ${present.why}`).toBe('refused')
      // The lie, pinned out of existence: the healthy-tree call used to assert absence, in words,
      // and a reader who acted on it would have run a build over a tree that had already built.
      expect(present.why).not.toContain('is missing')
      expect(present.why).toContain('IS on disk')
      expect(present.why).toContain('the wrong question')
      expect(present.why).toContain('refused is not passed')
      // Presence has to outrank the branches that used to be earlier in the function, or the guard
      // is decoration: a tracked artifact and an unreadable one are still present artifacts, and
      // the answer is still "wrong question", not the absence verdict they would otherwise write.
      for (const over of [{ tracked: true, gitignored: false }, { inInstallSurface: true }, { unreadable: ['git could not classify x:boom'] }] as Partial<ArtifactProvenance>[]) {
        const v = absentArtifactVerdict({ ...presentProv, ...over })
        expect(v.verdict, `presence outranks every absence branch, including the ones that used to be first: ${v.why}`).toBe('refused')
        expect(v.why).not.toContain('is missing')
      }
      // The live half, in whichever tree this run is in — asserted both ways so there is no tree
      // shape in which this leg asserts nothing, and no branch that vacuously passes.
      const gated = gatedEntry()
      const live = classifyAbsentArtifact({ repoRoot: REPO_ROOT, rel: gated.rel, label: gated.label })
      if (live.prov.exists) {
        expect(live.verdict, `the real tree has ${gated.rel} on disk, so this call is the misuse itself: ${live.why}`).toBe('refused')
        expect(live.why).toContain('IS on disk')
        expect(live.why).not.toContain('is missing')
      } else {
        // And the guard must not swallow a genuine refusal: with the entry really absent, the
        // answer comes from the absence branches and must not claim presence.
        expect(live.why).not.toContain('IS on disk')
        expect(['refused', 'failed'], `an absent artifact still gets an absence verdict, not a wrong-question refusal: ${live.why}`).toContain(live.verdict)
      }
    })

    /**
     * The closure-gated arm's entry and the build-output root that would contain it, both
     * read off the gate's own target list — no path in these two legs is written by hand, so
     * an arm added or moved in `composition-smoke-targets.mjs` moves the mutations with it.
     */
    function gatedEntry(): { label: string; rel: string; outputRoot: string } {
      const target = compositionTargets().find((t) => t.closureGate === true)
      if (target === undefined) {
        throw new Error('the plugin target list carries no closure-gated arm, so there is no built entry this leg could mutate')
      }
      const prov = artifactProvenance({ repoRoot: REPO_ROOT, rel: target.rel, label: target.label })
      if (prov.outputRoot === null) {
        throw new Error(`${target.rel} is not inside a build-output root this module can identify, so "held away" cannot be constructed for it`)
      }
      return { label: target.label, rel: target.rel, outputRoot: prov.outputRoot }
    }

    it('reads a never-built checkout as refused, by name, and still refuses to call it green', { timeout: 330000 }, async () => {
      // This is the case a fresh worktree is in: `pnpm install` and no build. Before this
      // round the leg said `failed` — which put the reader on the trail of a composition
      // regression that does not exist — and one leg of this file additionally demanded that
      // the artifact exist before it would run at all, which is the same defect wearing a
      // precondition.
      const { label, rel, outputRoot } = gatedEntry()
      const held = `${join(REPO_ROOT, outputRoot)}.held-by-7-6-gate`
      const hadRoot = existsSync(join(REPO_ROOT, outputRoot))
      if (hadRoot) spawnSync('mv', [join(REPO_ROOT, outputRoot), held], { cwd: REPO_ROOT })
      try {
        expect(artifactProvenance({ repoRoot: REPO_ROOT, rel }).outputRoot, `holding ${outputRoot} away must leave the tree in the never-built shape this leg claims to test`).not.toBeNull()
        const r = await runLeg(process.execPath, ['scripts/composition-smoke.mjs'], {
          cwd: REPO_ROOT,
          timeoutMs: 300_000,
          label: 'composition-smoke with no build output for the gated arm',
          classify: (x) => classifyCompositionSmoke(x, compositionArtifacts),
        })
        // The instrument's own words are checked before this file's opinion of them: the gate
        // must still print its strict FAIL line. The classifier's job is to name the cause,
        // not to quiet the report.
        expect(r.stdout, `the gate must still print its missing-artifact line for ${label}`).toMatch(/^FAIL client plugin \(packages\/client\): built entry is missing/m)
        expect(r.stdout).not.toMatch(/^SKIP client plugin/m)
        expect(r.verdict, `a checkout with no build output must read as refused, and refused must never be allowed to read as passed: ${r.why}`).toBe('refused')
        expect(r.why).toContain(rel)
        expect(r.why).toContain('pnpm build')
        expect(r.why).toContain('HEAD ')
        expect(r.stdout).not.toContain('PASS composition-smoke')
      } finally {
        if (hadRoot) spawnSync('mv', [held, join(REPO_ROOT, outputRoot)], { cwd: REPO_ROOT })
      }
      expect(existsSync(join(REPO_ROOT, outputRoot)), `${outputRoot} was not restored — the worktree is left in a shape no later leg was measured in`).toBe(hadRoot)
    })

    it('reads a partial build output as failed, not refused: a build ran and produced the wrong surface', { timeout: 330000 }, async () => {
      // THE case `refused` must not swallow. The output root exists with its siblings and the
      // declared entry is not among them: that is a build that ran and got it wrong, and any
      // predicate that calls this refused has traded a false red for a false green.
      const { rel, outputRoot } = gatedEntry()
      const entryAbs = join(REPO_ROOT, rel)
      const rootAbs = join(REPO_ROOT, outputRoot)
      const heldEntry = `${entryAbs}.held-by-7-6-gate`
      // Three trees can hand this leg their door, and only two of them need it knocked: a
      // healthy checkout (move the entry away and keep the siblings), a never-built one
      // (create the shape, then remove every trace of it), and one already in the shape under
      // test — the tree the clean-worktree report arrived in, where the entry had been removed
      // and its siblings left. Mutating that third one and then "restoring" it would have this
      // file wreck a worktree and claim to have repaired it, so it is measured, not moved.
      const entryWasThere = existsSync(entryAbs)
      const rootWasThere = existsSync(rootAbs)
      let createdRoot = false
      if (entryWasThere) {
        expect(spawnSync('mv', [entryAbs, heldEntry], { cwd: REPO_ROOT }).status, `holding ${rel} aside must succeed or this leg tests the wrong tree`).toBe(0)
      } else if (!rootWasThere) {
        // Unbuilt tree: the same SHAPE has to be reachable here, or this leg only ever tests
        // a built checkout. One file that is not the entry, in the output root, is that shape.
        // It is removed in `finally` below and asserted gone — this leg creates no residue.
        mkdirSync(rootAbs, { recursive: true })
        createdRoot = true
        writeFileSync(join(rootAbs, 'gate-7-6-synthetic-sibling.txt'), 'placeholder: proves the output root exists while the entry does not\n')
      }
      try {
        const shape = artifactProvenance({ repoRoot: REPO_ROOT, rel })
        expect(shape.exists, 'the entry must be absent for this leg to mean anything').toBe(false)
        expect(shape.outputFileCount, `the output root must still carry siblings, or this leg has rebuilt the never-built shape it is meant to distinguish`).toBeGreaterThan(0)
        const r = await runLeg(process.execPath, ['scripts/composition-smoke.mjs'], {
          cwd: REPO_ROOT,
          timeoutMs: 300_000,
          label: 'composition-smoke with the gated entry removed and its siblings left in place',
          classify: (x) => classifyCompositionSmoke(x, compositionArtifacts),
        })
        expect(r.verdict, `a partial build output must read as failed: ${r.why}`).toBe('failed')
        expect(r.why).toContain('other file(s)')
        expect(r.why).toContain('a build ran in this tree')
        expect(r.stdout).toMatch(/^FAIL client plugin \(packages\/client\): built entry is missing/m)
      } finally {
        if (createdRoot) rmSync(rootAbs, { recursive: true, force: true })
        else if (entryWasThere) spawnSync('mv', [heldEntry, entryAbs], { cwd: REPO_ROOT })
      }
      if (createdRoot) {
        expect(existsSync(rootAbs), `${outputRoot} was created by this leg and not removed — the next run would now read the tree as built`).toBe(false)
      } else if (entryWasThere) {
        expect(existsSync(entryAbs), 'the entry was not restored — the worktree is left with a hole in the build output').toBe(true)
      } else {
        expect(artifactProvenance({ repoRoot: REPO_ROOT, rel }).outputFileCount, `${outputRoot} was found in the shape under test and must be handed back unchanged`).toBeGreaterThan(0)
      }
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
          classify: (x) => classifyCompositionSmoke(x, compositionArtifacts),
        })
        // F1 applies here too, and what it removes is a derivation. Which of the two red words
        // this run earns depends on the tree (with the built entry present the closure walk runs
        // and the answer is `refused`; with a half-built output root the missing entry is a
        // regression and the answer is `failed`), but THAT the answer is not `passed` depends on
        // nothing. So this leg asserts the invariant it actually owns and does not pretend to
        // predict the word: the word is pinned by the two mutation legs, which SET the tree shape
        // themselves rather than inferring it.
        expect(r.verdict, `hiding a package the client closure must traverse cannot leave this leg passed: ${r.why}`).not.toBe('passed')
        // Which of its two excuses the gate gives depends on the tree: with the built entry
        // present it walks the closure and prints SKIP; without it the entry check answers
        // first. Both are "this step did not run", which is the claim this leg owns, so the
        // leg requires the step to be NAMED by one of the two routes and forbids the arm from
        // having passed — it does not require whichever line this checkout happens to warrant.
        const namedTheStep = /^SKIP client plugin \(packages\/client\): host module closure unavailable/m.test(r.stdout) || /built entry is missing/.test(r.stdout)
        expect(namedTheStep, `the run must name the step that could not run; it printed:\n${tail(r.stdout)}`).toBe(true)
        expect(r.stdout).not.toContain('PASS client plugin (packages/client)')
        expect(r.stdout).not.toContain('PASS composition-smoke')
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
    it('classifies a lint run by its verdict line and its universe line, on captured output', () => {
      // Every string below is copied from a real run in this round's evidence (the healthy
      // pair from `battery.txt`, the scratch-tree pair from `tree-D-scratch-residue.txt`, the
      // crash from `lint-exit2-eslint-stderr-verbatim.txt` and
      // `lint-exit2-end-to-end-refusal.txt`), so each arm has actually fired somewhere.
      const healthy = 'lint-identities: 160 identity lines, 76 distinct (target .)\n'
        + 'lint-identities: universe: 1104 file(s) linted, 0 of them gitignored (ESLint does not read .gitignore, so the identity set is a function of these files, not of git status)\n'
        + 'baseline dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt: 76 distinct; new 0, resolved 0\n'
      const run = (stdout: string, stderr = '', code: number | null = 0) => classifyLintRun({ stdout, stderr, code })

      const ok = run(healthy)
      expect(ok.verdict).toBe('passed')
      expect(ok.why, 'a passing lint leg still has to carry the universe it passed over').toContain('universe: 1104 file(s) linted')

      const scratch = 'lint-identities: 162 identity lines, 77 distinct (target .)\n'
        + 'lint-identities: universe: 1105 file(s) linted, 1 of them gitignored (ESLint does not read .gitignore, so the identity set is a function of these files, not of git status): .tmp-resolve-probe.mjs\n'
        + 'baseline …: 76 distinct; new 1, resolved 0\nNEW IDENTITIES (1):\n  error no-undef .tmp-resolve-probe.mjs\n'
      const red = run(scratch, '', 1)
      expect(red.verdict).toBe('failed')
      expect(red.why).toContain('1 of them gitignored')
      expect(red.why, 'the reader must be able to see the red was measured over a scratch tree').toContain('.tmp-resolve-probe.mjs')

      const crashed = 'lint-identities: NOT RUN :: eslint produced no JSON (status 2, signal null, error none)\n'
      const crashErr = '\nOops! Something went wrong! :(\n\nESLint: 9.39.5\n\nError: ENOENT: no such file or directory, '
        + "'/repo/packages/testkit/test/.tmp-fault/repo/scripts/h1.mjs'\n    at readAndVerifyFile (eslint/lib/eslint/eslint-helpers.js:1306:16)\n"
      const refused = run(crashed, crashErr, 2)
      expect(refused.verdict, 'no verdict line means nothing was compared, which is a refusal, not a pass').toBe('refused')
      expect(refused.why, 'the refusal has to carry the captured stderr that names the vanished file').toContain('ENOENT')
      expect(refused.why).toContain('stderr:')
      const silent = run(crashed, '', 2)
      expect(silent.why, '"no output" and "output not captured" are different facts').toContain('empty (0 bytes)')

      // F4's precedence rule, and the exact shape it exists to refuse: the whole healthy trio
      // printed on stderr, nothing on stdout. `scripts/lint-identities.mjs` does not do this —
      // it writes its machine lines to stdout — but "one script's writing habit" is not a
      // protocol, and the previous classifier believed it.
      const stderrOnly = run('', 'lint-identities: 160 identity lines, 76 distinct (target .)\n'
        + 'lint-identities: universe: 1104 file(s) linted, 0 of them gitignored (…)\n'
        + 'baseline …: 76 distinct; new 0, resolved 0\n')
      expect(stderrOnly.verdict, 'a verdict this leg cannot see on stdout is a verdict it does not have, however healthy it looks on stderr').toBe('refused')
      expect(stderrOnly.why).toContain('ON STDOUT')
      expect(stderrOnly.why, 'stderr is still quoted as evidence inside the refusal — bound the trust, do not delete the information').toContain('76 distinct')

      // And the other direction, which is why the split is safe rather than merely stricter: a
      // complete stdout verdict is not unmade by unrelated noise on stderr, so a real red
      // printed on stdout can never be drowned by a loud stderr.
      expect(run(healthy, 'Error: something on stderr that is not a verdict\n', 1).verdict,
        'stdout decides: an unrelated stderr scream does not overturn a complete stdout verdict').toBe('passed')
      expect(run(scratch, 'Error: something on stderr that is not a verdict\n', 1).why,
        'a red carries the stderr tail too, so the reader sees both').toContain('stderr:')

      expect(run('lint-identities: 160 identity lines, 76 distinct (target .)\nbaseline …: 76 distinct; new 0, resolved 0\n').verdict,
        'a verdict with no stated universe is not believed').toBe('refused')
      expect(run('lint-identities: 160 identity lines, 76 distinct (target .)\n'
        + 'lint-identities: universe: 1104 file(s) linted, 0 of them gitignored (…); universe provenance INCOMPLETE: git check-ignore exited 128\n'
        + 'baseline …: 76 distinct; new 0, resolved 0\n').verdict,
      'a universe git could not fully classify is a refusal, not a clean').toBe('refused')
      expect(run('lint-identities: 0 identity lines, 0 distinct (target .)\nlint-identities: universe: 0 file(s) linted, 0 of them gitignored (…)\nbaseline …: 0 distinct; new 0, resolved 0\n').verdict,
        'a scan that read nothing reports new 0 — an empty scan must never read as clean').toBe('refused')
    })

    it('lint closes as an identity diff against the named baseline, not against a count', { timeout: 930000 }, async () => {
      const r = await runLeg(process.execPath, ['scripts/lint-identities.mjs', '--diff', LINT_BASELINE], {
        cwd: REPO_ROOT,
        timeoutMs: 900_000,
        label: 'pnpm lint:identities --diff <baseline>',
        classify: classifyLintRun,
      })
      expect(r.verdict, `lint leg did not close. why: ${r.why}\n    tail:\n    ${tail(`${r.stdout}\n${r.stderr}`)}`).toBe('passed')
    })

    it('names the three states of a captured stderr, including the arm this gate cannot reach', () => {
      // Review's nit, taken seriously: §7.6's `runLeg` always pipes, so the instrument's
      // "not captured" branch was prose no test in the tree could execute — untested text inside
      // a refusal vocabulary, which is the thing this file argues against everywhere else. The
      // arm is not deleted (a caller that inherits stdio genuinely produces it, and the
      // instrument's comment says so) and it is no longer unexecuted.
      expect(describeStderr(undefined)).toContain('not captured')
      expect(describeStderr(null)).toContain('not captured')
      expect(describeStderr(''), '"no output" and "output not captured" are different facts').toBe('empty (0 bytes)')
      const noisy = `${'noise\n'.repeat(20)}Error: ENOENT: no such file or directory, open 'x'\n`
      const said = describeStderr(noisy)
      expect(said).toContain('bytes, tail:')
      expect(said).toContain('ENOENT')
      const tailPart = said.slice(said.indexOf('tail: ') + 'tail: '.length)
      expect(tailPart.split(' | '), 'the tail is the LAST eight lines on one line — a reason that runs twenty lines stops being a reason').toHaveLength(8)
      expect(tailPart).toContain("open 'x'")
    })

    it('no tracked file is invisible to lint except under a prefix this leg names', { timeout: 330_000 }, async () => {
      // F6. The property this phase kept stepping on and never stated, measured rather than
      // eyeballed off the config: hand ESLint every tracked file it could lint and ask which
      // ones it refused to read. Review's specimen was the reason to care — `eslint
      // .tmp-fault/probe/hides.mjs` exits 0 printing "File ignored", so a file `git add -f`'d
      // into an ignored directory is invisible to lint while `git status` stays clean and every
      // count in the gate keeps treating it as covered.
      const census = lintVisibilityCandidates()
      const r = await runLeg(process.execPath, [ESLINT_BIN, ...census.candidates, '--format', 'json'], {
        cwd: REPO_ROOT,
        timeoutMs: 300_000,
        label: 'eslint over every tracked lintable file (the lint-visibility census)',
        classify: (x) => classifyLintVisibility(x, census, RATIFIED_INVISIBLE_PREFIXES),
      })
      // The census is printed, not just asserted: "0 unexpected" means nothing to a reader who
      // cannot see the denominator it was divided by.
      process.stderr.write(`lint-visibility: ${r.why}\n`)
      expect(r.verdict, `the lint-visibility census did not close. why: ${r.why}\n    tail:\n    ${tail(`${r.stdout}\n${r.stderr}`)}`).toBe('passed')

      // The detector itself, pinned against a message object copied VERBATIM out of a real
      // `--format json` report — `ruleId: null`, not an absent `ruleId`, which is the difference
      // between a detector and a decoration (see the comment on the classifier). Without this pin
      // the leg's zero could be a matcher that stopped firing: the same silence that made the
      // `universe:` line necessary last round, arriving one layer down.
      const ignoredLine = {
        ruleId: null,
        fatal: false,
        severity: 1,
        message: 'File ignored because of a matching ignore pattern. Use "--no-ignore" to disable file ignore settings or use "--no-warn-ignored" to suppress this warning.',
        nodeType: null,
      }
      const detector = classifyLintVisibility(
        { stdout: JSON.stringify([{ filePath: join(REPO_ROOT, 'packages', 'x', 'src', 'hides.ts'), messages: [ignoredLine] }]), stderr: '', code: 0 },
        { candidates: ['packages/x/src/hides.ts'], skipped: [] },
        RATIFIED_INVISIBLE_PREFIXES,
      )
      expect(detector.verdict, 'a tracked file ESLint reports as ignored must be counted as hidden — the leg may not detect nothing and call that coverage').toBe('failed')
      expect(detector.why).toContain('packages/x/src/hides.ts')
      // And a ratified prefix ratifies, it does not silence: the same input under a named
      // prefix passes, but still has to be counted out loud.
      const ratified = classifyLintVisibility(
        { stdout: JSON.stringify([{ filePath: join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'x', 'tool.mjs'), messages: [ignoredLine] }]), stderr: '', code: 0 },
        { candidates: ['dev/agent-workflow/evidence/x/tool.mjs'], skipped: [] },
        RATIFIED_INVISIBLE_PREFIXES,
      )
      expect(ratified.verdict).toBe('passed')
      expect(ratified.why).toContain('dev/ 1')
      // A census that lost track of part of its own list is not a census.
      expect(classifyLintVisibility(
        { stdout: JSON.stringify([{ filePath: join(REPO_ROOT, 'scripts', 'a.mjs'), messages: [] }]), stderr: '', code: 0 },
        { candidates: ['scripts/a.mjs', 'scripts/b.mjs'], skipped: [] },
        RATIFIED_INVISIBLE_PREFIXES,
      ).verdict, 'a report short of its candidate list has an unexplained gap and buys no belief').toBe('refused')
    })

    it('the committed install surface is fresh against the tree, and a missing surface is refused', { timeout: 330000 }, async () => {
      const r = await runLeg(process.execPath, ['scripts/check-artifacts-committed.mjs'], {
        cwd: REPO_ROOT,
        timeoutMs: 300_000,
        label: 'pnpm check:artifacts',
        classify: classifyArtifactsRun,
      })
      expect(r.verdict, `check:artifacts did not pass. why: ${r.why}`).toBe('passed')
      // The states, pinned against the tokens the script actually prints (captured from it at
      // this commit) without wrecking the tree to produce them.
      // All four states, on the channel the scripts actually emit (captured from the
      // scripts themselves at this commit; `pnpm check:artifacts` prints the first line
      // verbatim on a clean tree). Note `subject=index` on every one of them: that is the
      // scope of this instrument, and it is now part of the machine-readable answer rather
      // than of a sentence about a build it did not run.
      expect(classifyArtifactsRun({ stdout: 'DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=refused reason=surface-missing', stderr: '[check-artifacts-committed] ERROR: packages/runtime/dist missing — run `pnpm build && pnpm build:composition` first.', code: 1 }).verdict, 'a missing surface compared nothing, whatever the exit code says').toBe('refused')
      expect(classifyArtifactsRun({ stdout: 'DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=refused reason=empty-produced-set on_disk=0', stderr: '[check-artifacts-committed] NOT-RUN: the produced set is empty (0 of 0 files on disk survived the ignore filter) — the gate compared nothing and must not report OK.', code: 2 }).verdict).toBe('refused')
      expect(classifyArtifactsRun({ stdout: 'DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=1508 glue=1', stderr: '', code: 0 }).verdict).toBe('passed')
      expect(classifyArtifactsRun({ stdout: 'DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=0 glue=0', stderr: '', code: 0 }).verdict, 'verdict=ok over zero files is the old false green and is never a pass').toBe('refused')
      expect(classifyArtifactsRun({ stdout: 'DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=stale compared=1508 drift=20 sites=20', stderr: '[check-artifacts-committed] STALE install-surface artifacts — rebuild output must be committed together with the source change (same commit):', code: 1 }).verdict, 'a tree that owes its rebuild FAILS; it is not a refusal, and the two must never collapse').toBe('failed')
      // F4's direction of travel, pinned here as well: the same OK sentence arriving on STDERR is
      // not a pass. This instrument does not do that today (measured at this commit: `OK` on
      // stdout with stderr empty at exit 0, and it is the ERROR lines that go to stderr), which
      // is precisely why the arm is pinned against captured text rather than trusted to the
      // script's habits.
      expect(classifyArtifactsRun({ stdout: '', stderr: 'DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=1508 glue=1', code: 0 }).verdict,
        'a verdict on the wrong stream is not a verdict — green comes from stdout, red may come from either').toBe('refused')
      // The arm that makes this leg immune to prose: the old success sentence, in full, with
      // no token alongside it. This is exactly what `f0485b15` printed over 20 stale files and
      // what this leg believed. Prose alone can no longer produce a green at all.
      expect(classifyArtifactsRun({ stdout: '[check-artifacts-committed] OK: 1508 files; committed install-surface artifacts match the fresh build (incl. 1 glue placement(s))', stderr: '', code: 0 }).verdict,
        'prose is not a verdict channel; a run that states no token compared nothing this gate can stand behind').toBe('refused')
      // And the reworded sentence, likewise: it is the truth now, but the leg still refuses
      // to read it as the answer.
      expect(classifyArtifactsRun({ stdout: '[check-artifacts-committed] OK: 1508 files — working tree equals the git INDEX for both install surfaces (incl. 1 glue placement(s)). This script does not build, so this says the tree matches what is staged, NOT that a build produced these bytes; ask `pnpm check:artifacts:head` whether the commit carries its own build.', stderr: '', code: 0 }).verdict).toBe('refused')
    })

    it('the commit carries its own build, judged in a scratch worktree — the question the working tree cannot ask', { timeout: 600_000 }, async () => {
      // The leg this lane exists for. The leg above is not weak and was not broken: it asks
      // a different question, and the answer to THAT question stayed green over a surface 20
      // files stale. A merge gate whose install-surface leg only fires for whoever happens to
      // build is a gate that fires on memory, so this leg builds — in a throwaway worktree at
      // the commit under review, never in the tree it is reviewing.
      const r = await runLeg(process.execPath, ['scripts/check-artifacts-at-head.mjs'], {
        cwd: REPO_ROOT,
        timeoutMs: 540_000,
        label: 'pnpm check:artifacts:head',
        classify: classifyAtHeadRun,
      })
      expect(r.verdict, `check:artifacts:head did not pass. why: ${r.why}`).toBe('passed')
      // The two red answers stay distinct, pinned against the text the script actually prints.
      // Collapsing them is how an unwritable store, or a build that died, becomes a green.
      expect(classifyAtHeadRun({
        stdout: 'DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=f0485b15 verdict=stale compared=1508 drift=20',
        stderr: '[check-artifacts-committed] STALE install-surface artifacts — rebuild output must be committed together with the source change (same commit):',
        code: 1,
      }).verdict, 'a commit that owes its own rebuild is a failure, not a refusal').toBe('failed')
      expect(classifyAtHeadRun({
        stdout: 'DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=HEAD verdict=not-run reason=install',
        stderr: '',
        code: 3,
      }).verdict, 'a scratch that never installed never compared anything — refused, and the refusal says which step died').toBe('refused')
      expect(classifyAtHeadRun({
        stdout: 'DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=1508 glue=1\nDSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=2683653a verdict=ok compared=1508 drift=0',
        stderr: '',
        code: 0,
      }).verdict, 'the relayed inner token must not be mistaken for the outer verdict — the outer one is what the leg grades').toBe('passed')
      // …and the converse: an inner OK with no outer token is NOT a pass for this leg. That
      // is the exact confusion `check-artifacts-at-head.mjs` exists to make impossible, and
      // it is now asserted rather than argued.
      expect(classifyAtHeadRun({
        stdout: 'DSH-ARTIFACT-VERDICT script=check-artifacts-committed subject=index verdict=ok compared=1508 glue=1',
        stderr: '',
        code: 0,
      }).verdict, 'an index-subject verdict is not a commit-subject verdict').toBe('refused')
      expect(classifyAtHeadRun({
        stdout: 'DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=2683653a verdict=ok compared=1508 drift=0',
        stderr: '',
        code: 0,
      }).verdict).toBe('passed')
      // Same directional doctrine as its sibling: a green only counts on stdout. The scratch
      // run legitimately relays the instrument's drift list on stderr, so a stderr-only
      // `carries its own build` cannot be believed as a pass.
      expect(classifyAtHeadRun({
        stdout: '',
        stderr: 'DSH-ARTIFACT-VERDICT script=check-artifacts-at-head subject=commit rev=2683653a verdict=ok compared=1508 drift=0',
        code: 0,
      }).verdict, 'a verdict on the wrong stream is not a verdict').toBe('refused')
      expect(classifyAtHeadRun({ stdout: '', stderr: '', code: 0 }).verdict, 'silence is not a verdict about freshness').toBe('refused')
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
        { file: 'check-artifacts-at-head.mjs', rootScript: 'check:artifacts:head' },
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
