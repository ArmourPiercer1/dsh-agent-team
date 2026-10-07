#!/usr/bin/env node
/**
 * verify-blueprint-version-clean.mjs — A4-PR7 Task 7.5: the v3-only fence.
 *
 * WHAT IT CHECKS. After the v3-only cutover (Task 7.3) a Blueprint document that
 * declares schemaVersion 1 or 2 is a RETIRED document: this
 * product reads its identity and refuses to run it. So a fixture, a harness, or a
 * kit that still authors a v1/v2 document is not "an old test" — it is a live
 * emitter of documents the product will refuse, i.e. a maintenance lie that stays
 * green forever because nothing reads it. Alpha.4's ruling is that the tree must
 * say so LOUDLY and BY PATH. ADR A3-16 owns this scan; ADR A5-9 requires that
 * PR7's gate invoke it BY NAME, because nothing runs `scripts/*.mjs` implicitly
 * (the wrapper is `packages/testkit/test/a4p7-blueprint-version-clean.test.ts`,
 * and `verify-zero-core.mjs` — a script no test calls — is the cautionary
 * precedent this file exists to avoid repeating).
 *
 * THE PREDICATE (verbatim from the plan, Task 7.5):
 *   a string literal matching `schemaVersion: <digit>` in a file that also keys
 *   `blueprintId`, over `tests/kits/`, `scripts/`, and any `harness/` directory under `packages/`,
 *   excluding `dev/agent-workflow/evidence/**`.
 * Both halves matter: a file must be ABOUT a Blueprint (`blueprintId`) to be a
 * Blueprint-version site, and the literal must be the document key (not prose
 * about versions), which is why a prose document that merely discusses
 * `schemaVersion` in a table is not a finding.
 *
 * WHY `git ls-files` AND NOT A FILESYSTEM WALK. `tests/homes/` (DSH_HOME
 * worlds) and any `dist/` tree hold STORE COPIES and build output: a filesystem walk
 * reports a fixture's durable residue as a source finding, and both trees churn
 * between runs, which turns a fence into noise. Tracked files are the sources
 * this repository owns. WHY NOT `rg`: ripgrep is not installed in this
 * environment, and an `rg`-based scan here returns an all-zero result rather than
 * an error — a silent false negative, the worst failure a gate can have.
 *
 * HOW IT FAILS. It prints every offending site and exits 1. It NEVER compares
 * against a remembered count: a count in a document is not the contract (plan
 * X10), and the pre-flight's own counts were wrong twice. The DEFERRAL list — the
 * paths that are knowingly still v1/v2 while Task 7.4 migrates them lane by lane —
 * lives in the wrapper test, where each entry is reviewable and where a path that
 * became clean must be REMOVED. So the set is honest in both directions: a new
 * offending path fails, and a stale deferral entry fails.
 *
 * Exit codes: 0 clean · 1 offending sites found · 2 the scan could not run
 * (no git, no output) — "could not run" is never reported as "clean".
 */

import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

/** The scope prefixes/segments the plan names, and nothing else. */
const SCOPE_PREFIXES = ['tests/kits/', 'scripts/']
const SCOPE_SEGMENTS = ['/harness/']

/** Excluded from the scope, with the reason recorded rather than assumed. */
const EXCLUDED_PREFIXES = ['dev/agent-workflow/evidence/']
const EXCLUDED_SEGMENTS = ['/dist/']

/**
 * The document key, as written in a YAML source or a JS object literal.
 *
 * ONE READING DECISION, recorded rather than buried: the plan states the
 * predicate as "a string literal matching `schemaVersion: <digit>`", and read
 * literally that also flags `schemaVersion: 3` — i.e. it would fail every
 * correctly migrated fixture once Task 7.4 lands, which cannot be what a fence
 * named "version-clean" means after a cutover TO v3. So the predicate here is
 * the plan's shape restricted to a version this product does not run
 * (`v !== SUPPORTED`, currently 3). If the review wants the literal reading,
 * changing one comparison makes it so; the deviation is here so it is a choice
 * on the record, not an accident of implementation.
 */
const SUPPORTED_DOCUMENT_VERSION = 3
const VERSION_LITERAL = /schemaVersion:\s*(\d)/
const BLUEPRINT_KEY = /blueprintId/

