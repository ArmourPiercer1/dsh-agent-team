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
 *   trustedSources         the union digest over the PLANE trusted-source set (R-G4R-1a: the
 *                          reviewed tool-obligations family + the oracle-closure digest + one
 *                          composed-profile entry per launched World; every entry computed
 *                          from bytes — design dev/agent-workflow/gates/R-G4R-1a-DIGEST-SURFACE.md).
 *                          Null-with-reason stays legal and fail-closed: an empty declared
 *                          set, or any missing family file, emits NO digest. The RUNNING
 *                          World's admission-source document is still NOT exposed on the
 *                          public World/HTTP surface; that disclosure travels INSIDE the cell
 *                          (`admissionDocument`), verbatim.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

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

/**
 * R-G4R-1a — the PLANE TRUSTED-SOURCES digest surface.
 * Design: dev/agent-workflow/gates/R-G4R-1a-DIGEST-SURFACE.md. The three source families a
 * runner's verdicts are computed against (each named there, cited there):
 *   1. the reviewed tool-obligations family (`TRUSTED_SOURCE_FAMILY` below — manifest +
 *      census + expected set; the BL pins ride in via the manifest's input digests);
 *   2. the oracle closure digest (`role: 'world-oracle'`, sha256 = worldOracleDigest);
 *   3. one composed-profile entry per launched World (`role: 'composed-profile/<worldId>'`,
 *      sha256 = composedProfileDigest; appended by `bindWorldProfile`, which refreshes the
 *      union digest so a record's final digest covers every World it launched).
 * Honesty law (same pattern as the other two cells): compute-from-bytes or null-with-reason,
 * never a partial or retroactive digest. A missing family file voids the digest entirely
 * (a PARTIAL union would misrepresent what is bound); an empty declared set says so.
 * This digest is NOT a claim that the census inventory substitutes for the plane's runtime
 * admission document — the substitution ruling is lead/user-owned; the cell pins
 * `substituteAdoption: 'none'` and keeps the admission-document refusal verbatim inside itself.
 */
export const TRUSTED_SOURCES_SCHEMA = 'u7r3-g4r1a/plane-trusted-sources/1'
/** The hashing law, stated exactly; `recomputeTrustedSources` is its enforcement. */
export const TRUSTED_SOURCES_HASH_LAW = 'sha256(concat(for each entry in trustedSources.sources order: utf8(role) + 0x00 + utf8(repo-relative posix path) + 0x00 + utf8(per-source sha256 hex) + 0x00))'
/** What "in order" means; `sources` is written in this order (order-independence law). */
export const TRUSTED_SOURCES_ORDER = 'sources listed in lexically ascending role + 0x00 + path (JS string order); the digest consumes them in exactly that order, insertion order never affects it'
/**
 * The RUNNING World's admission-source gap, verbatim from the R-G4R-1 disclosure. It is a
 * fact about the host's public World/HTTP surface, not about the tracked bytes bound here,
 * and CORE PATCH BUDGET = 0 forbids minting the missing endpoint — so it stays disclosed
 * INSIDE the cell for as long as any digest or null travels in it.
 */
export const ADMISSION_DOCUMENT_UNAVAILABLE = 'The runner public World/HTTP surface exposes no plane TrustedSources/admission source document or digest. authoritative-tool-sources.v1.json is census inventory, not the plane admission document; it cannot substitute.'
/** The tracked reviewed authority documents whose BYTES every runner verdict input derives from. */
export const TRUSTED_SOURCE_FAMILY = Object.freeze([
  Object.freeze({ role: 'tool-obligations-manifest', path: 'dev/engineering/tool-obligations/manifest.json' }),
  Object.freeze({ role: 'authoritative-tool-sources', path: 'dev/engineering/tool-obligations/authoritative-tool-sources.v1.json' }),
  Object.freeze({ role: 'expected-tool-obligations', path: 'dev/engineering/tool-obligations/expected-tool-obligations.v1.json' }),
])

const SHA256_HEX_RE = /^[0-9a-f]{64}$/
const entryKey = (e) => `${e.role}\u0000${e.path}`

