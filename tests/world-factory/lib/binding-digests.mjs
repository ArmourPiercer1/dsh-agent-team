/**
 * binding-digests.mjs — offline-verifiable RUN bindings. No host/private API,
 * no model claims, no Host boot.
 *
 * THREE CELLS, THREE PROOFS (each recomputable by a cold reader):
 *   composedProfileDigest  the EXACT bytes of the profile patch the World
 *                          launches (F3: hashed BEFORE the spawn, re-read and
 *                          re-hashed AFTER it — a mismatch fails the run).
 *   worldOracle            the suite's executable oracle SOURCE CLOSURE (F1:
 *                          static + re-export + dynamic + literal-read edges,
 *                          followed anywhere inside the repo root) plus the
 *                          repo-relative source list (F2) under the hashing
 *                          law stated in ORACLE_HASH_LAW.
 *   trustedSources         explicit null + reason (the public seam exposes no
 *                          plane admission-source document; see below).
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'

const ONE_MIB = 1024 * 1024
const NUL = Buffer.from([0])

export const ORACLE_SCHEMA = 'u7-oracle-source-artifact/2'
/**
 * F2 — the hashing law, stated exactly and enforced by
 * `recomputeWorldOracle` (any reader that follows this string reproduces the
 * digest byte-for-byte, in any checkout root).
 */
export const ORACLE_HASH_LAW = 'sha256(concat(for each source in worldOracle.sources order: utf8(repo-relative posix path) + 0x00 + raw file bytes + 0x00))'
/** F2 — what "in order" means; `sources` is written in this order. */
export const ORACLE_SOURCE_ORDER = 'sources listed in lexically ascending repo-relative posix path (JS string order); the digest consumes them in exactly that order'

/**
 * F1 — helper modules the oracle closure deliberately does NOT bind. They
 * launch Worlds, discover suites or compute bindings; NONE of them defines an
 * expected answer. They are never silently dropped: every one the walk
 * actually reaches is disclosed in `worldOracle.excludedHelpers` and
 * documented per suite in dev/agent-workflow/evidence/u7-g4r-20261028/README.md.
 */
export const HELPER_EXCLUSIONS = Object.freeze({
  'tests/world-factory/lib/world-factory.mjs': 'World launcher: ports/homes/lease/patch materialisation around DshInstance. It defines no expected answers; its own directory-scanning dynamic imports are launcher mechanics, not oracle bytes.',
  'tests/world-factory/lib/suites.mjs': 'Suite registry: scans tests/world-factory/suites/ and dynamic-imports each directory entry (a non-literal specifier). It defines no expected answers — every suite it loads is bound by its own oracle cell.',
  'tests/world-factory/lib/binding-digests.mjs': 'This helper: it computes bindings, it is not a verdict. Binding it would make the oracle digest depend on its own hasher (self-reference) while still defining no expected answer.',
})

/** F1 — root identifiers a literal path expression may hang off (repo conventions). */
const ROOT_IDENTIFIERS = Object.freeze({ REPO_ROOT: 'repo', ROOT: 'repo', repoRoot: 'repo', HERE: 'file', __dirname: 'file', here: 'file' })

export const sha256Bytes = (buf) => createHash('sha256').update(buf).digest('hex')
export const digestFile = (path) => sha256Bytes(readFileSync(path))

const posixRel = (root, abs) => relative(root, abs).split(sep).join('/')
const isUnder = (root, abs) => {
  const rel = relative(root, abs)
  return rel === '' || (rel !== '' && !rel.startsWith('..') && !isAbsolute(rel))
}

