#!/usr/bin/env node
/**
 * census-build-stamp.mjs — TINF M5: the PRODUCT BUILD IDENTITY the census plan refuses to invent.
 *
 * WHY THIS FILE EXISTS. M4's aggregator refuses to PASS a plan whose `build_digest` is null, and
 * that refusal is correct: "equality of two unrecorded values is not a build identity" (spec §2
 * lists the build digest as part of the census identity, TINF-13/16). M4 could not satisfy it
 * because no producer existed — its memo says so in the "a real plan and real shards would refuse
 * today" list. M5's job is the cutover, and the cutover cannot begin with a placeholder, so this
 * file produces a REAL digest of REAL BYTES: the two install surfaces this repository already
 * commits and already gates (`INSTALL_SURFACES` in `scripts/client-composition-surface.mjs`, the
 * same list `check-artifacts-committed.mjs` and the composition smoke compare against).
 *
 * WHAT IS DIGESTED, EXACTLY.
 *   payload = {schema, merge_tree, catalog_digest, surfaces, artifacts:[{path, bytes, sha256}]}
 *   digest  = sha256 over the CANONICAL JSON of that payload
 * with `artifacts` sorted by path and SHA-256 computed over each file's real bytes. The canonical
 * JSON + sha256 helper is `digestJson()` from `scripts/census-plan.mjs` — the SAME function M4's
 * planner and aggregator use for `plan_digest`, so the census cannot grow a second digest format.
 * (`scripts/census-digest.mjs` owns the *shape* rule `sha256:<64 hex> | <40 hex>`, and this file's
 * outputs are validated against it; it has no hashing function of its own, and adding one there
 * would have been the second format.)
 * `built_at` is recorded but NOT digested: a timestamp cannot be re-derived from the artifacts, and
 * a digest that changes when nothing was built is not an identity.
 *
 * WHAT IT PROVES / DOES NOT PROVE.
 *   proves : the bytes on the two install surfaces, at `merge_tree`, under `catalog_digest`, are
 *            exactly the bytes whose hash this stamp carries. Change one byte and the stamp is
 *            stale (`BUILD_STAMP_DIGEST_MISMATCH` when re-verified).
 *   does not prove : that a build RAN in this checkout. The surfaces are committed artifacts, so a
 *            fresh clone already has them; `check-artifacts-committed.mjs` is what asks whether the
 *            committed bytes are what a fresh build produces, and it runs as the last step of
 *            `pnpm build:composition` in every census job before this stamp is made. The producer
 *            refuses an absent or empty surface (`BUILD_ARTIFACTS_MISSING` / `_EMPTY`), so a
 *            checkout that never received the artifacts cannot stamp a placeholder.
 *
 * NO PLACEHOLDER IS EVER WRITTEN. Every failure path returns a named `{ok:false, code, detail}` and
 * writes nothing; the census leg turns that into a RED census (`BUILD_*`), never into a fallback.
 *
 * USAGE
 *   node scripts/census-build-stamp.mjs --write [--out FILE] [--merge-tree SHA] [--catalog-digest D]
 *   node scripts/census-build-stamp.mjs --print
 *   node scripts/census-build-stamp.mjs --verify FILE [--merge-tree SHA] [--catalog-digest D]
 *
 * Exit: 0 ok | 2 REFUSED (named code on stderr; no stamp is written).
 *
 * @module scripts/census-build-stamp
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

import { INSTALL_SURFACES } from './client-composition-surface.mjs'
import { digestJson, gitTreeSha } from './census-plan.mjs'
import { DIGEST_SHAPE, isValidDigest } from './census-digest.mjs'
// The catalog is the collection authority; the stamp records ITS digest rather than a second
// enumeration of the same files (M1 owns the population, M5 only binds to it).
import { digestOf as catalogDigestOf, gather as gatherCatalog } from './test-catalog.mjs'

export const SCHEMA = 'census-build-stamp/1'
/** One home for the surface list: the module the build writes and the smoke checks. */
export const SURFACES = INSTALL_SURFACES
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/