function inScope(path) {
  if (EXCLUDED_PREFIXES.some((p) => path.startsWith(p))) return false
  if (EXCLUDED_SEGMENTS.some((p) => `/${path}`.includes(p))) return false
  if (SCOPE_PREFIXES.some((p) => path.startsWith(p))) return true
  return SCOPE_SEGMENTS.some((p) => `/${path}`.includes(p))
}

/**
 * The pure half of the predicate, exported so it can be tested on samples
 * instead of on a fixture the repository would have to carry: a file must key
 * `blueprintId` to be about a Blueprint at all, and every `schemaVersion: N`
 * line whose N is not the version this product runs is a site.
 */
export function versionSitesInText(text) {
  if (!BLUEPRINT_KEY.test(text)) return []
  const found = []
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index += 1) {
    const match = VERSION_LITERAL.exec(lines[index])
    if (match === null) continue
    const version = Number(match[1])
    if (version === SUPPORTED_DOCUMENT_VERSION) continue
    found.push({ line: index + 1, version })
  }
  return found
}

/** One scan run: the tracked files, the scope count, and the offending sites. */
export function scanBlueprintVersionSites() {
  // maxBuffer: the tracked-file list is ~1.1 MB NUL-separated at this base, and
  // the default 1 MB buffer kills the spawn with ENOBUFS — which this scan would
  // then (correctly, but confusingly) report as "not run". Sized generously: the
  // failure mode to avoid is a truncated list read as a clean tree.
  const git = spawnSync('git', ['ls-files', '-z'], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  if (git.status !== 0 || typeof git.stdout !== 'string' || git.stdout.length === 0) {
    return {
      ran: false,
      reason: `git ls-files failed (status ${String(git.status)}): ${String(git.stderr ?? '').trim()}`,
      scopeFiles: 0,
      sites: [],
    }
  }
  const tracked = git.stdout.split('\0').filter((p) => p.length > 0)
  const scopeFiles = tracked.filter(inScope)
  const sites = []
  for (const path of scopeFiles) {
    let text
    try {
      text = readFileSync(path, 'utf8')
    } catch (error) {
      // A tracked path that cannot be read is a scan integrity failure, not a
      // clean file: report it as a site (with the reason, so "unreadable" is
      // diagnosable instead of mysterious) so it cannot be silently skipped.
      sites.push({
        path,
        line: 0,
        version: null,
        unreadable: true,
        why: error instanceof Error ? error.message : String(error),
      })
      continue
    }
    for (const site of versionSitesInText(text)) {
      sites.push({ path, line: site.line, version: site.version, unreadable: false, why: null })
    }
  }
  sites.sort((a, b) => (a.path === b.path ? a.line - b.line : a.path < b.path ? -1 : 1))
  return { ran: true, reason: null, scopeFiles: scopeFiles.length, sites }
}

/** The plan's machine-readable report: one line per site, by path. */
export function formatReport(result) {
  const lines = []
  lines.push(`scan: blueprint document-version fence (A4-PR7 7.5, ADR A3-16)`)
  if (!result.ran) {
    lines.push(`RESULT not-run :: ${String(result.reason)}`)
    return lines.join('\n')
  }
  lines.push(`scope: tests/kits/, scripts/, packages/<pkg>/harness/ (evidence and dist excluded)`)
  lines.push(`scanned-in-scope: ${String(result.scopeFiles)} tracked files`)
  const paths = [...new Set(result.sites.map((s) => s.path))].sort()
  lines.push(`offending-files: ${String(paths.length)}`)
  for (const p of paths) {
    const here = result.sites.filter((s) => s.path === p)
    const where = here
      .map((s) =>
        s.unreadable
          ? `unreadable(${String(s.why ?? 'unknown')})`
          : `L${String(s.line)}=v${String(s.version)}`,
      )
      .join(', ')
    lines.push(`OFFENDING ${p} :: ${where}`)
  }
  lines.push(`RESULT ${paths.length === 0 ? 'clean' : `dirty(${String(paths.length)} files, ${String(result.sites.length)} sites)`}`)
  return lines.join('\n')
}

// --- CLI (the wrapper test imports the functions above and also spawns this) ---
const invokedDirectly =
  process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (invokedDirectly) {
  const result = scanBlueprintVersionSites()
  process.stdout.write(`${formatReport(result)}\n`)
  process.exit(!result.ran ? 2 : result.sites.length > 0 ? 1 : 0)
}
