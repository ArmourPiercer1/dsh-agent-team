#!/usr/bin/env node
/**
 * lint-identities.mjs — A4-PR7 Task 7.5: the lint identity capture and diff, so
 * the normaliser stops being a shell recipe copied out of an evidence README.
 *
 * WHY THIS EXISTS. Alpha.4's lint rule is not "lint clean" — it is "no NEW
 * diagnostic identity relative to the recorded baseline" (see
 * `dev/agent-workflow/evidence/a4-lint-baseline/README.md`): a drive-by cleanup
 * across 44 test files inside a governance PR is exactly how a permission change
 * acquires an unreviewed diff. That rule needs an operation, and the README's
 * operation was `npx eslint . --format json` piped through an inline `node -e`
 * snippet copied into a chat log. Copy-paste normalisers drift, and a drift here
 * silently changes what "no new identity" means. `scripts/fail-set.mjs` already
 * does this for test-failure identities; the README's own "known gap" line asked
 * for the lint half, and PR7 owns it.
 *
 * IDENTITY = (severity, ruleId, file), one line each, IN THE BASELINE'S FORMAT —
 * byte-compatible on purpose, so the recorded baselines remain diffable. The
 * baseline format keeps duplicates (one line per ESLint message), so capture
 * keeps them; the DIFF is a set comparison, because the criterion is "no line on
 * the right that is absent on the left", never a count (plan X10: the earlier
 * counts were wrong twice).
 *
 * Usage:
 *   node scripts/lint-identities.mjs --out <file>            # capture
 *   node scripts/lint-identities.mjs --out <f> --diff <base>  # capture + gate
 *   node scripts/lint-identities.mjs --diff <base>            # gate, no file
 *   node scripts/lint-identities.mjs --target "packages/testkit" …  # narrowed run
 * Exit: 0 no new identity · 1 new identities listed on stderr · 2 the lint run
 * itself failed to produce parseable output (never reported as "clean").
 */

import { spawnSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

function parseArgs(argv) {
  const out = { target: '.', outPath: null, baseline: null }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--out') out.outPath = argv[(i += 1)]
    else if (a === '--diff') out.baseline = argv[(i += 1)]
    else if (a === '--target') out.target = argv[(i += 1)]
    else throw new Error(`unknown argument: ${String(a)}`)
  }
  return out
}

/**
 * What a child process said while it was dying, in the only three forms that question has:
 * nothing was captured, nothing was written, or here is the tail. Kept a function rather than
 * inline prose for a reason the review round made concrete — §7.6's `runLeg` always pipes, so the
 * "not captured" arm was reachable by no test in the tree and stood in a refusal vocabulary as
 * untested text, which is the same thing this file's other comment condemns. It is now reached
 * directly by a leg in `a4p7-merge-gate.test.ts`, and it stays honest for the callers that really
 * can produce `undefined`: anything invoking this module with stdio inherited rather than piped.
 */
export function describeStderr(stderr) {
  if (stderr === undefined || stderr === null) {
    return 'not captured (stdio was not a pipe — this caller did not capture the child)'
  }
  const text = String(stderr)
  if (text.trim() === '') return `empty (${String(text.length)} bytes)`
  return `${String(text.length)} bytes, tail: ${text.trim().split('\n').slice(-8).join(' | ')}`
}

/** Run ESLint with the JSON formatter and normalise to identity lines. */
export function captureIdentities(target, cwd) {
  const eslint = spawnSync('npx', ['eslint', target, '--format', 'json'], {
    cwd,
    encoding: 'utf8',
    // A whole-repo JSON report is multi-megabyte; the default buffer would kill
    // the spawn (ENOBUFS) and an empty parse would look like a clean tree.
    maxBuffer: 256 * 1024 * 1024,
  })
  const stdout = eslint.stdout ?? ''
  const start = stdout.indexOf('[')
  if (start < 0) {
    // A NOT-RUN reason is the only part of a NOT-RUN anyone reads, and this one stopped at
    // the exit code: `status 2, signal null, error none` says eslint died and says nothing
    // about what it said while dying. Its stderr WAS captured by the spawn and thrown away.
    const said = describeStderr(eslint.stderr)
    return {
      ran: false,
      reason:
        `eslint produced no JSON (status ${String(eslint.status)}, ` +
        `signal ${String(eslint.signal)}, error ${String(eslint.error ?? 'none')}); eslint stderr: ${said}`,
      ids: [],
    }
  }
  let parsed
  try {
    parsed = JSON.parse(stdout.slice(start))
  } catch (error) {
    return { ran: false, reason: `unparseable eslint JSON: ${String(error)}`, ids: [] }
  }
  const prefix = `${cwd}/`
  const ids = []
  const scanned = []
  for (const file of parsed) {
    const path = String(file.filePath).startsWith(prefix)
      ? String(file.filePath).slice(prefix.length)
      : String(file.filePath)
    scanned.push(path)
    for (const m of file.messages ?? []) {
      ids.push(`${m.severity === 2 ? 'error' : 'warning'} ${String(m.ruleId ?? '(parse-fatal)')} ${path}`)
    }
  }
  ids.sort()
  return { ran: true, reason: null, ids, universe: lintUniverse(cwd, scanned) }
}