function refused(code, detail) {
  return { ok: false, code, detail }
}

/** Every regular file under the surfaces, `/`-separated, sorted. Throws on a missing surface. */
export function listSurfaceFiles({ cwd = process.cwd(), surfaces = SURFACES } = {}) {
  const out = []
  const walk = (rel) => {
    for (const e of readdirSync(join(cwd, rel), { withFileTypes: true })) {
      const child = `${rel}/${e.name}`
      if (e.isDirectory()) walk(child)
      else if (e.isFile()) out.push(child.split(sep).join('/'))
    }
  }
  for (const surface of surfaces) {
    const abs = join(cwd, surface)
    if (!existsSync(abs) || !statSync(abs).isDirectory()) {
      throw Object.assign(
        new Error(`install surface ${surface} is absent (or not a directory) — a build identity cannot be made from nothing`),
        { code: 'BUILD_ARTIFACTS_MISSING' },
      )
    }
    walk(surface)
  }
  return out.sort()
}

/**
 * Files git ignores under the surfaces (e.g. `*.tsbuildinfo`). Same filter
 * `check-artifacts-committed.mjs` applies, so the two tools agree about which files are artifacts.
 * Injected in tests; a git failure refuses rather than silently including ignored files.
 */
export function ignoredSurfaceFiles({ cwd = process.cwd(), surfaces = SURFACES } = {}) {
  const r = spawnSync('git', ['ls-files', '--ignored', '--exclude-standard', '-o', '--', ...surfaces], {
    cwd,
    encoding: 'utf8',
  })
  if (r.status !== 0) {
    throw Object.assign(new Error(`git ls-files failed in ${cwd}: ${String(r.stderr ?? '').trim() || `exit ${String(r.status)}`}`), {
      code: 'GIT_READ_FAILED',
    })
  }
  return new Set(r.stdout.split('\n').map((s) => s.trim()).filter(Boolean))
}

/**
 * Build the stamp object in memory. Pure apart from reading the surface bytes.
 *
 * @param {object} p
 * @param {string} p.merge_tree      tree id of the commit whose build this is
 * @param {string} p.catalog_digest  the collection authority's digest at that tree
 * @param {string} [p.cwd]
 * @param {string} [p.built_at]      ISO stamp (default: now); recorded, not digested
 * @param {string[]} [p.surfaces]
 * @param {Set<string>|string[]} [p.ignoredFiles]  default: the git ignore query
 * @returns {{ok:true, stamp:object} | {ok:false, code:string, detail:string}}
 */