/** Repo root = nearest ancestor holding `.git` (dir in a clone, file in a worktree). */
function findRepoRoot(fromPath) {
  let dir = dirname(resolve(fromPath))
  for (;;) {
    if (existsSync(join(dir, '.git'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return resolve(fromPath, '..', '..')
    dir = parent
  }
}

/** Index just past the paren that matches the one at `open` (-1 when unbalanced). */
function matchParen(text, open) {
  let depth = 0
  let quote = null
  for (let i = open; i < text.length; i += 1) {
    const c = text[i]
    if (quote !== null) {
      if (c === '\\') i += 1
      else if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if (c === '(') depth += 1
    else if (c === ')') { depth -= 1; if (depth === 0) return i }
  }
  return -1
}

/** Top-level argument list of an already paren-matched call body. */
function splitArgs(body) {
  const out = []
  let depth = 0
  let quote = null
  let start = 0
  for (let i = 0; i < body.length; i += 1) {
    const c = body[i]
    if (quote !== null) {
      if (c === '\\') i += 1
      else if (c === quote) quote = null
      continue
    }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue }
    if (c === '(' || c === '[' || c === '{') depth += 1
    else if (c === ')' || c === ']' || c === '}') depth -= 1
    else if (c === ',' && depth === 0) { out.push(body.slice(start, i).trim()); start = i + 1 }
  }
  out.push(body.slice(start).trim())
  return out.filter((s) => s !== '')
}

/** Every `keyword(` call whose body can be paren-matched (token-boundary anchored). */
function* callSites(text, keyword) {
  let i = 0
  for (;;) {
    const at = text.indexOf(`${keyword}(`, i)
    if (at < 0) return
    const before = at === 0 ? '' : text[at - 1]
    if (/[A-Za-z0-9_.$]/.test(before)) { i = at + 1; continue }
    const close = matchParen(text, at + keyword.length)
    if (close < 0) return
    yield { body: text.slice(at + keyword.length + 1, close), at }
    i = close
  }
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length

const QUOTED = String.raw`(?:'[^'\n]*'|"[^"\n]*")`
const JOIN_LITERALS = new RegExp(String.raw`^join\s*\(\s*([A-Za-z_$][\w.]*)\s*,\s*(${QUOTED}(?:\s*,\s*${QUOTED})*)\s*\)$`)

/** Strip the quotes of a literal list into path segments. */
const segmentsOf = (litList) => litList.split(/\s*,\s*/).map((s) => s.trim().slice(1, -1))

/**
 * Resolve ONE call argument (already paren-matched) to a filesystem path.
 * Returns {path} | {specifier} (bare, not followed) | {unresolved: true}.
 * F1: only STRING-LITERAL specifiers are followed; anything computed is
 * `unresolved`, which the caller turns into `complete: false` (never a silent
 * omission of the dependency the closure could not see).
 */
function classifyArgument(arg, { fileDir, repoRoot }) {
  const a = arg.trim()
  const lit = /^(['"])([^'"\n]*)\1$/.exec(a)
  if (lit !== null) {
    // A relative specifier is a path (Node resolves it against the importing
    // file, which is `fileDir`); anything else is a package specifier and is
    // never followed into host/node bytes.
    if (lit[2].startsWith('./') || lit[2].startsWith('../')) return { path: resolve(fileDir, lit[2]) }
    if (lit[2].startsWith('/')) return { path: resolve(lit[2]) } // absolute: kept, then filtered by the repo-root rule
    return { specifier: lit[2] }
  }
  const urlForm = new RegExp(String.raw`^(?:new\s+URL\s*\(\s*${QUOTED}\s*,\s*import\.meta\.url\s*\)|pathToFileURL\s*\(\s*${QUOTED}\s*\))(?:\s*\.href)?$`).exec(a)
  if (urlForm !== null) {
    const inner = /(['"])([^'"\n]*)\1/.exec(urlForm[0])
    return { path: resolve(fileDir, inner[2]) }
  }
  const joined = /^(?:pathToFileURL\s*\(\s*)?(join\s*\([^)]*\))(?:\s*\)\s*\.href)?$/.exec(a)
  if (joined !== null) {
    const m = JOIN_LITERALS.exec(joined[1])
    if (m === null) return { unresolved: true }
    const root = ROOT_IDENTIFIERS[m[1]]
    if (root === undefined) return { unresolved: true }
    const base = root === 'repo' ? repoRoot : fileDir
    return { path: resolve(base, ...segmentsOf(m[2])) }
  }
  return { unresolved: true }
}

/**
 * The import/read edges of one file (F1).
 * Edges followed: static `import … from '<lit>'`, bare `import '<lit>'`,
 * `export … from '<lit>'`, `import('<lit>')`,
 * `import(new URL('<lit>', import.meta.url).href)`,
 * `import(pathToFileURL(join(REPO_ROOT|HERE, '<lit>', …)).href)`, and literal
 * `readFileSync(new URL('<lit>', import.meta.url) …)` /
 * `readFileSync(join(<root id>, '<lit>', …))` (so a `.json` answer key bound
 * by literal path is part of the oracle).
 * Bare specifiers (`node:fs`, `@deepseek-ai/…`) are NOT followed and are
 * reported in `externalSpecifiers`.
 */
function readEdges({ abs, text, repoRoot }) {
  const fileDir = dirname(abs)
  const rel = () => posixRel(repoRoot, abs)
  const at = (index) => `${rel()}:${String(lineOf(text, index))}`
  const edges = []
  const bare = new Set()
  const unresolvedDynamicImports = []
  const unresolvedLiteralReads = []
  const push = (target, seenBare) => {
    if (target.specifier !== undefined) { if (seenBare) bare.add(target.specifier); return }
    if (target.unresolved === true) return
    edges.push(target.path)
  }
  // 1. static import/export … from '<literal>'  (multi-line specifier lists included)
  for (const m of text.matchAll(/(?:^|[\n;])\s*(?:import|export)\b[\s\S]{0,600}?\bfrom\s*(['"])([^'"\n]*)\1/g)) {
    const spec = m[2]
    if (/^[./]/.test(spec)) edges.push(resolve(fileDir, spec))
    else if (/^[A-Za-z]/.test(spec)) bare.add(spec)
  }
  // 2. side-effect import '<literal>'
  for (const m of text.matchAll(/^[ \t]*import\s*(['"])([^'"\n]*)\1/gm)) {
    const spec = m[2]
    if (/^[./]/.test(spec)) edges.push(resolve(fileDir, spec))
    else if (/^[A-Za-z]/.test(spec)) bare.add(spec)
  }
  // 3. dynamic import( … )
  for (const site of callSites(text, 'import')) {
    const first = splitArgs(site.body)[0] ?? ''
    const target = classifyArgument(first, { fileDir, repoRoot })
    if (target.unresolved === true) unresolvedDynamicImports.push(at(site.at))
    else push(target, true)
  }
  // 4. literal reads of local files (the .json answer-key case)
  for (const keyword of ['readFileSync']) {
    for (const site of callSites(text, keyword)) {
      const first = splitArgs(site.body)[0] ?? ''
      if (!/['"]/.test(first)) continue // a variable path is a runtime input, not a bound source
      const target = classifyArgument(first, { fileDir, repoRoot })
      if (target.unresolved === true) unresolvedLiteralReads.push(at(site.at))
      else push(target, false)
    }
  }
  return { edges, bare, unresolvedDynamicImports, unresolvedLiteralReads }
}

/**
 * F1/F2 — the oracle source closure of one suite artifact.
 *
 * Walks literal import/read edges from `artifactPath`, following ANY repo-
 * relative path inside `repoRoot` (tests/world-factory is not a boundary),
 * skipping bare specifiers (recorded) and the named launcher/registry helpers
 * (disclosed). A dynamic import it cannot resolve is recorded in
 * `unresolvedDynamicImports` and makes the cell `complete: false`.
 *
 * @param {object} p
 * @param {string} p.artifactPath  the suite module (entry of the closure)
 * @param {string} p.evidencePath  where the byte-copy artifact is written
 * @param {string} [p.sourceRoot]  legacy label; kept for the callers
 * @param {string} [p.repoRoot]    defaults to the nearest ancestor with `.git`
 * @param {string} [p.suite]
 */
export function captureOracleBinding({ artifactPath, evidencePath, sourceRoot, repoRoot, suite = 'offline' }) {
  // Preserve the actual source bytes, not reconstructed function text.
  const entry = resolve(artifactPath)
  const root = resolve(repoRoot ?? findRepoRoot(entry))
  const rootLabel = sourceRoot === undefined ? undefined : relative(root, resolve(sourceRoot)).split(sep).join('/')
  const seen = new Map()
  const excludedHelpers = new Set()
  const externalSpecifiers = new Set()
  const unfollowedPaths = new Set()
  const unresolvedDynamicImports = []
  const unresolvedLiteralReads = []
  const missingSources = []
  const visit = (path) => {
    const abs = resolve(path)
    const rel = posixRel(root, abs)
    if (HELPER_EXCLUSIONS[rel] !== undefined) { excludedHelpers.add(rel); return }
    if (seen.has(rel)) return
    if (!isUnder(root, abs)) return // outside the repo root: never bound, never followed
    let bytes
    try {
      bytes = readFileSync(abs)
    } catch (error) {
      missingSources.push(`${rel} (${String(error?.code ?? error?.message ?? error)})`)
      return
    }
    seen.set(rel, bytes)
    const edges = readEdges({ abs, text: bytes.toString('utf8'), repoRoot: root })
    for (const spec of edges.bare) externalSpecifiers.add(spec)
    for (const u of edges.unresolvedDynamicImports) unresolvedDynamicImports.push(u)
    for (const u of edges.unresolvedLiteralReads) unresolvedLiteralReads.push(u)
    for (const target of edges.edges) {
      const tRel = posixRel(root, target)
      if (HELPER_EXCLUSIONS[tRel] !== undefined) { excludedHelpers.add(tRel); continue }
      if (!isUnder(root, target)) { unfollowedPaths.add(tRel); continue }
      visit(target)
    }
  }
  visit(entry)

  const entryRel = posixRel(root, entry)
  if (!seen.has(entryRel)) seen.set(entryRel, readFileSync(entry))
  const sources = [...seen].map(([path, bytes]) => ({ path, bytes })).sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0))
  const digest = createHash('sha256')
  for (const s of sources) digest.update(Buffer.from(s.path, 'utf8')).update(NUL).update(s.bytes).update(NUL)
  const worldOracleDigest = digest.digest('hex')
  // F1 fail-closed rule: an unresolvable DYNAMIC IMPORT means the closure may
  // be missing oracle bytes a reader cannot see, so the cell says
  // `complete: false` and names them — never a silent omission. A literal
  // `readFileSync(...)` whose path is computed at runtime is a RUNTIME INPUT
  // (world state, host log, authority pointer), not an expected answer: it is
  // disclosed in `unresolvedLiteralReads` / `literalReadsComplete` rather than
  // voiding every oracle that touches a World directory.
  const complete = unresolvedDynamicImports.length === 0 && missingSources.length === 0
  const literalReadsComplete = unresolvedLiteralReads.length === 0
  const external = [...externalSpecifiers].sort()
  const excluded = [...excludedHelpers].sort()
  const unresolvedDyn = [...new Set(unresolvedDynamicImports)].sort()
  const unresolvedRead = [...new Set(unresolvedLiteralReads)].sort()
  const unreadable = [...new Set(missingSources)].sort()

  const artifactRel = isUnder(root, resolve(evidencePath)) ? posixRel(root, evidencePath) : null
  const artifactText = `${JSON.stringify({
    schema: ORACLE_SCHEMA,
    suite,
    entry: entryRel,
    repoRootLabel: rootLabel ?? null,
    hashLaw: ORACLE_HASH_LAW,
    order: ORACLE_SOURCE_ORDER,
    digest: worldOracleDigest,
    complete,
    literalReadsComplete,
    sources: sources.map((s) => ({ path: s.path, sha256: sha256Bytes(s.bytes), bytesBase64: s.bytes.toString('base64') })),
    excludedHelpers: excluded,
    externalSpecifiers: external,
    unfollowedPaths: [...unfollowedPaths].sort(),
    unresolvedDynamicImports: unresolvedDyn,
    unresolvedLiteralReads: unresolvedRead,
    missingSources: unreadable,
  })}\n`
  if (Buffer.byteLength(artifactText) > ONE_MIB) throw new Error(`oracle binding artifact exceeds 1 MiB evidence cap (${String(Buffer.byteLength(artifactText))} bytes for suite ${suite})`)
  mkdirSync(dirname(evidencePath), { recursive: true })
  writeFileSync(evidencePath, artifactText)
  const artifactSha256 = sha256Bytes(readFileSync(evidencePath))
  return {
    worldOracleDigest,
    worldOracle: {
      suite,
      digest: worldOracleDigest,
      complete,
      entry: entryRel,
      // F2: REPO-RELATIVE posix paths only, in exactly the hashing order.
      sources: sources.map((s) => s.path),
      order: ORACLE_SOURCE_ORDER,
      hashLaw: ORACLE_HASH_LAW,
      excludedHelpers: excluded,
      externalSpecifiers: external,
      unfollowedPaths: [...unfollowedPaths].sort(),
      unresolvedDynamicImports: unresolvedDyn,
      unresolvedLiteralReads: unresolvedRead,
      literalReadsComplete,
      missingSources: unreadable,
      artifactPath: evidencePath,
      artifactSha256,
      // Cited from the RUN record's `evidence` list, so the existing
      // RUN_EVIDENCE_MISSING / RUN_EVIDENCE_DIGEST_MISMATCH rules grade it.
      evidence: artifactRel === null ? [] : [{ path: artifactRel, sha256: artifactSha256, kind: 'world-oracle-source-artifact' }],
    },
    oracleArtifactPath: evidencePath,
    oracleCoverage: `suite entry plus every literal import/re-export/dynamic-import/read edge reachable inside the repo root (product files included), byte copies retained base64 in the cited artifact under ${ORACLE_HASH_LAW}; launcher/registry helpers listed in excludedHelpers define no expected answers; bare specifiers in externalSpecifiers stay host-bound; paths resolving outside the repo root in unfollowedPaths; a literal read whose path is computed at runtime is disclosed in unresolvedLiteralReads (runtime input, literalReadsComplete=false); an unresolvable dynamic import or an unreadable closure file sets complete=false`,
  }
}

/**
 * F2 — recompute `bindings.worldOracle.digest` from repo-relative paths under
 * ANY checkout root. Proves the recorded list is relocatable (no absolute
 * path leaked into the law) and that the law is the one recorded.
 *
 * @param {object} record  a RUN record (or its `bindings`) holding `worldOracle`
 * @param {string} repoRoot the checkout to read the sources from
 */
export function recomputeWorldOracle(record, repoRoot) {
  const oracle = record?.bindings?.worldOracle ?? record?.worldOracle ?? null
  if (oracle === null || typeof oracle !== 'object') throw new Error('recomputeWorldOracle: the record carries no bindings.worldOracle')
  if (oracle.hashLaw !== ORACLE_HASH_LAW) throw new Error(`recomputeWorldOracle: recorded hashLaw is not the implemented law (${String(oracle.hashLaw)})`)
  if (!Array.isArray(oracle.sources) || oracle.sources.length === 0) throw new Error('recomputeWorldOracle: worldOracle.sources is not a non-empty list')
  for (const s of oracle.sources) {
    if (typeof s !== 'string' || isAbsolute(s) || s.includes('\\') || s.startsWith('../')) {
      throw new Error(`recomputeWorldOracle: source ${JSON.stringify(s)} is not a repo-relative posix path — the digest would not survive a different checkout root`)
    }
  }
  const digest = createHash('sha256')
  for (const rel of oracle.sources) digest.update(Buffer.from(rel, 'utf8')).update(NUL).update(readFileSync(join(repoRoot, rel))).update(NUL)
  const digestHex = digest.digest('hex')
  return { digest: digestHex, matches: digestHex === oracle.digest, complete: oracle.complete !== false, sources: oracle.sources.length }
}

/**
 * F3 — capture the profile the World is about to launch.
 *
 * The digest is taken over the exact Buffer read from `patchFile`, and the
 * evidence copy is written FROM THAT SAME BUFFER (never a second read, never
 * a re-serialised "equivalent" document), so the retained artifact and the
 * recorded digest are the same bytes by construction. `verifyProfileBinding
 * Launched` closes the loop after the spawn.
 *
 * `read`/`write` are injectable so the C1 test can prove the mismatch path
 * with a writer that mutates the launch file between capture and spawn.
 */
export function captureProfileBinding({ patchFile, logDir, worldId, read = (p) => readFileSync(p), write = (p, b) => writeFileSync(p, b) }) {
  const bytes = read(patchFile)
  if (bytes.length > ONE_MIB) throw new Error('profile binding artifact exceeds 1 MiB evidence cap')
  mkdirSync(logDir, { recursive: true })
  const composedProfileDigest = sha256Bytes(bytes)
  const path = join(logDir, `composed-profile-${composedProfileDigest}.patch.yml`)
  write(path, bytes)
  const artifactDigest = sha256Bytes(read(path))
  if (artifactDigest !== composedProfileDigest) {
    throw new Error(`profile binding evidence copy ${path} hashes to ${artifactDigest}, not the recorded ${composedProfileDigest} — refusing to bind a profile digest the reader cannot reproduce`)
  }
  return {
    worldId,
    composedProfileDigest,
    artifactPath: path,
    artifactDigest,
    launchPath: patchFile,
    launchedBytes: bytes.length,
    coverage: 'exact materialized web profile patch bytes, including comments and final newline; hashed BEFORE spawn and re-hashed from the launched file AFTER it (composedProfileDigestMismatch); not a flattened upstream base bundle',
  }
}

/**
 * F3 — prove the launched file IS the hashed profile: re-read the file the
 * child was handed and re-hash it. On mismatch the entry carries
 * `composedProfileDigestMismatch: true` (the caller re-publishes it into the
 * record bindings via `bindWorldProfile`) and this throws, so the run fails
 * closed instead of reporting a verdict for a profile nobody launched.
 */
export function verifyProfileBindingLaunched(entry, { read = (p) => readFileSync(p) } = {}) {
  let launchedDigest = null
  try {
    launchedDigest = sha256Bytes(read(entry.launchPath))
  } catch {
    launchedDigest = null
  }
  entry.launchedDigest = launchedDigest
  entry.composedProfileDigestMismatch = launchedDigest !== entry.composedProfileDigest
  if (entry.composedProfileDigestMismatch) {
    throw new Error(`profile binding mismatch: the file the World launched (${entry.launchPath}) hashes to ${String(launchedDigest)} but the recorded composedProfileDigest is ${entry.composedProfileDigest} — the hashed profile is not the launched profile`)
  }
  return entry
}

export function trustedSourcesUnavailable() {
  const unavailableReason = 'The runner public World/HTTP surface exposes no plane TrustedSources/admission source document or digest. authoritative-tool-sources.v1.json is census inventory, not the plane admission document; it cannot substitute.'
  return { trustedSourcesDigest: null, trustedSourcesUnavailableReason: unavailableReason,
    trustedSources: { digest: null, unavailableReason } }
}

/**
 * Update the same live object before each boot (including restart attempts).
 * Safe to call twice with the same entry: the pre-spawn capture and the
 * post-spawn proof publish the SAME object, and the second call only refreshes
 * the disclosure flags (`composedProfileDigestMismatch`), never duplicates.
 */
export function bindWorldProfile(bindings, entry) {
  bindings.composedProfileDigest ??= {}
  bindings.profileArtifacts ??= []
  if (!bindings.profileArtifacts.includes(entry)) {
    bindings.composedProfileDigest[entry.worldId] ??= []
    bindings.composedProfileDigest[entry.worldId].push(entry.composedProfileDigest)
    bindings.profileArtifacts.push(entry)
  }
  if (bindings.profileArtifacts.some((e) => e.composedProfileDigestMismatch === true)) bindings.composedProfileDigestMismatch = true
  return entry
}
