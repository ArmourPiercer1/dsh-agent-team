#!/usr/bin/env node
/**
 * verify-candidate.mjs — INDEPENDENT verification library + CLI for a frozen
 * candidate manifest (owner ruling D8, option 2).
 *
 * WHY THIS EXISTS. A manifest is only checkable by someone other than its author
 * if "does this manifest still describe reality?" is a program, not a paragraph.
 * This module answers that question from the repository itself: it re-derives
 * every digest, re-reads the live Authority pointer through the one authority
 * loader, re-runs the ancestry checks, re-reads the host pin, and then verifies
 * the EVIDENCE the manifest cites.
 *
 * THE ONE HARD REFUSAL. A cited run record that claims candidate eligibility
 * (`candidateClaimEligibility.eligible === true`, or `recordClass: CANDIDATE-C2`)
 * must carry `candidateCommit`/`candidateSha` equal to the manifest's
 * `candidate_commit`. Without that, verification is REFUSED (exit nonzero) —
 * never a warning. A verifier that only warns is how a DEV-LIVE record gets read
 * as a candidate acceptance.
 *
 * WHAT THIS IS NOT. Not a gate leg: it is not wired into any Required context and
 * must not be. `verifiedFor` semantics, Q7 and the Authority six-field contract
 * are untouched. The optional CI workflow that runs it is informational and its
 * name says so.
 *
 * USAGE
 *   node scripts/verify-candidate.mjs \
 *     [--manifest dev/engineering/candidates/cand-v0.1.6-1.json] \
 *     [--root .] [--record <run-record.json>]... [--json]
 *
 * EXIT: 0 every edge PASS; 1 any MISMATCH/MISSING/REFUSED/UNVERIFIABLE; 2 usage
 * or manifest read failure. There is no "warn" exit.
 */
import { existsSync, readFileSync } from 'node:fs'
import { isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  HOST_TREE_REL,
  PRODUCT_PATHS,
  git,
  isJudgePath,
  manifestDigest,
  resolveMasterRef,
  readAuthorityStatus,
} from './freeze-candidate.mjs'

/** The closed record-class set from tests/world-factory/lib/acceptance-claim.mjs. */
export const RECORD_CLASSES = Object.freeze(['DEV-LIVE', 'CANDIDATE-C2'])
export const CANDIDATE_RECORD_CLASS = 'CANDIDATE-C2'

/** Edge verdict vocabulary. Only PASS is green; everything else is a nonzero exit. */
export const VERDICTS = Object.freeze(['PASS', 'MISMATCH', 'MISSING', 'REFUSED', 'UNVERIFIABLE'])

function add(verdicts, edge, verdict, detail) {
  verdicts.push({ edge, verdict, detail })
}

function gitOrNull(root, args) {
  const r = git(root, args)
  return r.status === 0 ? r.stdout : null
}

function resolveRefTip(root, ref) {
  const name = String(ref).replace(/^refs\/heads\//, '')
  for (const candidate of [`refs/heads/${name}`, `refs/remotes/origin/${name}`]) {
    const sha = gitOrNull(root, ['rev-parse', '--verify', '--quiet', candidate])
    if (sha) return { sha, ref: candidate }
  }
  return null
}

function parsePathsPin(text) {
  const version = /export const DSH_BASELINE_VERSION\s*=\s*'([^']+)'/.exec(text)
  const sha = /export const TEST_USE_BASELINE_SHA\s*=\s*'([0-9a-f]{40})'/.exec(text)
  return version && sha ? { version: version[1], sha: sha[1] } : null
}

