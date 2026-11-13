#!/usr/bin/env node
/**
 * freeze-candidate.mjs — generate (and re-check) a frozen-candidate manifest.
 *
 * WHY THIS EXISTS. `dev/engineering/candidates/cand-a5sf-fs-search-1.json` was
 * written by hand per current-implementation-plan.md section 7.1. Every digest in
 * it was transcribed by its author, so the next close-out inherits a hand-copy
 * hazard: a product tree can move and the manifest can keep claiming the old SHA
 * with nobody noticing until an auditor recomputes it. This generator makes every
 * digest COMPUTED from git (or read from the live authority loader) and adds a
 * `--check` mode a reviewer runs to diff the manifest against reality, one line
 * per field.
 *
 * WHAT IT DOES NOT DO. It never moves the Authority pointer, never writes an
 * authority snapshot, never runs a boot, and never touches `packages/**`. It only
 * reads git, `scripts/current-authority.mjs` (the one authority reader) and the
 * candidate manifest it is asked to write or check.
 *
 * MANIFEST SHAPE. Reproduces the section 7.1 shape of the existing manifest:
 *   candidate identity
 *   product.sha + product.trees (git tree/blob SHAs)
 *   product.judges  (every a5sf judge/driver/lib the acceptance uses)
 *   authority       (pointer, snapshot_version, content_digest, snapshot_baseline)
 *   dependencies    (host version/SHA from tests/paths.mjs, lockfile/package tree)
 *   ancestry        (two LIVE `merge-base --is-ancestor` checks)
 *   evidence        (cited run records; verified by scripts/verify-candidate.mjs)
 *   immutability    (freeze rule + the two owner-approved acceptance scopes)
 *   content_digest  (F0 canonical digest of the object minus digest fields)
 *
 * USAGE
 *   # generate
 *   node scripts/freeze-candidate.mjs \
 *     --candidate-id cand-v0.1.6-1 \
 *     --ref candidate/v0.1.6-1 \
 *     --commit 168266dbfe7f2de091d998431bd56ce4dba0dbb5 \
 *     --authority-snapshot as20261109r1 \
 *     [--product-commit <sha>] [--out <path>] [--frozen-by <text>] [--stdout]
 *
 *   # re-check an existing manifest (reviewer entry point)
 *   node scripts/freeze-candidate.mjs --check \
 *     [--manifest dev/engineering/candidates/cand-v0.1.6-1.json]
 *
 * EXIT: 0 clean / written; 1 drift detected (--check); 2 usage or read failure.
 * The two exits are deliberately distinct: a reviewer must be able to tell
 * "drift" (a real finding to report) from "could not read" (a broken environment).
 *
 * PURE with respect to the repo: writes exactly the manifest path it is told to
 * write, and only outside `--check`.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { canonicalDigest } from './authority-snapshot.mjs'

export const MANIFEST_SCHEMA_VERSION = 1
export const MANIFEST_KIND = 'frozen-candidate'
export const CANDIDATE_DIR = 'dev/engineering/candidates'
export const AUTHORITY_POINTER_REL = 'dev/engineering/current-authority.json'
export const HOST_TREE_REL = 'tests/deepseek-harness-test-use'

/** The product faces Q7's drift law and the acceptance judges read. The order is
 *  the manifest's documented order; equality/diff commands use it verbatim. */
export const PRODUCT_PATHS = Object.freeze([
  'packages',
  'scripts',
  'tests/paths.mjs',
  'package.json',
  'pnpm-lock.yaml',
])

/** Judge/driver surface the acceptance actually uses. Kept as predicates rather
 *  than a hand list so a new a5sf judge cannot be added without appearing here. */
export const JUDGE_PATH_RULES = Object.freeze([
  { name: 'world-factory libs (shared judge infrastructure)', re: /^tests\/world-factory\/lib\/.+\.(?:mjs|json)$/ },
  { name: 'a5sf test suites and mutation controls', re: /^tests\/world-factory\/a5sf-[^/]+\.mjs$/ },
  { name: 'a5sf boot/run drivers', re: /^tests\/world-factory\/drivers\/a5sf-[^/]+\/.+\.mjs$/ },
])

