#!/usr/bin/env node
/**
 * a5sf-preflight.mjs — the SHARED ZERO-BOOT PREFLIGHT entry point.
 *
 * WHAT THIS IS. One command that grades a PRE-BOOT bundle and prints ONE
 * machine-readable verdict, without a Host, a port, a DSH_HOME or a pristine
 * checkout. It is the CLI half of
 * `tests/world-factory/lib/a5sf-acceptance-preflight.mjs`
 * (`runZeroBootPreflight`), not a second harness: every check lives in that
 * module, and this file only reads a file and prints the result.
 *
 * WHY IT EXISTS (owner reorganisation directive, 2026-11-06). The live drivers
 * each carry their own pre-start checks, so a defect of the instrument is only
 * found when a driver runs — and a driver run spends a boot. Two defects cost
 * real allocations: a two-case locator alias (candidate-1 allocation #1) and a
 * deny exercise whose root sat inside the OS profile's runtime allowance. Both
 * are decidable before any start; this command decides them.
 *
 * USAGE
 *   node scripts/a5sf-preflight.mjs --bundle <file.json>
 *   node scripts/a5sf-preflight.mjs --run-dir <evidence-dir>
 *   node scripts/a5sf-preflight.mjs --bundle <file.json> --repo <checkout>
 *   node scripts/a5sf-preflight.mjs --bundle <f.json> --repo . --host-root <pristine-host>
 *
 * WHY `--host-root` EXISTS. The pristine upstream checkout
 * (`tests/deepseek-harness-test-use`) is gitignored, so a fresh worktree NEVER
 * contains it, while every live driver runs in a worktree. Without this flag the
 * CLI grades `assembly.usable` against a tree that cannot have the host and
 * therefore fails every plan — a check that fires on the checkout layout instead
 * of on the plan. The flag redirects ONLY the `tests/deepseek-harness-test-use/`
 * prefix of a declared host-module path to the pristine checkout; every other
 * path is still probed against `--repo`, and a path that is absent under the
 * redirected root still fails `ASSEMBLY_HOST_MODULE_MISSING`. Nothing is
 * skipped, and the root actually used is printed in the verdict's `inputs`.
 *
 * The bundle schema is `a5sf-zero-boot-preflight/1`; a driver writes it as
 * `<evidence-dir>/preflight-bundle.json` BEFORE it spends a start. A run
 * directory without that file is REFUSED (`PREFLIGHT_BUNDLE_MISSING`) rather
 * than guessed from the run's own output: a preflight that reconstructs its
 * input from the result it is supposed to gate is decoration.
 *
 * OUTPUT (exactly one line on stdout):
 *   DSH-A5SF-PREFLIGHT {"schema":"a5sf-zero-boot-preflight/1","verdict":…}
 *
 * Exit codes: 0 = PASS, 1 = FAIL, 2 = the bundle could not be read (a usage or
 * I/O error is not a verdict about a plan).
 *
 * @module scripts/a5sf-preflight
 */
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { runZeroBootPreflight, ZERO_BOOT_PREFLIGHT_SCHEMA } from '../tests/world-factory/lib/a5sf-acceptance-preflight.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_REPO = resolve(HERE, '..')
const HOST_PREFIX = 'tests/deepseek-harness-test-use'

function usage(message) {
  return {
    schema: ZERO_BOOT_PREFLIGHT_SCHEMA,
    verdict: 'FAIL',
    error: `USAGE: ${message}`,
    usage: 'node scripts/a5sf-preflight.mjs --bundle <file.json> | --run-dir <evidence-dir> [--repo <checkout>] [--host-root <pristine-host>]',
  }
}

function parseArgs(argv) {
  const opts = { bundle: null, runDir: null, repo: DEFAULT_REPO, hostRoot: null, pretty: false }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--bundle') opts.bundle = argv[(i += 1)]
    else if (a === '--run-dir') opts.runDir = argv[(i += 1)]
    else if (a === '--repo') opts.repo = argv[(i += 1)]
    else if (a === '--host-root') opts.hostRoot = argv[(i += 1)]
    else if (a === '--pretty') opts.pretty = true
    else return { error: `unknown argument ${JSON.stringify(a)}` }
  }
  if (opts.bundle !== null && opts.runDir !== null) return { error: '--bundle and --run-dir are mutually exclusive' }
  if (opts.bundle === null && opts.runDir === null) return { error: 'one of --bundle or --run-dir is required' }
  return { opts }
}

/** The one line a consumer reads. JSON after a stable token, so `| grep` and
 *  `| jq -r .verdict` both work without a second format. */
function emit(result, { pretty = false } = {}) {
  if (pretty) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
    return
  }
  process.stdout.write(`DSH-A5SF-PREFLIGHT ${JSON.stringify(result)}\n`)
}

function main(argv) {
  const parsed = parseArgs(argv)
  if (parsed.error !== undefined) {
    emit(usage(parsed.error))
    return 2
  }
  const { opts } = parsed
  const bundlePath = opts.bundle !== null ? resolve(opts.bundle) : join(resolve(opts.runDir), 'preflight-bundle.json')
  if (!existsSync(bundlePath)) {
    emit({
      schema: ZERO_BOOT_PREFLIGHT_SCHEMA,
      verdict: 'FAIL',
      findings: [{
        code: 'PREFLIGHT_BUNDLE_MISSING',
        detail: `${bundlePath} does not exist. A driver must WRITE its plan as this bundle before it spends a start; a preflight reconstructed from a run's own output is decoration.`,
      }],
      summary: 'FAIL 0/0 checks',
    })
    return 1
  }
  let bundle
  try {
    bundle = JSON.parse(readFileSync(bundlePath, 'utf8'))
  } catch (error) {
    emit({
      schema: ZERO_BOOT_PREFLIGHT_SCHEMA,
      verdict: 'FAIL',
      findings: [{ code: 'PREFLIGHT_BUNDLE_UNREADABLE', detail: `${bundlePath}: ${String(error?.message ?? error)}` }],
      summary: 'FAIL 0/0 checks',
    })
    return 2
  }
  const repo = resolve(opts.repo)
  const hostRoot = opts.hostRoot === null ? null : resolve(opts.hostRoot)
  // The probe is the ONE fact the pure checks cannot see: whether the declared
  // native modules and build artifacts exist in THIS checkout. Declared
  // existence is accepted only when the caller passes `--repo` with no path...
  // it is always passed (default = this checkout), so a fixture can only prove
  // the check, never the build.
  //
  // `--host-root` remaps the gitignored pristine-checkout prefix and nothing
  // else. It is a redirection of WHERE that subtree is looked up, not a waiver:
  // the remapped path must still exist, and every non-host path is unchanged.
  const fileExists = (rel) => {
    const clean = String(rel).replace(/^\.\//, '')
    if (hostRoot !== null && (clean === HOST_PREFIX || clean.startsWith(`${HOST_PREFIX}/`))) {
      const rest = clean === HOST_PREFIX ? '' : clean.slice(HOST_PREFIX.length + 1)
      return existsSync(resolve(hostRoot, rest))
    }
    return existsSync(resolve(repo, clean))
  }
  const result = runZeroBootPreflight(bundle, { fileExists })
  // `runZeroBootPreflight` returns a frozen verdict; the probe inputs are
  // appended here so a reader can tell WHICH roots produced the answer (the
  // result itself stays immutable).
  const graded = { ...result, inputs: { repo, hostRoot, hostPrefixRemapped: hostRoot !== null } }
  emit(graded, { pretty: opts.pretty })
  return result.verdict === 'PASS' ? 0 : 1
}

process.exitCode = main(process.argv.slice(2))