/** Pure digest core: validate + canonicalise + hash. Throws on a malformed entry. */
export function computeTrustedSourcesDigest(entries) {
  const sources = []
  const seen = new Set()
  for (const e of entries) {
    if (e === null || typeof e !== 'object') throw new Error(`trusted-sources entry is not an object: ${JSON.stringify(e)}`)
    const { role, path, sha256 } = e
    if (typeof role !== 'string' || role === '' || role.includes('\u0000')) throw new Error(`trusted-sources entry role is not a NUL-free string: ${JSON.stringify(role)}`)
    if (typeof path !== 'string' || path.includes('\u0000') || path.includes('\\') || isAbsolute(path)) throw new Error(`trusted-sources entry path is not a repo-relative posix path (empty allowed for digest-carried entries): ${JSON.stringify(path)}`)
    if (typeof sha256 !== 'string' || !SHA256_HEX_RE.test(sha256)) throw new Error(`trusted-sources entry sha256 is not 64-hex: ${JSON.stringify(sha256)} (${role})`)
    const key = entryKey({ role, path })
    if (seen.has(key)) throw new Error(`duplicate trusted-sources entry ${role} @ ${JSON.stringify(path)}`)
    seen.add(key)
    sources.push({ role, path, sha256 })
  }
  sources.sort((a, b) => (entryKey(a) < entryKey(b) ? -1 : entryKey(a) > entryKey(b) ? 1 : 0))
  const digest = createHash('sha256')
  for (const s of sources) digest.update(Buffer.from(s.role, 'utf8')).update(NUL).update(Buffer.from(s.path, 'utf8')).update(NUL).update(Buffer.from(s.sha256, 'utf8')).update(NUL)
  return { digest: digest.digest('hex'), sources }
}

/**
 * Runner-side capture (spreadable into a `createRunRecord` bindings block).
 * @param {object} p
 * @param {string} [p.repoRoot]          defaults to this module's repo root
 * @param {Array<{role,path}>} [p.family] family files to hash (defaults to TRUSTED_SOURCE_FAMILY;
 *                                        `[]` declares an empty set — legal, emits null-with-reason)
 * @param {Array<{role,path,sha256}>} [p.extraEntries] entries whose sha256 the caller computed
 *                                        from bytes (oracle closure digest, per-world profiles)
 */
export function captureTrustedSourcesBinding({ repoRoot, family = TRUSTED_SOURCE_FAMILY, extraEntries = [] } = {}) {
  const root = resolve(repoRoot ?? findRepoRoot(fileURLToPath(import.meta.url)))
  const entries = []
  const missingSources = []
  for (const f of family) {
    try {
      entries.push({ role: f.role, path: f.path, sha256: digestFile(join(root, f.path)) })
    } catch (error) {
      missingSources.push(`${f.role} (${f.path}: ${String(error?.code ?? error?.message ?? error)})`)
    }
  }
  entries.push(...extraEntries)
  const admissionDocument = { available: false, reason: ADMISSION_DOCUMENT_UNAVAILABLE }
  const cellBase = { schema: TRUSTED_SOURCES_SCHEMA, hashLaw: TRUSTED_SOURCES_HASH_LAW, order: TRUSTED_SOURCES_ORDER, admissionDocument, substituteAdoption: 'none', recompute: 'recomputeTrustedSources(record, repoRoot): family sha256 re-hashed from the tracked bytes; the union digest re-derived from the entry list; profile/oracle entries are covered by their own cells (launched-profile re-hash / recomputeWorldOracle)' }
  // fail-closed legs FIRST: a missing family file or an empty set mints NO digest, with a
  // machine-readable reason — never a partial digest, never a silent shrink of the set.
  if (missingSources.length > 0) {
    const reason = `trusted-sources digest refused: ${String(missingSources.length)} declared source file(s) unreadable under the repo root — a partial union digest would misrepresent what is bound. Missing: ${missingSources.join('; ')}`
    return { trustedSourcesDigest: null, trustedSourcesUnavailableReason: reason,
      trustedSources: { ...cellBase, digest: null, unavailableReason: reason, sources: [], missingSources } }
  }
  if (entries.length === 0) {
    const reason = 'trusted-sources digest refused: the declared source set is empty (an empty set binds nothing — null-with-reason, not a hash of nothing).'
    return { trustedSourcesDigest: null, trustedSourcesUnavailableReason: reason,
      trustedSources: { ...cellBase, digest: null, unavailableReason: reason, sources: [], missingSources } }
  }
  const { digest, sources } = computeTrustedSourcesDigest(entries)
  return { trustedSourcesDigest: digest,
    trustedSources: { ...cellBase, digest, unavailableReason: null, sources, missingSources } }
}

/**
 * Recompute the union digest after the set grew (one more launched World). Returns the
 * digest, or null when the bindings carry no current-schema cell (legacy shape untouched).
 */
