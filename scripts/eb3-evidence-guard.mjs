#!/usr/bin/env node
/**
 * eb3-evidence-guard.mjs — refuse raw machine captures and oversized blobs that a PR ADDS
 * under the tracked evidence root.
 *
 * THE DEFECT THIS CLOSES, three layers deep (measured 2026-10-27):
 *
 *   1. SHARED DIRECTORY. The census leg (scripts/ci-pr-gate.mjs) wrote raw vitest JSON
 *      captures `census-<stamp>-<pid>-<n>.json` (~3.8 MB each) into the SAME tracked
 *      directory as its comparison sidecars `census-comparison-<stamp>-<pid>.json` (~2 KB,
 *      legitimate cited evidence). That directory cannot be blanket-ignored: 437 tracked
 *      files live under evidence `scratch/` paths.
 *   2. NAME SIMILARITY. `census-…json` next to `census-comparison-…json`: a `git add` of the
 *      directory, or of `census-*`, takes both.
 *   3. PROSE-ONLY RULE. UNTRACKED-SCRATCH.md said "not to be committed". PR #396 untracked
 *      nine captures (32 MB); three open lanes then re-committed 6–8 each.
 *
 * The census leg now writes captures to a gitignored location (layer 1, at the source).
 * This file is the machine backstop for layers 2 and 3: a PR that ADDS such a file fails CI.
 *
 * RULES, over files ADDED (git diff --diff-filter=A) since the base, under the evidence root:
 *
 *   EVIDENCE_RAW_CAPTURE      basename matches the raw-capture grammar
 *                             `census-<8 digits>T<6 digits>Z-<pid>-<n>.json` or `resample-*.json`.
 *                             No exemption: the allowlist exempts SIZE, never this name.
 *   EVIDENCE_OVERSIZED        blob larger than BOUND_BYTES and not named, with a reason, in
 *                             dev/ci/evidence-large-allowlist.json.
 *   EVIDENCE_ALLOWLIST_INVALID the allowlist is unreadable, has the wrong schema, or has an
 *                             entry without a non-empty `reason` (an unexplained exemption is
 *                             not a reviewed one).
 *
 * THE BOUND (1 MiB), from measurement at origin/master 0ea67bee8: of 1561 tracked evidence
 * blobs exactly ONE exceeds 1 MiB (RELOCATED-MANIFEST.tsv, 4.2 MB) and the next largest are
 * the golden-vector pairs at 750 KB; of 21921 historical additions under the evidence root,
 * 81 exceeded 1 MiB and 60 of those were NOT census captures (mock captures, api transcripts,
 * whole-suite JSON reports) — all re-derivable machine output of the same kind. The guard
 * grades ADDED files only, so the existing large files need no exemption; an edit to
 * RELOCATED-MANIFEST.tsv is a modification, not an addition.
 *
 * WHAT IT DOES NOT DO. It does not grade modifications, renames or files outside the evidence
 * root, and it does not judge whether a small file is worth committing.
 *
 *   node scripts/eb3-evidence-guard.mjs [--new-since <ref>] [--json]
 *     --new-since  base to diff against (`git diff --diff-filter=A <ref>...HEAD`), the same
 *                  base rule as `eb3-run-manifest.mjs --new-since`. Default: origin/master.
 *
 * Exported for scripts/eb3-ci-negative-controls.mjs (C15–C19):
 *   guardAddedEvidence({ root, since }), isRawCaptureName(basename), BOUND_BYTES
 *
 * Exit: 0 no findings | 1 findings | 2 could not grade.
 *
 * @module scripts/eb3-evidence-guard
 */
import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
export const EVIDENCE_ROOT = 'dev/agent-workflow/evidence/'
export const ALLOWLIST_REL = 'dev/ci/evidence-large-allowlist.json'
export const ALLOWLIST_SCHEMA = 'evidence-large-allowlist/1'
export const BOUND_BYTES = 1024 * 1024

const RAW_CAPTURE = /^census-\d{8}T\d{6}Z-\d+-\d+\.json$/
const RESAMPLE = /^resample-.*\.json$/

/** True for a raw census capture or resample basename; false for a comparison sidecar. */
export function isRawCaptureName(basename) {
  return RAW_CAPTURE.test(basename) || RESAMPLE.test(basename)
}