export function computeBuildStamp({
  cwd = process.cwd(),
  merge_tree,
  catalog_digest,
  built_at = new Date().toISOString(),
  surfaces = SURFACES,
  ignoredFiles = null,
  readFile = readFileSync,
} = {}) {
  for (const [field, value] of [['merge_tree', merge_tree], ['catalog_digest', catalog_digest]]) {
    if (!isValidDigest(value)) {
      return refused('DIGEST_INVALID', `${field}=${JSON.stringify(value)} is not a digest (${DIGEST_SHAPE})`)
    }
  }
  if (typeof built_at !== 'string' || !ISO_RE.test(built_at)) {
    return refused('BUILD_STAMP_CLOCK_INVALID', `built_at=${JSON.stringify(built_at)} is not an ISO-8601 UTC stamp`)
  }
  let all
  try {
    all = listSurfaceFiles({ cwd, surfaces })
  } catch (e) {
    return refused(e.code ?? 'BUILD_ARTIFACTS_MISSING', String(e.message ?? e))
  }
  let ignored
  try {
    ignored = ignoredFiles === null
      ? ignoredSurfaceFiles({ cwd, surfaces })
      : new Set(ignoredFiles)
  } catch (e) {
    return refused(e.code ?? 'GIT_READ_FAILED', String(e.message ?? e))
  }
  const files = all.filter((f) => !ignored.has(f))
  if (files.length === 0) {
    return refused(
      'BUILD_ARTIFACTS_EMPTY',
      `the install surfaces (${surfaces.join(', ')}) contained 0 files after the git-ignore filter ` +
        `(${String(all.length)} on disk) — an empty artifact set is not a build identity`,
    )
  }
  const artifacts = []
  let totalBytes = 0
  for (const rel of files) {
    const bytes = readFile(join(cwd, rel))
    const buffer = Buffer.isBuffer(bytes) ? bytes : Buffer.from(String(bytes))
    totalBytes += buffer.byteLength
    artifacts.push({ path: rel, bytes: buffer.byteLength, sha256: `sha256:${createHash('sha256').update(buffer).digest('hex')}` })
  }
  const payload = { schema: SCHEMA, merge_tree, catalog_digest, surfaces: [...surfaces].sort(), artifacts }
  return {
    ok: true,
    stamp: {
      schema: SCHEMA,
      merge_tree,
      catalog_digest,
      built_at,
      digest: digestJson(payload),
      source: 'install-surfaces',
      surfaces: [...surfaces].sort(),
      artifact_count: artifacts.length,
      artifact_bytes: totalBytes,
      artifacts,
    },
  }
}

/** The digest payload of an existing stamp — used by verify so tampering is detectable. */
export function stampPayload(stamp) {
  return {
    schema: stamp?.schema,
    merge_tree: stamp?.merge_tree,
    catalog_digest: stamp?.catalog_digest,
    surfaces: Array.isArray(stamp?.surfaces) ? stamp.surfaces : [],
    artifacts: Array.isArray(stamp?.artifacts) ? stamp.artifacts : [],
  }
}

/**
 * Verify a parsed stamp: schema, field shapes, and that `digest` is the digest of the stamp's OWN
 * payload. Optionally bind it to an expected merge tree / catalog digest.
 */
/**
 * Re-hash the CURRENT install surface and refuse a stamp that no longer describes it.
 *
 * WHY THIS IS NOT OPTIONAL FOR A RECORDED STAMP. `verifyBuildStamp` checks that the stamp is
 * internally consistent: its own artifact list digests to its own `digest`. A stamp copied from an
 * earlier run on the SAME tree is therefore perfectly self-consistent — and stale, because the bytes
 * under the surfaces may have been rebuilt, half-written or reverted since. This function is the
 * only thing that can tell the difference, so the census leg calls it on every recorded stamp:
 * a current surface that cannot be hashed at all refuses too (trusting an unverifiable stamp is how
 * a placeholder gets in through the side door).
 */
export function staleAgainstCurrent(stamp, { cwd, surfaces = SURFACES, ignoredFiles = null, readFile = readFileSync } = {}) {
  if (typeof cwd !== 'string' || cwd === '') {
    return refused('BUILD_STAMP_UNVERIFIABLE', 'no checkout was given, so the recorded surface cannot be re-hashed')
  }
  const now = computeBuildStamp({ cwd, merge_tree: stamp.merge_tree, catalog_digest: stamp.catalog_digest, surfaces, ignoredFiles, readFile })
  if (!now.ok) {
    return refused(
      'BUILD_STAMP_UNVERIFIABLE',
      `${now.code}: the current install surface cannot be re-hashed (${String(now.detail)}) — a recorded ` +
        'stamp is refused rather than trusted when there is nothing to check it against',
    )
  }
  if (now.stamp.digest === stamp.digest) return { ok: true, stamp: now.stamp }
  const recorded = new Map(stamp.artifacts.map((a) => [a.path, a]))
  const current = new Map(now.stamp.artifacts.map((a) => [a.path, a]))
  const differs = []
  for (const [path, a] of recorded) {
    const b = current.get(path)
    if (b === undefined) differs.push(`${path} (missing now)`)
    else if (b.sha256 !== a.sha256 || b.bytes !== a.bytes) differs.push(`${path} (bytes changed)`)
  }
  for (const path of current.keys()) if (!recorded.has(path)) differs.push(`${path} (new since the stamp)`)
  return refused(
    'BUILD_STAMP_STALE',
    `the stamp records digest=${String(stamp.digest)} but the CURRENT surface digests to ${String(now.stamp.digest)}; ` +
      `differing artifacts: ${differs.slice(0, 6).join(', ')}${differs.length > 6 ? ` (+${String(differs.length - 6)} more)` : ''} — ` +
      'a self-consistent stamp for another moment is not this build',
  )
}