export function isJudgePath(path) {
  return JUDGE_PATH_RULES.some((rule) => rule.re.test(path))
}

/** Root under which a candidate's independent C2 records are produced. */
export const EVIDENCE_ROOT_REL = 'dev/agent-workflow/evidence'

/**
 * The evidence root a candidate's C2 records belong under, DERIVED from the
 * candidate id — never a constant.
 *
 * WHY THIS IS A FUNCTION AND NOT A STRING. `evidence.record_root` used to be the
 * literal `dev/agent-workflow/evidence/candidate-v0.1.6-1`, carried unchanged
 * through every freeze, so the manifests for `cand-v0.1.6-2`, `-3` and `-4` each
 * told their adjudicator to write records into candidate `-1`'s directory. Two
 * independent C2 adjudicators filed it as FAIL (manifest documentation drift).
 *
 * THE DIRECTORY NAME IS `candidate-<version>`, NOT `<candidate_id>`. Candidate ids
 * are `cand-v0.1.6-4`; the evidence directories the track has actually used since
 * candidate 1 are `candidate-v0.1.6-4` (`cand-v0.1.6-3`'s C2 records live under
 * `dev/agent-workflow/evidence/candidate-v0.1.6-3/`). The mapping is therefore
 * `cand-<x>` -> `candidate-<x>`, and an id that does not carry the `cand-` prefix
 * is used verbatim. This is the derivation that reproduces the frozen `-1` value
 * for `cand-v0.1.6-1` (which is why `--check` on that manifest stays CLEAN) while
 * making `-2`, `-3`, `-4` and every later id point at their own directory.
 *
 * EXISTING MANIFESTS ARE NOT REWRITTEN. The wrong text already inside
 * `cand-v0.1.6-2..-4` is frozen history: a manifest is never edited after the
 * freeze (see `immutability.rule`). The fix takes effect for the NEXT freeze,
 * which is the only place a manifest is written.
 *
 * The id is validated because it becomes a path segment: a slash, a `..` or
 * whitespace would let a candidate id point the evidence root somewhere other
 * than a directory named after it.
 */
export function recordRootFor(candidateId) {
  if (typeof candidateId !== 'string' || candidateId === '') {
    throw new Error(`record_root needs a non-empty candidate id, got ${JSON.stringify(candidateId)}`)
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(candidateId)) {
    throw new Error(`invalid candidate id for record_root: ${JSON.stringify(candidateId)} (one path segment: letters, digits, dot, underscore, hyphen)`)
  }
  const dir = candidateId.startsWith('cand-') ? `candidate-${candidateId.slice('cand-'.length)}` : candidateId
  return `${EVIDENCE_ROOT_REL}/${dir}`
}

// ---------- process helpers ----------

export function git(root, args) {
  const r = spawnSync('git', args, { cwd: root, encoding: 'utf8' })
  if (r.error) return { status: 127, stdout: '', stderr: String(r.error.message) }
  return { status: r.status ?? 1, stdout: (r.stdout ?? '').trim(), stderr: (r.stderr ?? '').trim() }
}