/**
 * What the scan actually read, printed next to the verdict it produced.
 *
 * ESLint does not read `.gitignore`, so the identity set is a function of the FILES, not of
 * the tree a reviewer can see with `git status`. That is deliberate (the baseline is what a
 * human gets when they run `pnpm lint`) and it is also how a lane that leaves one scratch
 * `.mjs` at the repository root turns §7.6's lint leg red without touching a tracked byte —
 * measured: a root-level `.tmp-resolve-probe.mjs`, listed by name in `.gitignore`, is linted,
 * produces `error no-undef .tmp-resolve-probe.mjs`, and reads as a new identity. A leg whose
 * universe can change underneath it without saying so is not a measurement, so the universe
 * is stated on every run: file count, and how many of those files git is told to ignore.
 */
export function lintUniverse(cwd, paths) {
  if (paths.length === 0) return { files: 0, ignored: [] }
  const r = spawnSync('git', ['check-ignore', '--stdin'], {
    cwd,
    encoding: 'utf8',
    input: `${paths.join('\n')}\n`,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (r.status !== 0 && r.status !== 1) return { files: paths.length, ignored: [], unreadable: `git check-ignore exited ${String(r.status)}` }
  return { files: paths.length, ignored: (r.stdout ?? '').split('\n').filter(Boolean).sort() }
}

/** The set-criterion: identities present on the right and absent on the left. */
export function newIdentities(baselineLines, currentLines) {
  const baseline = new Set(baselineLines.filter((l) => l.trim().length > 0))
  const seen = new Set()
  const fresh = []
  for (const line of currentLines) {
    if (line.trim().length === 0 || baseline.has(line) || seen.has(line)) continue
    seen.add(line)
    fresh.push(line)
  }
  return fresh
}

/**
 * The CLI body, wrapped instead of left at module scope so that IMPORTING this module does not
 * run it. §7.6's spec imports `describeStderr` out of this file; with the body unguarded, that
 * import silently launched a whole-repository ESLint scan inside the test worker and inherited
 * the `process.exit(2)` below. An import that costs ten seconds and can kill the process is not
 * a library, and it is the same failure the reviewer named for the untested stderr arm: a path
 * nothing ever exercised is not covered, it is only unvisited.
 */
async function runCli() {
  const args = parseArgs(process.argv.slice(2))
  const cwd = process.cwd()
  const capture = captureIdentities(args.target, cwd)
  if (!capture.ran) {
    process.stderr.write(`lint-identities: NOT RUN :: ${String(capture.reason)}\n`)
    process.exit(2)
  }
  if (args.outPath !== null) {
    writeFileSync(resolve(cwd, args.outPath), `${capture.ids.join('\n')}\n`)
  }
  process.stdout.write(
    `lint-identities: ${String(capture.ids.length)} identity lines, ` +
      `${String(new Set(capture.ids).size)} distinct (target ${args.target})\n`,
  )
  {
    const u = capture.universe ?? { files: 0, ignored: [] }
    const shown = u.ignored.slice(0, 8).join(', ')
    process.stdout.write(
      `lint-identities: universe: ${String(u.files)} file(s) linted, ${String(u.ignored.length)} of them gitignored ` +
        `(ESLint does not read .gitignore, so the identity set is a function of these files, not of git status)` +
        `${u.ignored.length > 0 ? `: ${shown}${u.ignored.length > 8 ? ` (+${String(u.ignored.length - 8)} more)` : ''}` : ''}` +
        `${'unreadable' in u && u.unreadable !== undefined ? `; universe provenance INCOMPLETE: ${String(u.unreadable)}` : ''}\n`,
    )
  }
  if (args.baseline !== null) {
    const { readFileSync } = await import('node:fs')
    const baselineLines = readFileSync(resolve(cwd, args.baseline), 'utf8').split('\n')
    const fresh = newIdentities(baselineLines, capture.ids)
    const gone = newIdentities(capture.ids, baselineLines)
    process.stdout.write(
      `baseline ${args.baseline}: ${String(new Set(baselineLines.filter(Boolean)).size)} distinct; ` +
        `new ${String(fresh.length)}, resolved ${String(gone.length)}\n`,
    )
    if (fresh.length > 0) {
      process.stderr.write(`NEW IDENTITIES (${String(fresh.length)}):\n`)
      for (const line of fresh) process.stderr.write(`  ${line}\n`)
      process.exit(1)
    }
  }
}

// Run when EXECUTED — `node scripts/lint-identities.mjs`, which is exactly what `pnpm
// lint:identities` is — and not when imported.
const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  await runCli()
}