export function verifyBuildStamp(stamp, { merge_tree = null, catalog_digest = null, cwd = null, surfaces = SURFACES, ignoredFiles = null } = {}) {
  if (!stamp || typeof stamp !== 'object' || Array.isArray(stamp)) {
    return refused('BUILD_STAMP_MALFORMED', 'the stamp is not an object')
  }
  if (stamp.schema !== SCHEMA) {
    return refused('BUILD_STAMP_SCHEMA_UNKNOWN', `schema must be ${SCHEMA}, got ${String(stamp.schema)}`)
  }
  if (!isValidDigest(stamp.merge_tree)) {
    return refused('DIGEST_INVALID', `merge_tree=${JSON.stringify(stamp.merge_tree)} is not a digest (${DIGEST_SHAPE})`)
  }
  if (!isValidDigest(stamp.catalog_digest)) {
    return refused('DIGEST_INVALID', `catalog_digest=${JSON.stringify(stamp.catalog_digest)} is not a digest (${DIGEST_SHAPE})`)
  }
  if (!isValidDigest(stamp.digest)) {
    return refused('DIGEST_INVALID', `digest=${JSON.stringify(stamp.digest)} is not a digest (${DIGEST_SHAPE})`)
  }
  if (typeof stamp.built_at !== 'string' || !ISO_RE.test(stamp.built_at)) {
    return refused('BUILD_STAMP_CLOCK_INVALID', `built_at=${JSON.stringify(stamp.built_at)} is not an ISO-8601 UTC stamp`)
  }
  if (!Array.isArray(stamp.artifacts) || stamp.artifacts.length === 0) {
    return refused('BUILD_STAMP_MALFORMED', 'artifacts must be a non-empty array (an empty list is not a build)')
  }
  if (!Number.isInteger(stamp.artifact_count) || stamp.artifact_count !== stamp.artifacts.length) {
    return refused('BUILD_STAMP_MALFORMED', `artifact_count=${String(stamp.artifact_count)} disagrees with artifacts.length=${String(stamp.artifacts.length)}`)
  }
  for (const a of stamp.artifacts) {
    if (!a || typeof a.path !== 'string' || a.path === '' || !Number.isInteger(a.bytes) || a.bytes < 0 || !isValidDigest(a.sha256)) {
      return refused(
        'BUILD_STAMP_MALFORMED',
        `artifact ${JSON.stringify(a && a.path)} is not {path: <non-empty>, bytes: <integer >= 0>, sha256: <digest>}`,
      )
    }
  }
  const recomputed = digestJson(stampPayload(stamp))
  if (recomputed !== stamp.digest) {
    return refused(
      'BUILD_STAMP_DIGEST_MISMATCH',
      `stamp.digest=${stamp.digest} but its own recorded artifacts digest to ${recomputed} — the stamp was ` +
        'edited after it was signed (or an artifact was rewritten under a stale stamp)',
    )
  }
  // The stale check runs AFTER the internal checks: a stamp that is not internally consistent has a
  // more precise code than BUILD_STAMP_STALE, and a reader should see that one.
  if (cwd !== null) {
    const fresh = staleAgainstCurrent(stamp, { cwd, surfaces, ignoredFiles })
    if (!fresh.ok) return fresh
  }
  if (merge_tree !== null && merge_tree !== stamp.merge_tree) {
    return refused(
      'BUILD_STAMP_IDENTITY_MISMATCH',
      `the stamp records merge_tree=${stamp.merge_tree} but this tree is ${String(merge_tree)} — a build ` +
        'stamp from another tree is not this census build',
    )
  }
  if (catalog_digest !== null && catalog_digest !== stamp.catalog_digest) {
    return refused(
      'BUILD_STAMP_IDENTITY_MISMATCH',
      `the stamp records catalog_digest=${stamp.catalog_digest} but this catalog is ${String(catalog_digest)}`,
    )
  }
  return { ok: true, stamp }
}