function loadAllowlist(root) {
  const abs = join(root, ALLOWLIST_REL)
  if (!existsSync(abs)) return { paths: new Map(), findings: [] }
  const findings = []
  let doc
  try { doc = JSON.parse(readFileSync(abs, 'utf8')) } catch (e) {
    return { paths: new Map(), findings: [{ code: 'EVIDENCE_ALLOWLIST_INVALID', path: ALLOWLIST_REL, detail: `does not parse: ${String(e?.message ?? e)}` }] }
  }
  if (doc?.schema !== ALLOWLIST_SCHEMA || !Array.isArray(doc.entries)) {
    return { paths: new Map(), findings: [{ code: 'EVIDENCE_ALLOWLIST_INVALID', path: ALLOWLIST_REL, detail: `schema must be ${ALLOWLIST_SCHEMA} with an entries array` }] }
  }
  const paths = new Map()
  for (const e of doc.entries) {
    if (typeof e?.path !== 'string' || e.path === '' || typeof e.reason !== 'string' || e.reason.trim() === '') {
      findings.push({ code: 'EVIDENCE_ALLOWLIST_INVALID', path: ALLOWLIST_REL, detail: `entry ${JSON.stringify(e)} needs a non-empty path AND reason — an unexplained exemption is not a reviewed one` })
      continue
    }
    paths.set(e.path, e.reason)
  }
  return { paths, findings }
}

/**
 * @param {object} p
 * @param {string} p.root   repository root
 * @param {string} p.since  base ref; the added set is `git diff --diff-filter=A <since>...HEAD`
 */
export function guardAddedEvidence({ root = ROOT, since }) {
  const git = (...a) => execFileSync('git', ['-C', root, ...a], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  const added = git('diff', '--no-renames', '--diff-filter=A', '--name-only', '-z', `${since}...HEAD`, '--', EVIDENCE_ROOT)
    .split('\0').filter((p) => p.length > 0)
  // Sizes from the committed blobs at HEAD, not the disk: what the PR adds is what is graded.
  const sizes = new Map()
  if (added.length > 0) {
    const out = execFileSync('git', ['-C', root, 'cat-file', '--batch-check=%(objectsize)'], {
      input: added.map((p) => `HEAD:${p}`).join('\n') + '\n', encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
    }).trim().split('\n')
    added.forEach((p, i) => sizes.set(p, Number(out[i])))
  }
  const allow = loadAllowlist(root)
  const findings = [...allow.findings]
  for (const p of added) {
    const size = sizes.get(p)
    if (isRawCaptureName(p.split('/').pop())) {
      findings.push({ code: 'EVIDENCE_RAW_CAPTURE', path: p, size, detail: `${p} (${String(size)} B) is a raw census capture/resample — machine output whose derived facts belong in the comparison sidecar; the census leg writes these to .artifacts/census/ (gitignored)` })
      continue
    }
    if (Number.isFinite(size) && size > BOUND_BYTES && !allow.paths.has(p)) {
      findings.push({ code: 'EVIDENCE_OVERSIZED', path: p, size, detail: `${p} is ${String(size)} B > ${String(BOUND_BYTES)} B — commit the derived numbers instead, or list it with a reason in ${ALLOWLIST_REL}` })
    }
  }
  return { added, boundBytes: BOUND_BYTES, exempted: added.filter((p) => allow.paths.has(p) && (sizes.get(p) ?? 0) > BOUND_BYTES), findings }
}

const invokedDirectly = process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) {
  const argv = process.argv.slice(2)
  const i = argv.indexOf('--new-since')
  const since = i > -1 ? argv[i + 1] : 'origin/master'
  let out
  try {
    if (typeof since !== 'string' || since === '') throw new Error('--new-since needs a ref')
    out = guardAddedEvidence({ root: ROOT, since })
  } catch (e) {
    console.error(`EB3-EVIDENCE-GUARD refused could-not-grade: ${String(e?.message ?? e).split('\n')[0]}`)
    process.exit(2)
  }
  if (argv.includes('--json')) console.log(JSON.stringify(out, null, 2))
  else {
    for (const f of out.findings) console.log(`  ${f.code} ${f.detail}`)
    if (out.exempted.length > 0) console.log(`  EXEMPTED (size only, by ${ALLOWLIST_REL}): ${out.exempted.join(', ')}`)
    console.log(`EB3-EVIDENCE-GUARD ${out.findings.length === 0 ? 'pass' : 'fail'} added=${String(out.added.length)} bound=${String(BOUND_BYTES)} exempted=${String(out.exempted.length)} findings=${String(out.findings.length)} base=${since}`)
    console.log('LIMIT grades files ADDED under the evidence root only; a green here says no raw capture and no unexempted file over the bound was added, not that every added file is worth keeping')
  }
  process.exit(out.findings.length === 0 ? 0 : 1)
}