/** Verify one cited run record. Returns exactly one {edge, verdict, detail}. */
export function verifyRecord(entry, root, manifest) {
  const rel = typeof entry === 'string' ? entry : entry.path
  const edge = `evidence.${rel}`
  const abs = isAbsolute(rel) ? rel : join(root, rel)
  if (!existsSync(abs)) return { edge, verdict: 'MISSING', detail: `cited run record does not exist: ${rel}` }
  let record
  try { record = JSON.parse(readFileSync(abs, 'utf8')) } catch (e) {
    return { edge, verdict: 'MISMATCH', detail: `cited run record is not JSON: ${e.message}` }
  }
  const declaredClass = record.recordClass ?? (typeof entry === 'object' ? entry.record_class : undefined) ?? null
  if (declaredClass !== null && !RECORD_CLASSES.includes(declaredClass)) {
    return { edge, verdict: 'REFUSED', detail: `recordClass ${JSON.stringify(declaredClass)} is outside the closed set ${RECORD_CLASSES.join(' | ')}; unknown never passes` }
  }

  const eligibility = record.candidateClaimEligibility
  const claimsEligible = eligibility !== undefined && eligibility !== null && eligibility.eligible === true
  // Accept both names the track has used; a candidate-bound record must carry one.
  const recCommit = record.candidateCommit ?? record.candidateSha ?? null
  const expected = manifest.candidate_commit

  if (claimsEligible) {
    if (declaredClass !== CANDIDATE_RECORD_CLASS) {
      return { edge, verdict: 'REFUSED', detail: `record claims candidate eligibility (candidateClaimEligibility.eligible=true) but recordClass=${JSON.stringify(declaredClass)}; only ${CANDIDATE_RECORD_CLASS} may` }
    }
    if (!recCommit) {
      return { edge, verdict: 'REFUSED', detail: `record claims candidate eligibility without candidateCommit/candidateSha — refusing: an eligibility claim with no matching commit is exactly the evidence laundering this verifier exists to stop` }
    }
    if (recCommit !== expected) {
      return { edge, verdict: 'REFUSED', detail: `record claims candidate eligibility for ${recCommit}, but this manifest freezes ${expected}; a candidate claim is bound to one SHA` }
    }
  } else if (declaredClass === CANDIDATE_RECORD_CLASS) {
    if (!recCommit) {
      return { edge, verdict: 'REFUSED', detail: `recordClass=${CANDIDATE_RECORD_CLASS} but the record carries no candidateCommit/candidateSha; a C2 record must name the tree it measured` }
    }
    if (recCommit !== expected) {
      return { edge, verdict: 'MISMATCH', detail: `recordClass=${CANDIDATE_RECORD_CLASS} measured ${recCommit}, manifest freezes ${expected}` }
    }
  } else if (recCommit !== null && recCommit !== expected) {
    return { edge, verdict: 'MISMATCH', detail: `record names candidateCommit/candidateSha ${recCommit}, manifest freezes ${expected}` }
  } else if (typeof entry === 'object' && entry.candidate_bound === true && recCommit === null) {
    return { edge, verdict: 'REFUSED', detail: 'manifest marks this record candidate_bound, but the record carries no candidateCommit/candidateSha' }
  }

  if (typeof entry === 'object' && entry.run_id && record.runId !== entry.run_id) {
    return { edge, verdict: 'MISMATCH', detail: `manifest cites run ${entry.run_id}, record says ${JSON.stringify(record.runId)}` }
  }

  const classText = declaredClass === null ? 'legacy/class-absent' : declaredClass
  const eligibleText = claimsEligible ? 'eligible=true' : 'eligible=false'
  return {
    edge,
    verdict: 'PASS',
    detail: `runId=${record.runId ?? '(none)'} recordClass=${classText} ${eligibleText}${recCommit ? ` candidateCommit=${recCommit}` : ''} — ${claimsEligible ? 'candidate claim matches this manifest' : 'no candidate claim, preserved reference only'}`,
  }
}

/**
 * Verify a manifest against the live repository. Pure apart from reads and git.
 *
 * @param {object} input
 * @param {string} [input.root]
 * @param {object} input.manifest parsed manifest
 * @param {string[]|object[]} [input.extraRecords] run records to verify in addition
 *   to the manifest's cited ones (the CLI's `--record`). Lets a reviewer check the
 *   C2 records produced AFTER the freeze without rewriting the immutable manifest.
 * @returns {{ok:boolean, candidate_id:string|null, candidate_commit:string|null, verdicts:object[], counts:object}}
 */