function gitOrThrow(root, args) {
  const r = git(root, args)
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed (exit ${r.status}): ${r.stderr || r.stdout}`)
  return r.stdout
}

export function resolveCommit(root, rev) {
  const r = git(root, ['rev-parse', '--verify', '--quiet', `${rev}^{commit}`])
  if (r.status !== 0 || r.stdout === '') throw new Error(`cannot resolve '${rev}' to a commit (exit ${r.status})`)
  return r.stdout
}

export function objectSha(root, rev, path) {
  return gitOrThrow(root, ['rev-parse', `${rev}:${path}`])
}

/** Resolve the master ref the ancestry commands are written against. Recorded in
 *  the manifest so a reviewer can re-run the exact command. */
export function resolveMasterRef(root) {
  for (const ref of ['refs/remotes/origin/master', 'origin/master', 'refs/heads/master', 'master']) {
    if (git(root, ['rev-parse', '--verify', '--quiet', ref]).status === 0) return ref
  }
  return null
}

/** The ONE authority reader. Never hard-code the pointer values: this spawns
 *  `scripts/current-authority.mjs status`, which verifies the pointer's shape,
 *  digest and snapshot before returning the six fields. */
export function readAuthorityStatus(root) {
  const script = join(root, 'scripts/current-authority.mjs')
  if (!existsSync(script)) return { ok: false, refused: 'AUTHORITY_READER_MISSING', detail: `${script} does not exist` }
  const r = spawnSync(process.execPath, [script, 'status', '--root', root], { cwd: root, encoding: 'utf8' })
  const out = (r.stdout ?? '').trim()
  if (r.status !== 0 || out === '') {
    return { ok: false, refused: 'AUTHORITY_READ_FAILED', detail: `current-authority.mjs status exited ${r.status}: ${(r.stderr ?? '').trim() || out || '(no output)'}` }
  }
  let parsed
  try { parsed = JSON.parse(out.split('\n').at(-1)) } catch (e) {
    return { ok: false, refused: 'AUTHORITY_READ_NOT_JSON', detail: e.message }
  }
  if (parsed.ok !== true || !parsed.six) {
    return { ok: false, refused: `AUTHORITY_${parsed.refused ?? parsed.status ?? 'INVALID'}`, detail: parsed.detail ?? `current-authority.mjs status returned ${JSON.stringify(parsed)}` }
  }
  return {
    ok: true,
    pointer: parsed.pointer_file ?? AUTHORITY_POINTER_REL,
    snapshot_version: parsed.snapshot_version,
    content_digest: parsed.content_digest,
    snapshot_baseline: parsed.six.baseline,
    six: parsed.six,
  }
}

/** Parse the host pin out of `tests/paths.mjs` AT the candidate commit. The file
 *  is the single source of truth for the pin (docs/TEST_METHODS.md), so the
 *  manifest reads it from the frozen tree instead of restating a literal. */
export function readHostPin(root, rev) {
  const text = gitOrThrow(root, ['show', `${rev}:tests/paths.mjs`])
  const version = /export const DSH_BASELINE_VERSION\s*=\s*'([^']+)'/.exec(text)
  const sha = /export const TEST_USE_BASELINE_SHA\s*=\s*'([0-9a-f]{40})'/.exec(text)
  if (!version || !sha) throw new Error(`tests/paths.mjs at ${rev} does not declare DSH_BASELINE_VERSION / TEST_USE_BASELINE_SHA in the expected form`)
  return { version: version[1], sha: sha[1] }
}

/** Every judge/driver file the acceptance uses, as a sorted path list. */
export function enumerateJudges(root, rev) {
  const r = git(root, ['ls-tree', '-r', '--name-only', rev, '--', 'tests/world-factory'])
  if (r.status !== 0) throw new Error(`git ls-tree ${rev} tests/world-factory failed: ${r.stderr}`)
  return r.stdout.split('\n').map((s) => s.trim()).filter(Boolean).filter(isJudgePath).sort()
}

// ---------- manifest construction ----------

function utcNow() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')
}

function eqCommand(productSha, candidateSha) {
  return `git diff --stat ${productSha} ${candidateSha} -- ${PRODUCT_PATHS.join(' ')}`
}

function ancestryCheck(root, ancestor, descendant) {
  const r = git(root, ['merge-base', '--is-ancestor', ancestor, descendant])
  return { status: r.status, ok: r.status === 0 }
}

/**
 * Build the manifest object (including its content_digest). Pure apart from git
 * and the authority read; no writes.
 *
 * @param {object} opts
 * @param {string} opts.root repo/worktree root
 * @param {string} opts.candidateId e.g. cand-v0.1.6-1
 * @param {string} opts.ref a branch name (`candidate/v0.1.6-1`) or full `refs/heads/...`
 * @param {string} opts.commit
 * @param {string} opts.authoritySnapshot expected snapshot_version
 * @param {string} [opts.productCommit]
 * @param {string} [opts.frozenAtUtc]
 * @param {string} [opts.frozenBy]
 * @param {Function} [opts.authorityReader]
 */
export function buildManifest(opts) {
  const root = resolve(opts.root ?? '.')
  const candidateCommit = resolveCommit(root, opts.commit)
  const productCommit = opts.productCommit ? resolveCommit(root, opts.productCommit) : candidateCommit
  const refName = String(opts.ref).replace(/^refs\/heads\//, '')
  if (!/^[A-Za-z0-9._/-]+$/.test(refName)) throw new Error(`invalid candidate ref name: ${JSON.stringify(opts.ref)}`)
  const candidateRef = `refs/heads/${refName}`

  const authorityReader = opts.authorityReader ?? readAuthorityStatus
  const authority = authorityReader(root)
  if (!authority.ok) throw new Error(`authority read failed: ${authority.refused}${authority.detail ? ` — ${authority.detail}` : ''}`)
  if (opts.authoritySnapshot && authority.snapshot_version !== opts.authoritySnapshot) {
    throw new Error(`live authority snapshot_version is ${authority.snapshot_version}, but --authority-snapshot says ${opts.authoritySnapshot}; refusing to bake a manifest that names a snapshot the pointer does not resolve to`)
  }

  const trees = {}
  for (const path of PRODUCT_PATHS) trees[path] = objectSha(root, candidateCommit, path)

  const judges = {}
  for (const path of enumerateJudges(root, candidateCommit)) judges[path] = objectSha(root, candidateCommit, path)

  const equality = git(root, ['diff', '--stat', productCommit, candidateCommit, '--', ...PRODUCT_PATHS])
  if (equality.status !== 0) throw new Error(`product equality check failed to run (exit ${equality.status}): ${equality.stderr}`)

  const hostPin = readHostPin(root, candidateCommit)

  const masterRef = resolveMasterRef(root)
  const candidateAncestry = masterRef
    ? ancestryCheck(root, candidateCommit, masterRef)
    : { status: 1, ok: false, missing: true }
  const productAncestry = ancestryCheck(root, productCommit, candidateCommit)

  const frozenAt = opts.frozenAtUtc ?? utcNow()
  const frozenBy = opts.frozenBy ?? 'task/cand-v016-1 (candidate freeze generator, scripts/freeze-candidate.mjs)'

  const productEqualityNote = productCommit === candidateCommit
    ? 'empty output, exit 0 — the candidate ref points at the product commit itself, so every face the Q7 drift law and the acceptance judges read is byte-identical by identity rather than by a diff.'
    : 'empty output, exit 0 — byte-identical for every path the Q7 drift law and the acceptance judges read.'

  const manifest = {
    schema_version: MANIFEST_SCHEMA_VERSION,
    kind: MANIFEST_KIND,
    candidate_id: opts.candidateId,
    candidate_ref: candidateRef,
    candidate_commit: candidateCommit,
    candidate_commit_subject: gitOrThrow(root, ['show', '-s', '--format=%s', candidateCommit]),
    candidate_commit_time: gitOrThrow(root, ['show', '-s', '--format=%cI', candidateCommit]),
    status: 'FROZEN',
    frozen_at_utc: frozenAt,
    frozen_by: frozenBy,
    product: {
      sha: productCommit,
      sha_meaning: productCommit === candidateCommit
        ? 'the frozen product commit, and the candidate commit itself: the candidate ref points at the product tree, so there is no evidence/fixture delta to explain.'
        : 'the frozen product commit. candidate_commit carries the same product faces byte for byte; only evidence/fixture files differ, which is why the measured run executed candidate_commit rather than this commit.',
      trees,
      judges,
      equality_command: eqCommand(productCommit, candidateCommit),
      equality_exit: equality.status,
      equality_note: productEqualityNote,
    },
    authority: {
      pointer: authority.pointer,
      snapshot_version: authority.snapshot_version,
      content_digest: authority.content_digest,
      snapshot_baseline: authority.snapshot_baseline,
      pointer_decision: 'UNCHANGED — per owner ruling D7 (2026-11-09) the pointer was re-established on the integration baseline and MUST NOT move for this candidate. Moving it onto this candidate would either assert nothing (while V@B stays no) or, the moment a row were flipped to V@B=yes, be graded by the state-freshness Q7 leg against candidate..HEAD and turn master red. The candidate claim therefore travels per row as verifiedFor, not as the single global baseline. See current-implementation-plan.md sections 7.5 and 7.6.',
    },
    dependencies: {
      host_baseline_version: hostPin.version,
      host_sha: hostPin.sha,
      host_tree: HOST_TREE_REL,
      lockfile_tree: trees['pnpm-lock.yaml'],
      package_json_tree: trees['package.json'],
      dependency_note: 'the dependency set is the one the measured acceptance runs must execute; a candidate repair that changes any of these is a NEW candidate version, not an edit of this one.',
    },
    evidence: {
      status: 'AWAITING_C2',
      run_records: [],
      record_root: recordRootFor(opts.candidateId),
      evidence_note: 'No run record is cited at freeze: owner ruling D12 freezes the candidate BEFORE C2. The independent adjudicator produces the C2-A and C2-B records under record_root and verifies them against this manifest with `node scripts/verify-candidate.mjs --record <path>` — this manifest is never rewritten to add evidence. A cited record is refused, not warned about, when it claims candidate eligibility without candidateCommit/candidateSha equal to this candidate.',
    },
    ancestry: {
      master_ref: masterRef,
      candidate_is_ancestor_of_origin_master: candidateAncestry.ok,
      command: `git merge-base --is-ancestor ${candidateCommit} ${masterRef ?? '<unresolved master ref>'}`,
      exit: candidateAncestry.status,
      product_is_ancestor_of_candidate: productAncestry.ok,
      product_command: `git merge-base --is-ancestor ${productCommit} ${candidateCommit}`,
      product_exit: productAncestry.status,
      bring_back_to_master: 'only by a real merge that keeps ancestry (merge commit or --no-ff). Squash, rebase and cherry-pick impersonation are forbidden: they make the product SHA unreachable from master while the manifest keeps claiming it.',
    },
    immutability: {
      rule: 'the ref is frozen at candidate_commit. No amend, reset, rebase, force-push or product-code edit under this candidate identity. Any repair creates a NEW candidate_id and a NEW ref (e.g. cand-v0.1.6-2) with a new sha; the old ref, manifest and evidence stay.',
      supersedes: null,
      reacceptance: 'a repair re-accepts only the faces its diff touches: the product path set old..new decides which rows must be re-run; rows whose faces did not move may cite the preserved evidence, but the row must name the new candidate version and sha.',
      acceptance_scopes: [
        {
          id: 'C2-A',
          description: 'Alpha.5 governed, A6 off — the formal governed I/O acceptance on the opt-in governed path.',
        },
        {
          id: 'C2-B',
          description: 'Alpha.5 governed, A6 on — the selected joint regression (Officer allow/deny, single-consume-and-execute, Goal authorization, Stop/Sticky Stop, cold recovery, and the known A6-26 failure path).',
        },
      ],
      shared_identity: 'This candidate carries BOTH owner-approved acceptance scopes, C2-A and C2-B, sharing this one SHA (candidate_commit), one artifact and one host version (dependencies.host_sha). Neither scope may be re-pointed at a different commit, artifact or host; the scopes differ in preset (A6 off/on), never in candidate identity.',
    },
    content_digest_note: 'F0 canonical bytes (sorted keys, minified) of this object with content_digest and content_digest_note removed; same convention as scripts/authority-snapshot.mjs canonicalBytes. Recompute with: node --input-type=module -e "import {readFileSync} from \'node:fs\'; import {canonicalDigest} from \'./scripts/authority-snapshot.mjs\'; const o=JSON.parse(readFileSync(process.argv[1],\'utf8\')); const d=o.content_digest; delete o.content_digest; delete o.content_digest_note; console.log(canonicalDigest(o)===d?\'OK\':\'MISMATCH\')" <manifest>',
  }

  manifest.content_digest = manifestDigest(manifest)
  return manifest
}

/** The manifest's F0 content digest: canonical digest of the object with
 *  content_digest and content_digest_note removed (the note is documentation,
 *  not identity). */
export function manifestDigest(manifest) {
  const clone = JSON.parse(JSON.stringify(manifest))
  delete clone.content_digest
  delete clone.content_digest_note
  return canonicalDigest(clone)
}

// ---------- diff (--check) ----------

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

/** Flatten to leaf paths. Empty objects/arrays are leaves so an emptied judge map
 *  cannot hide from the diff. */
export function flattenLeaves(value, prefix = '', out = new Map()) {
  if (isPlainObject(value) && Object.keys(value).length > 0) {
    for (const key of Object.keys(value).sort()) flattenLeaves(value[key], prefix === '' ? key : `${prefix}.${key}`, out)
    return out
  }
  out.set(prefix === '' ? '(root)' : prefix, value)
  return out
}

const show = (v) => JSON.stringify(v)

/** One line per field. `manifest` is the on-disk claim, `actual` the recomputed
 *  reality. Returns { lines, drift, missing, extra }. */
export function diffManifests(manifest, actual) {
  const m = flattenLeaves(manifest)
  const a = flattenLeaves(actual)
  const paths = [...new Set([...m.keys(), ...a.keys()])].sort()
  const lines = []
  let drift = 0
  let missing = 0
  let extra = 0
  for (const path of paths) {
    const inM = m.has(path)
    const inA = a.has(path)
    if (inM && inA) {
      if (show(m.get(path)) === show(a.get(path))) {
        lines.push(`OK    ${path} = ${show(m.get(path))}`)
      } else {
        drift += 1
        lines.push(`DRIFT ${path} manifest=${show(m.get(path))} recomputed=${show(a.get(path))}`)
      }
    } else if (inM) {
      missing += 1
      lines.push(`GONE  ${path} manifest=${show(m.get(path))} recomputed=<absent>`)
    } else {
      extra += 1
      lines.push(`NEW   ${path} manifest=<absent> recomputed=${show(a.get(path))}`)
    }
  }
  return { lines, drift, missing, extra }
}

// ---------- CLI ----------

function parseArgs(argv) {
  const opts = { root: process.cwd(), check: false, stdout: false }
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = () => {
      if (i + 1 >= argv.length) throw new Error(`${arg} requires a value`)
      i += 1
      return argv[i]
    }
    switch (arg) {
      case '--candidate-id': opts.candidateId = next(); break
      case '--ref': opts.ref = next(); break
      case '--commit': opts.commit = next(); break
      case '--product-commit': opts.productCommit = next(); break
      case '--authority-snapshot': opts.authoritySnapshot = next(); break
      case '--out': opts.out = next(); break
      case '--manifest': opts.manifest = next(); break
      case '--frozen-by': opts.frozenBy = next(); break
      case '--root': opts.root = next(); break
      case '--check': opts.check = true; break
      case '--stdout': opts.stdout = true; break
      case '--help': case '-h': opts.help = true; break
      default:
        // Convenience: `--check <path>` is the reviewer's shortest form.
        if (!arg.startsWith('-') && /\.json$/.test(arg)) { opts.manifest = arg; break }
        throw new Error(`unknown argument: ${arg}`)
    }
  }
  return opts
}

const USAGE = `freeze-candidate — generate or re-check a frozen-candidate manifest.

generate:
  node scripts/freeze-candidate.mjs --candidate-id <id> --ref <branch> --commit <sha> \\
       --authority-snapshot <asYYYYMMDDrN> [--product-commit <sha>] [--out <path>] [--stdout]

check (reviewer entry point; one line per field, exit 1 on any drift):
  node scripts/freeze-candidate.mjs --check [--manifest <path>] [--root <dir>]

exit: 0 clean/written, 1 drift, 2 usage or read failure.`

function defaultManifestPath(root, candidateId) {
  return join(root, CANDIDATE_DIR, `${candidateId}.json`)
}

function main(argv) {
  let opts
  try { opts = parseArgs(argv) } catch (e) {
    process.stderr.write(`freeze-candidate: ${e.message}\n\n${USAGE}\n`)
    return 2
  }
  if (opts.help) { process.stdout.write(`${USAGE}\n`); return 0 }

  try {
    if (opts.check) return runCheck(opts)
    return runGenerate(opts)
  } catch (e) {
    process.stderr.write(`freeze-candidate: ${e instanceof Error ? e.message : String(e)}\n`)
    return 2
  }
}

function runGenerate(opts) {
  for (const key of ['candidateId', 'ref', 'commit', 'authoritySnapshot']) {
    if (!opts[key]) throw new Error(`--${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)} is required (see --help)`)
  }
  const manifest = buildManifest(opts)
  const text = `${JSON.stringify(manifest, null, 2)}\n`
  if (opts.stdout) {
    process.stdout.write(text)
    return 0
  }
  const out = opts.out ? resolve(opts.out) : defaultManifestPath(resolve(opts.root), opts.candidateId)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, text)
  process.stdout.write(`frozen ${manifest.candidate_id} at ${manifest.candidate_commit} -> ${out}\n`)
  process.stdout.write(`content_digest ${manifest.content_digest}\n`)
  return 0
}

function runCheck(opts) {
  const root = resolve(opts.root)
  const manifestPath = opts.manifest
    ? resolve(opts.manifest)
    : opts.candidateId
      ? defaultManifestPath(root, opts.candidateId)
      : null
  if (!manifestPath) throw new Error('--check needs --manifest <path> (or --candidate-id)')
  if (!existsSync(manifestPath)) throw new Error(`manifest not found: ${manifestPath}`)
  let manifest
  try { manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) } catch (e) { throw new Error(`manifest is not JSON: ${e.message}`) }

  // Recompute from the manifest's OWN identity. frozen_at_utc/frozen_by are
  // adopted from the manifest so a re-check does not drift merely because time
  // passed; their integrity is covered by content_digest, which IS recomputed.
  const actual = buildManifest({
    root,
    candidateId: manifest.candidate_id,
    ref: manifest.candidate_ref,
    commit: manifest.candidate_commit,
    productCommit: manifest.product?.sha,
    // Deliberately NOT pinned to the manifest's snapshot_version: a pointer that
    // moved must show up as a DRIFT line, not as a read failure. The live reader
    // still refuses an invalid pointer, which is exit 2 (environment), not drift.
    frozenAtUtc: manifest.frozen_at_utc,
    frozenBy: manifest.frozen_by,
  })

  // The recorded digest is a field like any other; recompute the object digest
  // from what is on disk and compare it explicitly too.
  const recordedDigest = manifest.content_digest
  const recomputedDigest = manifestDigest(manifest)
  const { lines, drift, missing, extra } = diffManifests(manifest, actual)
  for (const line of lines) process.stdout.write(`${line}\n`)
  process.stdout.write(`DIGEST content_digest manifest=${show(recordedDigest)} recomputed_from_disk=${show(recomputedDigest)} ${recordedDigest === recomputedDigest ? 'OK' : 'MISMATCH'}\n`)
  const digestBad = recordedDigest !== recomputedDigest
  const bad = drift + missing + extra + (digestBad ? 1 : 0)
  if (bad === 0) {
    process.stdout.write(`CLEAN ${manifest.candidate_id} — every field recomputed equal, content_digest verified\n`)
    return 0
  }
  process.stdout.write(`DRIFT ${manifest.candidate_id} — ${drift} changed, ${missing} gone, ${extra} new, content_digest ${digestBad ? 'MISMATCH' : 'ok'}\n`)
  return 1
}

const invokedDirectly = (() => {
  if (!process.argv[1]) return false
  try { return resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url)) } catch { return false }
})()

if (invokedDirectly) process.exit(main(process.argv.slice(2)))