/** Read + verify one stamp file. Absence is `BUILD_STAMP_MISSING`, never a computed substitute. */
export function readBuildStamp(file, { readFile = readFileSync, ...expected } = {}) {
  let text
  try {
    text = readFile(resolve(file))
  } catch (e) {
    return refused(
      'BUILD_STAMP_MISSING',
      `${file} could not be read (${String(e && e.message ? e.message : e)}) — a census with no recorded ` +
        'build identity refuses instead of inventing one',
    )
  }
  let json
  try {
    json = JSON.parse(String(text))
  } catch (e) {
    return refused('BUILD_STAMP_UNREADABLE', `${file}: ${String(e && e.message ? e.message : e)}`)
  }
  const verified = verifyBuildStamp(json, expected)
  return verified.ok ? { ...verified, text: String(text) } : verified
}

/**
 * The plan-side resolver: an explicitly named stamp is READ AND VERIFIED (absence refuses); with no
 * file named, a stamp is COMPUTED from the real surfaces and written to `out`. There is no third
 * path and no placeholder — a build that did not happen makes this refuse.
 *
 * @returns {{ok:true, stamp:object, text:string, path:string|null, mode:'recorded'|'computed'} |
 *           {ok:false, code:string, detail:string}}
 */
export function resolveBuildStamp({
  cwd = process.cwd(),
  merge_tree,
  catalog_digest,
  stampPath = null,
  outPath = null,
  built_at,
  surfaces = SURFACES,
  ignoredFiles = null,
  readFile = readFileSync,
  writeFile = writeFileSync,
} = {}) {
  if (stampPath !== null) {
    // `cwd` is always present here, so a recorded stamp is re-hashed against the current surface:
    // `--census-build-stamp <file>` names a build, it does not outrank the bytes on disk.
    const read = readBuildStamp(stampPath, { readFile, merge_tree, catalog_digest, cwd, surfaces, ignoredFiles })
    if (!read.ok) return read
    return { ok: true, stamp: read.stamp, text: read.text, path: resolve(stampPath), mode: 'recorded' }
  }
  const made = computeBuildStamp({ cwd, merge_tree, catalog_digest, built_at, surfaces, ignoredFiles, readFile })
  if (!made.ok) return made
  const text = `${JSON.stringify(made.stamp, null, 2)}\n`
  let path = null
  if (outPath !== null) {
    try {
      writeFile(resolve(outPath), text)
      path = resolve(outPath)
    } catch (e) {
      return refused('BUILD_STAMP_UNWRITABLE', `${outPath}: ${String(e && e.message ? e.message : e)}`)
    }
  }
  return { ok: true, stamp: made.stamp, text, path, mode: 'computed' }
}

// ───────────────────────────────────────────────────────────────────── cli ──

const HELP = [
  'usage: node scripts/census-build-stamp.mjs --write [--out FILE] [--merge-tree SHA] [--catalog-digest D]',
  '       node scripts/census-build-stamp.mjs --print',
  '       node scripts/census-build-stamp.mjs --verify FILE [--merge-tree SHA] [--catalog-digest D]',
  '',
  '  --write     compute the stamp over the real install surfaces and print it (or write --out)',
  '  --print     the same, without writing a file (stdout)',
  '  --verify F  re-verify a recorded stamp: schema, field shapes, its own digest, and (optionally)',
  '              that it belongs to --merge-tree / --catalog-digest',
  '',
  'Exit: 0 ok | 2 REFUSED (named code on stderr; nothing is written)',
  '',
].join('\n')