export function verifyManifest({ root = '.', manifest, extraRecords = [] } = {}) {
  const repo = resolve(root)
  const verdicts = []
  const candidateCommit = manifest?.candidate_commit ?? null

  // ── manifest identity / shape ───────────────────────────────────────────────
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    add(verdicts, 'manifest.shape', 'MISMATCH', 'manifest is not a JSON object')
    return finish(manifest, verdicts)
  }
  const shapeProblems = []
  if (manifest.schema_version !== 1) shapeProblems.push(`schema_version=${JSON.stringify(manifest.schema_version)} (expected 1)`)
  if (manifest.kind !== 'frozen-candidate') shapeProblems.push(`kind=${JSON.stringify(manifest.kind)} (expected "frozen-candidate")`)
  for (const key of ['candidate_id', 'candidate_ref', 'candidate_commit']) {
    if (typeof manifest[key] !== 'string' || manifest[key] === '') shapeProblems.push(`${key} missing/empty`)
  }
  if (candidateCommit !== null && !/^[0-9a-f]{40}$/.test(candidateCommit)) shapeProblems.push(`candidate_commit is not 40-hex: ${candidateCommit}`)
  add(verdicts, 'manifest.shape', shapeProblems.length === 0 ? 'PASS' : 'MISMATCH', shapeProblems.length === 0 ? `${manifest.candidate_id} / ${manifest.candidate_commit}` : shapeProblems.join('; '))

  if (candidateCommit !== null) {
    const resolved = gitOrNull(repo, ['rev-parse', '--verify', '--quiet', `${candidateCommit}^{commit}`])
    add(verdicts, 'candidate_commit.resolves', resolved ? 'PASS' : 'MISSING', resolved ? `${candidateCommit} is a commit in this repository` : `${candidateCommit} does not resolve to a commit here`)
  }

  // The ref must still point at the frozen commit (a moved ref is the §7.5
  // Q7_CANDIDATE_REF_MOVED condition, reported here rather than warned about).
  if (typeof manifest.candidate_ref === 'string') {
    const tip = resolveRefTip(repo, manifest.candidate_ref)
    if (!tip) add(verdicts, 'candidate_ref.tip', 'UNVERIFIABLE', `${manifest.candidate_ref} is absent locally and from origin; cannot prove the ref is frozen at ${candidateCommit}`)
    else if (tip.sha !== candidateCommit) add(verdicts, 'candidate_ref.tip', 'MISMATCH', `${tip.ref} points at ${tip.sha}, manifest freezes ${candidateCommit}`)
    else add(verdicts, 'candidate_ref.tip', 'PASS', `${tip.ref} = ${tip.sha} (frozen)`)
  }

  // ── content digest (F0) ─────────────────────────────────────────────────────
  if (typeof manifest.content_digest === 'string') {
    const recomputed = manifestDigest(manifest)
    add(verdicts, 'content_digest', recomputed === manifest.content_digest ? 'PASS' : 'MISMATCH', recomputed === manifest.content_digest ? `${manifest.content_digest} (F0, digest fields removed)` : `manifest says ${manifest.content_digest}, recomputed ${recomputed}`)
  } else {
    add(verdicts, 'content_digest', 'MISSING', 'manifest has no content_digest')
  }

  // ── product trees / blobs ───────────────────────────────────────────────────
  const trees = manifest.product?.trees
  if (!trees || typeof trees !== 'object') {
    add(verdicts, 'product.trees', 'MISSING', 'manifest has no product.trees block')
  } else {
    for (const path of PRODUCT_PATHS) {
      const edge = `product.trees.${path}`
      if (!(path in trees)) { add(verdicts, edge, 'MISSING', `required product path not listed in product.trees`); continue }
      const actual = candidateCommit ? gitOrNull(repo, ['rev-parse', `${candidateCommit}:${path}`]) : null
      if (!actual) { add(verdicts, edge, 'UNVERIFIABLE', `cannot read ${candidateCommit}:${path} from git`); continue }
      add(verdicts, edge, actual === trees[path] ? 'PASS' : 'MISMATCH', actual === trees[path] ? actual : `manifest=${trees[path]} recomputed=${actual}`)
    }
    for (const path of Object.keys(trees).sort()) {
      if (PRODUCT_PATHS.includes(path)) continue
      const actual = candidateCommit ? gitOrNull(repo, ['rev-parse', `${candidateCommit}:${path}`]) : null
      add(verdicts, `product.trees.${path}`, actual === trees[path] ? 'PASS' : 'MISMATCH', actual === trees[path] ? actual : `manifest=${trees[path]} recomputed=${actual ?? '<missing>'}`)
    }
  }

  // ── product equality vs the product commit ──────────────────────────────────
  const productSha = manifest.product?.sha
  if (!productSha) {
    add(verdicts, 'product.equality', 'MISSING', 'manifest has no product.sha')
  } else if (!candidateCommit) {
    add(verdicts, 'product.equality', 'UNVERIFIABLE', 'no candidate_commit to diff against')
  } else {
    const r = git(repo, ['diff', '--stat', productSha, candidateCommit, '--', ...PRODUCT_PATHS])
    if (r.status !== 0) add(verdicts, 'product.equality', 'UNVERIFIABLE', `git diff failed: ${r.stderr}`)
    else {
      const expectedExit = manifest.product?.equality_exit
      const clean = r.stdout === '' && r.status === 0
      const exitAgrees = expectedExit === undefined || expectedExit === r.status
      add(verdicts, 'product.equality', clean && exitAgrees ? 'PASS' : 'MISMATCH', clean && exitAgrees ? `product ${productSha} == candidate ${candidateCommit} on every product path (exit 0)` : `diff exit=${r.status} (manifest said ${expectedExit}); output=${r.stdout || '(empty)'}`)
    }
  }

  // ── judges / drivers ────────────────────────────────────────────────────────
  const judges = manifest.product?.judges
  if (!judges || typeof judges !== 'object') {
    add(verdicts, 'product.judges', 'MISSING', 'manifest has no product.judges block')
  } else {
    for (const path of Object.keys(judges).sort()) {
      const edge = `product.judges.${path}`
      const actual = candidateCommit ? gitOrNull(repo, ['rev-parse', `${candidateCommit}:${path}`]) : null
      if (!actual) { add(verdicts, edge, 'UNVERIFIABLE', `cannot read ${candidateCommit}:${path}`); continue }
      add(verdicts, edge, actual === judges[path] ? 'PASS' : 'MISMATCH', actual === judges[path] ? actual : `manifest=${judges[path]} recomputed=${actual}`)
    }
    // A newly added a5sf judge that the manifest does not pin is a gap, not a pass.
    const listed = gitOrNull(repo, ['ls-tree', '-r', '--name-only', candidateCommit, '--', 'tests/world-factory'])
    if (listed) {
      const actualJudges = listed.split('\n').map((s) => s.trim()).filter(Boolean).filter(isJudgePath)
      const missing = actualJudges.filter((p) => !(p in judges)).sort()
      add(verdicts, 'product.judges.coverage', missing.length === 0 ? 'PASS' : 'MISMATCH', missing.length === 0 ? `all ${actualJudges.length} judge/driver files at ${candidateCommit} are pinned` : `unpinned judge/driver files: ${missing.join(', ')}`)
    }
  }

  // ── authority block vs the LIVE pointer ─────────────────────────────────────
  const authority = manifest.authority
  if (!authority || typeof authority !== 'object') {
    add(verdicts, 'authority', 'MISSING', 'manifest has no authority block')
  } else {
    const live = readAuthorityStatus(repo)
    if (!live.ok) {
      add(verdicts, 'authority.live', 'UNVERIFIABLE', `${live.refused}: ${live.detail ?? ''}`)
    } else {
      const pairs = [
        ['authority.pointer', authority.pointer, live.pointer],
        ['authority.snapshot_version', authority.snapshot_version, live.snapshot_version],
        ['authority.content_digest', authority.content_digest, live.content_digest],
        ['authority.snapshot_baseline', authority.snapshot_baseline, live.snapshot_baseline],
      ]
      for (const [edge, claimed, actual] of pairs) {
        add(verdicts, edge, claimed === actual ? 'PASS' : 'MISMATCH', claimed === actual ? actual : `manifest=${JSON.stringify(claimed)} live=${JSON.stringify(actual)}`)
      }
    }
  }

  // ── dependencies / host pin ─────────────────────────────────────────────────
  const deps = manifest.dependencies
  if (!deps || typeof deps !== 'object') {
    add(verdicts, 'dependencies', 'MISSING', 'manifest has no dependencies block')
  } else {
    const pathsText = candidateCommit ? gitOrNull(repo, ['show', `${candidateCommit}:tests/paths.mjs`]) : null
    const pin = pathsText ? parsePathsPin(pathsText) : null
    if (!pin) {
      add(verdicts, 'dependencies.host_pin', 'UNVERIFIABLE', `cannot parse tests/paths.mjs at ${candidateCommit}`)
    } else {
      add(verdicts, 'dependencies.host_baseline_version', deps.host_baseline_version === pin.version ? 'PASS' : 'MISMATCH', deps.host_baseline_version === pin.version ? pin.version : `manifest=${deps.host_baseline_version} tests/paths.mjs=${pin.version}`)
      add(verdicts, 'dependencies.host_sha', deps.host_sha === pin.sha ? 'PASS' : 'MISMATCH', deps.host_sha === pin.sha ? pin.sha : `manifest=${deps.host_sha} tests/paths.mjs=${pin.sha}`)
    }
    const lockTree = candidateCommit ? gitOrNull(repo, ['rev-parse', `${candidateCommit}:pnpm-lock.yaml`]) : null
    const pkgTree = candidateCommit ? gitOrNull(repo, ['rev-parse', `${candidateCommit}:package.json`]) : null
    add(verdicts, 'dependencies.lockfile_tree', lockTree === deps.lockfile_tree ? 'PASS' : 'MISMATCH', lockTree === deps.lockfile_tree ? String(lockTree) : `manifest=${deps.lockfile_tree} recomputed=${lockTree ?? '<missing>'}`)
    add(verdicts, 'dependencies.package_json_tree', pkgTree === deps.package_json_tree ? 'PASS' : 'MISMATCH', pkgTree === deps.package_json_tree ? String(pkgTree) : `manifest=${deps.package_json_tree} recomputed=${pkgTree ?? '<missing>'}`)

    const hostDir = join(repo, HOST_TREE_REL)
    if (existsSync(hostDir) && existsSync(join(hostDir, '.git'))) {
      const hostHead = gitOrNull(hostDir, ['rev-parse', 'HEAD'])
      add(verdicts, 'dependencies.host_checkout', hostHead === deps.host_sha ? 'PASS' : 'MISMATCH', hostHead === deps.host_sha ? `${HOST_TREE_REL} HEAD=${hostHead}` : `checkout HEAD=${hostHead ?? '<unreadable>'} manifest=${deps.host_sha}`)
    } else {
      add(verdicts, 'dependencies.host_checkout', 'PASS', `${HOST_TREE_REL} is absent (gitignored); the pin is verified from tests/paths.mjs at the candidate commit, which is the single source of truth for it`)
    }
  }

  // ── ancestry (LIVE) ─────────────────────────────────────────────────────────
  const ancestry = manifest.ancestry
  if (!ancestry || typeof ancestry !== 'object') {
    add(verdicts, 'ancestry', 'MISSING', 'manifest has no ancestry block')
  } else {
    const masterRef = resolveMasterRef(repo) ?? ancestry.master_ref
    const candCheck = masterRef && candidateCommit ? git(repo, ['merge-base', '--is-ancestor', candidateCommit, masterRef]) : null
    if (!candCheck) add(verdicts, 'ancestry.candidate_is_ancestor_of_origin_master', 'UNVERIFIABLE', `no master ref (${JSON.stringify(masterRef)}) to test against`)
    else {
      const live = candCheck.status === 0
      const agrees = live === ancestry.candidate_is_ancestor_of_origin_master
      add(verdicts, 'ancestry.candidate_is_ancestor_of_origin_master', agrees ? 'PASS' : 'MISMATCH', agrees ? `live merge-base --is-ancestor ${candidateCommit} ${masterRef} => ${live} (exit ${candCheck.status})` : `manifest=${ancestry.candidate_is_ancestor_of_origin_master} live=${live} (${masterRef})`)
    }
    const prodSha = manifest.product?.sha
    const prodCheck = prodSha && candidateCommit ? git(repo, ['merge-base', '--is-ancestor', prodSha, candidateCommit]) : null
    if (!prodCheck) add(verdicts, 'ancestry.product_is_ancestor_of_candidate', 'UNVERIFIABLE', 'no product sha / candidate commit')
    else {
      const live = prodCheck.status === 0
      const agrees = live === ancestry.product_is_ancestor_of_candidate
      add(verdicts, 'ancestry.product_is_ancestor_of_candidate', agrees ? 'PASS' : 'MISMATCH', agrees ? `live merge-base --is-ancestor ${prodSha} ${candidateCommit} => ${live} (exit ${prodCheck.status})` : `manifest=${ancestry.product_is_ancestor_of_candidate} live=${live}`)
    }
  }

  // ── evidence ────────────────────────────────────────────────────────────────
  const cited = []
  const evidence = manifest.evidence
  if (evidence && typeof evidence === 'object') {
    if (evidence.run_record) cited.push({ path: evidence.run_record, ...(evidence.run_id ? { run_id: evidence.run_id } : {}) })
    if (Array.isArray(evidence.run_records)) {
      for (const entry of evidence.run_records) cited.push(typeof entry === 'string' ? { path: entry } : entry)
    }
  }
  for (const entry of extraRecords) cited.push(typeof entry === 'string' ? { path: entry } : entry)

  if (cited.length === 0) {
    add(verdicts, 'evidence.records', 'PASS', 'no run record is cited by the manifest and none was passed with --record; the evidence edge is vacuously satisfied and this is reported as such')
  } else {
    for (const entry of cited) {
      const r = verifyRecord(entry, repo, manifest)
      verdicts.push(r)
    }
  }

  return finish(manifest, verdicts)
}