export function refreshTrustedSourcesDigest(bindings) {
  const ts = bindings?.trustedSources
  if (ts === undefined || ts === null || ts.schema !== TRUSTED_SOURCES_SCHEMA) return null
  if (!Array.isArray(ts.sources)) throw new Error('refreshTrustedSourcesDigest: trustedSources.sources is not an array')
  if (ts.sources.length === 0) return null // empty declared set stays null-with-reason by law
  const { digest, sources } = computeTrustedSourcesDigest(ts.sources)
  ts.sources = sources
  ts.digest = digest
  ts.unavailableReason = null
  bindings.trustedSourcesDigest = digest
  delete bindings.trustedSourcesUnavailableReason
  return digest
}

/**
 * Cold-reader verification: re-hash the family files under ANY checkout root, re-derive the
 * union digest from the recorded entries, report per-entry agreement. One flipped byte in
 * any family document turns `matches` false — mutation is RED, not a shrug.
 */
export function recomputeTrustedSources(record, repoRoot) {
  const ts = record?.bindings?.trustedSources ?? record?.trustedSources ?? null
  if (ts === null || typeof ts !== 'object') throw new Error('recomputeTrustedSources: the record carries no bindings.trustedSources')
  if (ts.schema !== TRUSTED_SOURCES_SCHEMA) throw new Error(`recomputeTrustedSources: recorded cell schema is not the implemented one (${String(ts.schema)})`)
  if (ts.digest === null) return { digest: null, matches: null, reason: ts.unavailableReason ?? 'recorded digest is null', entries: Array.isArray(ts.sources) ? ts.sources.length : 0 }
  if (ts.hashLaw !== TRUSTED_SOURCES_HASH_LAW) throw new Error(`recomputeTrustedSources: recorded hashLaw is not the implemented law (${String(ts.hashLaw)})`)
  const root = resolve(repoRoot)
  const familyRoles = new Set(TRUSTED_SOURCE_FAMILY.map((f) => f.role))
  const familyRehashed = []
  for (const s of ts.sources) {
    if (!familyRoles.has(s.role) || s.path === '') continue
    let recomputed = null
    try { recomputed = digestFile(join(root, s.path)) } catch { recomputed = null }
    familyRehashed.push({ role: s.role, path: s.path, agree: recomputed === s.sha256 })
  }
  const { digest } = computeTrustedSourcesDigest(ts.sources)
  const digestMatches = digest === ts.digest
  const bytesAgree = familyRehashed.every((f) => f.agree)
  // `matches` is the conjunction a cold reader needs: the recorded digest re-derives from
  // the recorded entries (law) AND every family sha256 re-hashes from the bytes on disk
  // (truth). Oracle/profile entries are covered by their own cells' laws, named in `recompute`.
  return { digest, matches: digestMatches && bytesAgree, digestMatches, bytesAgree, familyRehashed, entries: ts.sources.length }
}

/** The legacy null-with-reason shape (R-G4R-1 disclosure). Kept for readers and fixtures;
 *  runners that capture the plane set use `captureTrustedSourcesBinding` instead. */
export function trustedSourcesUnavailable() {
  const unavailableReason = ADMISSION_DOCUMENT_UNAVAILABLE
  return { trustedSourcesDigest: null, trustedSourcesUnavailableReason: unavailableReason,
    trustedSources: { schema: TRUSTED_SOURCES_SCHEMA, digest: null, unavailableReason,
      sources: [], missingSources: [], admissionDocument: { available: false, reason: unavailableReason },
      substituteAdoption: 'none' } }
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
    // R-G4R-1a: the launched profile is a trusted source of the run's verdicts — add its
    // entry (sha256 = the composedProfileDigest, bytes bound by the profile cell itself)
    // and refresh the union digest. No-op for legacy/absent cells (schema-guarded). The
    // role carries the entry's index in that world's digest list so a relaunched World that
    // launches a DIFFERENT profile still books both entries (never a silent drop).
    const ts = bindings.trustedSources
    if (ts !== undefined && ts !== null && ts.schema === TRUSTED_SOURCES_SCHEMA && ts.digest !== null) {
      const digests = bindings.composedProfileDigest[entry.worldId]
      const role = `composed-profile/${entry.worldId}#${String(digests.length)}`
      if (!ts.sources.some((s) => s.role === role)) ts.sources.push({ role, path: '', sha256: entry.composedProfileDigest })
      refreshTrustedSourcesDigest(bindings)
    }
  }
  if (bindings.profileArtifacts.some((e) => e.composedProfileDigestMismatch === true)) bindings.composedProfileDigestMismatch = true
  return entry
}