function emptyCatalogDigest(cwd) {
  const state = gatherCatalog({ cwd })
  return { catalog_digest: catalogDigestOf(state.entries) }
}

export function main(argv) {
  const opts = { write: false, print: false, verify: null, out: null, mergeTree: null, catalogDigest: null, help: false }
  try {
    for (let i = 0; i < argv.length; i += 1) {
      const a = argv[i]
      if (a === '--write') opts.write = true
      else if (a === '--print') opts.print = true
      else if (a === '--verify') opts.verify = argv[++i] ?? null
      else if (a === '--out') opts.out = argv[++i] ?? null
      else if (a === '--merge-tree') opts.mergeTree = argv[++i] ?? null
      else if (a === '--catalog-digest') opts.catalogDigest = argv[++i] ?? null
      else if (a === '--help' || a === '-h') opts.help = true
      else throw Object.assign(new Error(`unknown argument ${a}`), { code: 'UNKNOWN_ARGUMENT' })
    }
  } catch (e) {
    process.stderr.write(`REFUSED ${e.code ?? 'UNKNOWN_ARGUMENT'}: ${String(e.message ?? e)}\n`)
    return 2
  }
  if (opts.help) {
    process.stdout.write(HELP)
    return 0
  }
  if (opts.verify !== null) {
    // Re-hash the current surface: `--verify` answers "is this stamp of the bytes on disk NOW".
    const read = readBuildStamp(opts.verify, { cwd: process.cwd(), merge_tree: opts.mergeTree, catalog_digest: opts.catalogDigest })
    if (!read.ok) {
      process.stderr.write(`REFUSED ${read.code}: ${read.detail}\n`)
      return 2
    }
    process.stdout.write(
      `DSH-CENSUS-BUILD verify=ok schema=${read.stamp.schema} digest=${read.stamp.digest} ` +
        `files=${String(read.stamp.artifact_count)} bytes=${String(read.stamp.artifact_bytes)} ` +
        `merge_tree=${read.stamp.merge_tree}\n`,
    )
    return 0
  }
  if (!opts.write && !opts.print) {
    process.stderr.write('REFUSED NO_MODE: give --write, --print or --verify FILE\n')
    return 2
  }
  let mergeTree = opts.mergeTree
  let catalogDigest = opts.catalogDigest
  try {
    if (mergeTree === null) mergeTree = gitTreeSha(process.cwd())
    if (catalogDigest === null) catalogDigest = emptyCatalogDigest(process.cwd()).catalog_digest
  } catch (e) {
    process.stderr.write(`REFUSED ${e.code ?? 'GIT_READ_FAILED'}: ${String(e.message ?? e)}\n`)
    return 2
  }
  const resolved = resolveBuildStamp({
    cwd: process.cwd(),
    merge_tree: mergeTree,
    catalog_digest: catalogDigest,
    outPath: opts.write ? (opts.out ?? null) : null,
  })
  if (!resolved.ok) {
    process.stderr.write(`REFUSED ${resolved.code}: ${resolved.detail}\n`)
    return 2
  }
  if (opts.write && opts.out !== null) {
    process.stdout.write(
      `DSH-CENSUS-BUILD written=yes digest=${resolved.stamp.digest} files=${String(resolved.stamp.artifact_count)} ` +
        `bytes=${String(resolved.stamp.artifact_bytes)} out=${resolved.path}\n`,
    )
  } else {
    process.stdout.write(resolved.text)
  }
  return 0
}

const invokedDirectly = process.argv[1] !== undefined
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))
if (invokedDirectly) process.exit(main(process.argv.slice(2)))