function finish(manifest, verdicts) {
  const counts = Object.fromEntries(VERDICTS.map((v) => [v, 0]))
  for (const v of verdicts) counts[v.verdict] = (counts[v.verdict] ?? 0) + 1
  return {
    ok: verdicts.every((v) => v.verdict === 'PASS'),
    candidate_id: manifest?.candidate_id ?? null,
    candidate_commit: manifest?.candidate_commit ?? null,
    verdicts,
    counts,
  }
}

// ---------- CLI ----------

const USAGE = `verify-candidate — independent verification of a frozen-candidate manifest.

  node scripts/verify-candidate.mjs [--manifest <path>] [--root <dir>] \\
       [--record <run-record.json>]... [--json]

Every run record cited by the manifest, plus every --record path, is verified:
recordClass, candidateClaimEligibility, and candidateCommit/candidateSha against
the manifest. A record that claims candidate eligibility without a matching
commit is REFUSED (exit nonzero), never warned about.

exit: 0 all edges PASS, 1 any MISMATCH/MISSING/REFUSED/UNVERIFIABLE, 2 usage/read.`

function parseArgs(argv) {
  const opts = { root: process.cwd(), records: [], json: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${arg} requires a value`)
      i += 1
      return argv[i]
    }
    switch (arg) {
      case '--manifest': opts.manifest = next(); break
      case '--root': opts.root = next(); break
      case '--record': opts.records.push(next()); break
      case '--json': opts.json = true; break
      case '--help': case '-h': opts.help = true; break
      default: throw new Error(`unknown argument: ${arg}`)
    }
  }
  return opts
}

function main(argv) {
  let opts
  try { opts = parseArgs(argv) } catch (e) {
    process.stderr.write(`verify-candidate: ${e.message}\n\n${USAGE}\n`)
    return 2
  }
  if (opts.help) { process.stdout.write(`${USAGE}\n`); return 0 }

  const root = resolve(opts.root)
  const manifestPath = resolve(opts.manifest ?? join(root, 'dev/engineering/candidates/cand-v0.1.6-1.json'))
  if (!existsSync(manifestPath)) {
    process.stderr.write(`verify-candidate: manifest not found: ${manifestPath}\n`)
    return 2
  }
  let manifest
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) } catch (e) {
    process.stderr.write(`verify-candidate: manifest is not JSON: ${e.message}\n`)
    return 2
  }

  const result = verifyManifest({ root, manifest, extraRecords: opts.records })
  if (opts.json) {
    process.stdout.write(`${JSON.stringify({ manifest: manifestPath, ...result }, null, 2)}\n`)
  } else {
    process.stdout.write(`manifest ${manifestPath}\n`)
    for (const v of result.verdicts) process.stdout.write(`${v.verdict.padEnd(12)} ${v.edge}: ${v.detail}\n`)
    const counts = Object.entries(result.counts).filter(([, n]) => n > 0).map(([k, n]) => `${k}=${n}`).join(' ')
    process.stdout.write(`${result.ok ? 'VERIFIED' : 'REFUSED/DRIFT'} ${result.candidate_id} @ ${result.candidate_commit} — ${counts || 'no edges'}\n`)
  }
  return result.ok ? 0 : 1
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false
  try { return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url)) } catch { return false }
})()

if (invokedDirectly) process.exit(main(process.argv.slice(2)))
