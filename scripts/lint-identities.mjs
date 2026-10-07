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
    return {
      ran: false,
      reason:
        `eslint produced no JSON (status ${String(eslint.status)}, ` +
        `signal ${String(eslint.signal)}, error ${String(eslint.error ?? 'none')})`,
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
  for (const file of parsed) {
    const path = String(file.filePath).startsWith(prefix)
      ? String(file.filePath).slice(prefix.length)
      : String(file.filePath)
    for (const m of file.messages ?? []) {
      ids.push(`${m.severity === 2 ? 'error' : 'warning'} ${String(m.ruleId ?? '(parse-fatal)')} ${path}`)
    }
  }
  ids.sort()
  return { ran: true, reason: null, ids }
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
