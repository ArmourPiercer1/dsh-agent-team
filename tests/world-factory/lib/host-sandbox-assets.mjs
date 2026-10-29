/**
 * host-sandbox-assets.mjs — the pinned native sandbox assets of the test
 * Host runtime tree: detect, provision, verify, and report.
 *
 * WHY THIS EXISTS (measured 2026-10-28, recorded in docs/TEST_METHODS.md §9).
 * The host resolves its Landlock launcher through
 * `native/system/packages/entry/lib/index.js`: `launcherPath()` →
 * `<platformPackage>/bin/landlock-run`, and `probe()` runs that binary with
 * `--probe`. Those binaries are NATIVE assets: `native/system/.gitignore`
 * ignores every platform package's `bin/`, so the documented fresh-worktree
 * procedure (`git clone --local --no-hardlinks <baseline>
 * tests/deepseek-harness-test-use`, TEST_METHODS §1) produces a tree with
 * `bin/` and `bin/glibc/` but WITHOUT the binaries. `probe()` then answers
 * `unusable`, and on a host where bwrap cannot run (this machine refuses
 * non-privileged user namespaces) that is the end of native confinement: the
 * host fails closed with `sandbox mode "<mode>" is requested but no sandbox
 * backend is usable on this host`. Recorded as-is, that environment gap reads
 * as a product FAIL.
 *
 * THE LAWS THIS MODULE ENFORCES:
 *   1. **Resolve the way the host resolves.** The launcher path comes from the
 *      runtime tree's OWN entry module (`launcherPath()`), never from a
 *      hardcoded path that can drift silently; the file set comes from the
 *      committed manifest, keyed by the pinned baseline in `tests/paths.mjs`.
 *   2. **Local bytes only, from a tree we trust.** Source is an explicit LOCAL
 *      tree (default: the main Team checkout's own runtime tree; override with
 *      `DSH_TEAM_SANDBOX_ASSET_SOURCE`). There is no download path, and the
 *      source tree is never a write target. Because law 1 means resolving a
 *      source tree IMPORTS its entry module, the override is not free-form: it
 *      must be an existing directory whose REALPATH stays inside a Team tree or
 *      the one documented shared baseline (`SHARED_BASELINE_ROOTS`). A digest
 *      pins bytes; it cannot pin the code of the tree those bytes are read by.
 *   3. **Verify, then publish — and never outside `bin/`.** Every
 *      manifest-declared relative path is checked for containment in the
 *      destination platform package's `bin/` BEFORE the first mkdir/copy/rename.
 *      Source bytes are hashed against the pinned manifest BEFORE anything is
 *      written; each file is staged beside its destination, re-hashed, and only
 *      then renamed into place, with the manifest's pinned MODE applied and
 *      re-read from the published file. A copy that fails verification is
 *      deleted — a wrong-hash binary never becomes reachable through the path
 *      the host execs.
 *   4. **Bytes we did not create are never destroyed.** A destination file
 *      whose bytes mismatch the manifest is a fail-closed finding
 *      (`DESTINATION_DIGEST_MISMATCH`), left in place for a human.
 *   5. **Provenance on every write.** Source tree, source runtime HEAD, per
 *      file digest/bytes/mode and the destination's `git status --porcelain`
 *      after the write go into a record the runner puts into its RUN record.
 *   6. **A verdict is not an environment claim.** `nativeConfinementEnvBlock`
 *      opens the ENV_BLOCK path ONLY for the conjunction (a real probe record
 *      saying `unusable`) AND (the host's typed unavailable signal in the
 *      observed lane output). Anything else stays FAIL.
 *   7. **A pre-flight record is an identity, not a shape.** The record that the
 *      first half of that conjunction accepts is one this module produced: the
 *      objects `preflightHostSandbox()` returns carry a module-private brand (a
 *      `WeakSet`), so a hand-written object with the same fields — or a JSON
 *      copy of a real record — opens nothing. The brand lives in this process
 *      and is not serialised: a runner judges with the record it measured, not
 *      with a re-typed one.
 *
 * Zero host boots, zero network, zero writes outside the destination
 * platform package's own `bin/` tree.
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync, copyFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync,
  rmSync, statSync, unlinkSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DSH_BASELINE_VERSION, findTestRepoRoot, TEST_USE_BASELINE_SHA, testUseTree } from '../../paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
/**
 * The Team tree this module lives in. The manifest is a COMMITTED file of the
 * same tree as this code, so it is looked up here — never through
 * `findTestRepoRoot` (which from a task worktree resolves to the MAIN
 * checkout, where a not-yet-merged manifest does not exist).
 */
export const DEFAULT_REPO_ROOT = resolve(HERE, '..', '..', '..')

/** Relative path (from the Team repo root) of the committed pinned manifest. */
export const MANIFEST_REL = 'tests/world-factory/lib/host-sandbox-assets-manifest.json'
/** Schema of the provisioning provenance record. */
export const HOST_SANDBOX_ASSETS_SCHEMA = 'u7-sbx-host-sandbox-assets/1'
/** Schema of the pre-flight probe record — the shape a judge accepts, and only
 *  for a record `preflightHostSandbox()` minted (see `isSandboxPreflightRecord`). */
export const SANDBOX_PREFLIGHT_SCHEMA = 'u7-sbx-sandbox-preflight/1'
/** Operator override for the LOCAL provisioning source tree. */
export const SOURCE_TREE_ENV = 'DSH_TEAM_SANDBOX_ASSET_SOURCE'
/** Set to `0`/`false` to make the pre-flight probe-only (no provisioning). */
export const PROVISION_ENV = 'DSH_TEAM_SANDBOX_ASSET_PROVISION'
/**
 * The ONLY provisioning roots outside the Team trees, and the only reason a
 * `DSH_TEAM_SANDBOX_ASSET_SOURCE` outside this repo is ever accepted: the
 * read-only shared baseline the runtime checkouts are cloned from
 * (`docs/TEST_METHODS.md` §6/§9 — branch `stable-3-0.2.0-rc.2`, never written).
 * Anything else — a temp dir, a download, another user's tree — is refused,
 * because the source tree's entry module is imported while its layout is
 * resolved: the source path chooses which code this process runs.
 */
export const SHARED_BASELINE_ROOTS = Object.freeze([
  '/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness',
])

/** Provisioning failures that must ABORT the run (supply-chain, not env). */
export const FATAL_PROVISION_CODES = Object.freeze([
  'SOURCE_DIGEST_MISMATCH',
  'DESTINATION_DIGEST_MISMATCH',
  'MANIFEST_ENTRY_MISSING',
  'PLATFORM_UNMANIFESTED',
  'LIBC_VARIANT_UNMANIFESTED',
  'WRITES_OUTSIDE_PLATFORM_BIN',
  'SOURCE_IS_DESTINATION',
  'SOURCE_TREE_MISSING',
  'SOURCE_TREE_NOT_A_DIRECTORY',
  'SOURCE_TREE_OUTSIDE_ALLOWED_ROOTS',
  'MANIFEST_PATH_UNSAFE',
  'MANIFEST_MODE_INVALID',
  'PUBLISHED_MODE_MISMATCH',
  'ASSET_MODE_DRIFT',
])

/** The host's own typed "no backend" signals, as they reach a tool result. */
const SANDBOX_UNAVAILABLE_MARKERS = Object.freeze([
  Object.freeze({ id: 'typed-message', needle: 'no sandbox backend is usable on this host' }),
  Object.freeze({ id: 'typed-code', needle: 'SANDBOX_UNAVAILABLE' }),
  Object.freeze({ id: 'typed-slug', needle: '(sandbox-unavailable)' }),
  Object.freeze({ id: 'typed-class', needle: 'SandboxUnavailableError' }),
])

/**
 * The pre-flight records this module MINTED (review round 1, F1). A judge must
 * be able to tell "the host was probed" from "an object was written": the shape
 * of a record is public (it is in this file and in every RUN record), so shape
 * proves nothing. Identity is unforgeable from outside this module, and it does
 * not survive serialisation — which is exactly right, because a re-typed copy is
 * a claim about a probe, not a probe.
 */
const PREFLIGHT_RECORDS = new WeakSet()

export class HostSandboxAssetError extends Error {
  /** @param {string} code typed machine-readable code (see FATAL_PROVISION_CODES) */
  constructor(code, detail) {
    super(`host-sandbox-assets: ${code}: ${detail}`)
    this.name = 'HostSandboxAssetError'
    this.code = code
  }
}

const sha256File = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
// R-MODEBITS (2026-10-29, external review): the mask the mode re-checks use
// covers the FULL relevant mode — setuid/setgid/sticky included, not just
// 0o777. Manifest pins are 3 octal digits (MANIFEST_MODE_RE) and chmod only
// ever applies those 3 bits, so a conforming file NEVER carries a special
// bit: comparing 0o7777 makes ANY special bit read as drift (e.g. a 0o4600
// asset whose low bits match the pin), while modeString keeps reporting the
// classic 3-digit permission string.
const modeOf = (p) => statSync(p).mode & 0o7777
const modeString = (p) => `0o${(modeOf(p) & 0o777).toString(8)}`
const gitText = (args, cwd) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })
const realpathOrNull = (p) => { try { return realpathSync(p) } catch { return null } }

/** The ONE spelling a manifest may pin a mode with: `0o` + exactly three octal digits. */
const MANIFEST_MODE_RE = /^0o[0-7]{3}$/

/**
 * The pinned mode of one manifested file, as bits. A pin this module cannot
 * parse is never quietly replaced by a default: the published file would then
 * carry a mode no one pinned (review round 1, F7).
 * @throws {HostSandboxAssetError} MANIFEST_MODE_INVALID
 */
export function parseManifestMode(value, relPath = '(asset)') {
  if (typeof value !== 'string' || !MANIFEST_MODE_RE.test(value)) {
    throw new HostSandboxAssetError('MANIFEST_MODE_INVALID', `${relPath}: the manifest pins mode ${JSON.stringify(value)}, which is not ${MANIFEST_MODE_RE} — refusing instead of publishing a file under a mode nobody pinned`)
  }
  return Number.parseInt(value.slice(2), 8)
}

/**
 * Is a manifest-declared relative path safe to publish? It must be a plain
 * relative path, with no `.`/`..`/empty segments and no drive or leading
 * separator, and it must stay inside the platform package's `bin/` subtree —
 * checked on the STRING, before anything is joined onto a real directory
 * (review round 1, F6: the containment check used to run after the write).
 */
export function manifestAssetPathIsSafe(rel) {
  if (typeof rel !== 'string' || rel.length === 0) return false
  if (rel.includes('\0') || isAbsolute(rel) || /^[a-zA-Z]:[\\/]|^[\\/]/.test(rel)) return false
  const segments = rel.split(/[\\/]/)
  if (segments.some((s) => s === '' || s === '.' || s === '..')) return false
  if (segments[0] !== 'bin' || segments.length < 2) return false
  // Belt and braces: containment of the normalised join inside `bin`.
  const relFromBin = relative('bin', join(...segments))
  return relFromBin !== '' && !relFromBin.startsWith('..') && !isAbsolute(relFromBin)
}

/** `git status --porcelain` of a tree, as an evidence-shaped object. */
export function porcelainState(tree) {
  const r = gitText(['status', '--porcelain'], tree)
  if (r.status !== 0) return { available: false, empty: false, reason: `git status exited ${String(r.status)}`, lines: [] }
  const lines = String(r.stdout ?? '').split('\n').filter((l) => l.trim() !== '')
  return { available: true, empty: lines.length === 0, lines: lines.slice(0, 8) }
}

/** The libc variant the host's own flock loader would pick (mirrors its heuristic). */
export function detectedLibcVariant() {
  if (process.platform !== 'linux') return null
  try {
    const report = process.report.getReport()
    const glibc = report?.header?.glibcVersionRuntime
    return glibc ? 'glibc' : 'musl'
  } catch {
    return 'unknown'
  }
}

/**
 * Resolve the launcher the way the HOST resolves it: import the runtime tree's
 * own entry module and ask it. The returned path is the destination for
 * provisioning AND the path the host will exec — one resolution, no second
 * spelling of the layout.
 * @throws {HostSandboxAssetError} ENTRY_MODULE_MISSING | LAUNCHER_PATH_UNRESOLVED
 */
export async function resolveHostSandboxLayout(runtimeTree) {
  const tree = resolve(runtimeTree)
  const entryModulePath = join(tree, 'native', 'system', 'packages', 'entry', 'lib', 'index.js')
  if (!existsSync(entryModulePath)) {
    throw new HostSandboxAssetError('ENTRY_MODULE_MISSING', `no host sandbox entry module at ${entryModulePath} (is ${tree} a runtime checkout at the pinned baseline?)`)
  }
  const mod = await import(pathToFileURL(entryModulePath).href)
  if (typeof mod.launcherPath !== 'function' || typeof mod.probe !== 'function') {
    throw new HostSandboxAssetError('ENTRY_MODULE_SHAPE', `${entryModulePath} exports neither launcherPath() nor probe() — unknown host generation`)
  }
  const platformPackage = `@deepseek-ai/node-addon-system-${process.platform}-${process.arch}`
  const launcherPath = mod.launcherPath()
  const binDir = dirname(launcherPath)
  const platformDir = dirname(binDir)
  // The entry module's documented fallback (an UNRESOLVED platform package)
  // points inside the entry package's own node_modules. That is the shape of
  // an uninstalled tree, not of a provisionable one: refuse rather than create
  // a directory the host does not treat as the platform package.
  const entryDir = join(tree, 'native', 'system', 'packages', 'entry')
  if (launcherPath.startsWith(entryDir + sep)) {
    throw new HostSandboxAssetError('LAUNCHER_PATH_UNRESOLVED', `${platformPackage} does not resolve inside ${tree} (launcherPath fell back to ${launcherPath}); install the runtime tree's dependencies first (docs/TEST_METHODS.md §2)`)
  }
  if (!launcherPath.startsWith(tree + sep)) {
    throw new HostSandboxAssetError('LAUNCHER_PATH_OUTSIDE_TREE', `launcherPath resolved outside the runtime tree: ${launcherPath}`)
  }
  return { runtimeTree: tree, entryModulePath, platformPackage, platformDir, binDir, launcherPath, module: mod }
}

/** Read the committed pinned manifest. Fails closed on an unreadable/void file. */
export function readHostSandboxAssetManifest({ repoRoot } = {}) {
  const root = resolve(repoRoot ?? DEFAULT_REPO_ROOT)
  const path = join(root, MANIFEST_REL)
  let parsed
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'))
  } catch (error) {
    throw new HostSandboxAssetError('MANIFEST_UNREADABLE', `${path}: ${String(error?.message ?? error)}`)
  }
  if (parsed?.schema !== HOST_SANDBOX_ASSETS_SCHEMA || typeof parsed.entries !== 'object' || parsed.entries === null) {
    throw new HostSandboxAssetError('MANIFEST_SCHEMA', `${path}: expected schema ${HOST_SANDBOX_ASSETS_SCHEMA}`)
  }
  return parsed
}

/** The manifest's file set for one baseline + platform (typed fail-closed). */
export function manifestPlatformEntry(manifest, { version, sha, platform, libc }) {
  const key = `${version}@${sha}`
  const entry = manifest.entries[key]
  if (!entry) {
    throw new HostSandboxAssetError('MANIFEST_ENTRY_MISSING', `no pinned asset entry for host baseline ${key} (manifest carries: ${Object.keys(manifest.entries).join(', ') || 'none'}) — pin the digests before provisioning`)
  }
  const p = entry.platforms?.[platform]
  if (!p) {
    throw new HostSandboxAssetError('PLATFORM_UNMANIFESTED', `no pinned asset entry for platform ${platform} at ${key}`)
  }
  if (typeof p.libc === 'string' && libc !== null && p.libc !== libc) {
    throw new HostSandboxAssetError('LIBC_VARIANT_UNMANIFESTED', `manifest pins ${p.libc} addons for ${platform}, this host is ${libc} — a wrong-libc Node-API addon is never a usable substitute`)
  }
  if (typeof p.launcher !== 'string' || !Object.prototype.hasOwnProperty.call(p.files ?? {}, p.launcher)) {
    throw new HostSandboxAssetError('PLATFORM_UNMANIFESTED', `platform entry for ${platform} names no manifested launcher`)
  }
  return p
}

/** The default LOCAL source tree (documented; env override wins). */
export function defaultSourceTree({ repoRoot } = {}) {
  const override = process.env[SOURCE_TREE_ENV]
  if (override !== undefined && override !== '') return { tree: resolve(override), kind: 'env' }
  const root = resolve(repoRoot ?? process.cwd())
  const main = findTestRepoRoot(root) ?? root
  return { tree: testUseTree(main), kind: 'default-team-checkout', kindDetail: main }
}

/**
 * The trees a provisioning source may live in, as realpaths: the Team repo root
 * the caller names (and, from a task worktree, the MAIN checkout that owns the
 * default runtime tree), this module's own tree when no root was named, and
 * `SHARED_BASELINE_ROOTS`. Read-only evidence of what the rule permits — the
 * decision itself is made by `assertTrustedSourceTree`.
 */
export function allowedSourceRoots({ repoRoot } = {}) {
  const seeds = repoRoot === undefined || repoRoot === null
    ? [resolve(process.cwd()), DEFAULT_REPO_ROOT]
    : [resolve(repoRoot)]
  const roots = new Set()
  for (const seed of seeds) {
    const real = realpathOrNull(seed)
    if (real !== null) roots.add(real)
    const main = findTestRepoRoot(seed)
    const mainReal = main === null ? null : realpathOrNull(main)
    if (mainReal !== null) roots.add(mainReal)
  }
  for (const documented of SHARED_BASELINE_ROOTS) {
    const real = realpathOrNull(documented)
    if (real !== null) roots.add(real)
  }
  return [...roots].sort()
}

/**
 * THE trust gate for a provisioning source (review round 1, F5). The source is
 * not just bytes: `resolveHostSandboxLayout()` imports the source tree's own
 * entry module to learn the layout, so an unvalidated path makes this process
 * execute foreign code with the digests nodding along. Hence — before anything
 * is read from it: it must exist, it must be a directory, and its REALPATH must
 * stay inside `allowedSourceRoots()` (a symlink that escapes, or a `..` that
 * does, fails exactly like an absolute foreign path).
 * @returns {{tree: string, realTree: string, roots: string[]}}
 * @throws {HostSandboxAssetError} SOURCE_TREE_MISSING | SOURCE_TREE_NOT_A_DIRECTORY
 *         | SOURCE_TREE_OUTSIDE_ALLOWED_ROOTS
 */
export function assertTrustedSourceTree(tree, { repoRoot } = {}) {
  const given = resolve(tree)
  const real = realpathOrNull(given)
  if (real === null) {
    throw new HostSandboxAssetError('SOURCE_TREE_MISSING', `${given}: no such provisioning source — the source is a LOCAL tree (docs/TEST_METHODS.md §9), never a download`)
  }
  if (!statSync(real).isDirectory()) {
    throw new HostSandboxAssetError('SOURCE_TREE_NOT_A_DIRECTORY', `${given} (real path ${real}) is not a directory; a provisioning source is a runtime tree`)
  }
  const roots = allowedSourceRoots({ repoRoot })
  if (!roots.some((root) => real === root || real.startsWith(root + sep))) {
    throw new HostSandboxAssetError('SOURCE_TREE_OUTSIDE_ALLOWED_ROOTS', `${given}${given === real ? '' : ` (symlink/realpath ${real})`} is outside every trusted provisioning root [${roots.join(', ')}] — resolving a source tree imports its entry module, so only the Team trees and the documented shared baseline (${SHARED_BASELINE_ROOTS.join(', ')}) may be a source (docs/TEST_METHODS.md §9)`)
  }
  return { tree: given, realTree: real, roots }
}

/**
 * Provision the pinned native sandbox assets into one runtime tree.
 * @param {object} opts
 * @param {string} opts.runtimeTree destination runtime checkout (writes only under its platform `bin/`)
 * @param {string} [opts.sourceTree] explicit LOCAL source tree (default: env override → main Team checkout)
 * @param {string} [opts.repoRoot] Team repo root (manifest + default source lookup)
 * @param {object} [opts.manifest] manifest override (tests; defaults to the committed file)
 * @returns {Promise<object>} the provenance record
 */
export async function provisionHostSandboxAssets({ runtimeTree, sourceTree = null, repoRoot, manifest = null } = {}) {
  const layout = await resolveHostSandboxLayout(runtimeTree)
  const m = manifest ?? readHostSandboxAssetManifest({ repoRoot })
  const libc = detectedLibcVariant()
  const pinned = manifestPlatformEntry(m, {
    version: DSH_BASELINE_VERSION, sha: TEST_USE_BASELINE_SHA, platform: `${process.platform}-${process.arch}`, libc,
  })
  const relPaths = Object.keys(pinned.files).sort()
  const baseline = { version: DSH_BASELINE_VERSION, sha: TEST_USE_BASELINE_SHA, manifestKey: `${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA}` }

  // (0) WRITE SCOPE AND MODE, BEFORE ANY FILESYSTEM MUTATION (review round 1,
  // F6 + F7). A manifest is data this module does not trust blindly: a key is a
  // path the provisioner is about to create, so it must be a plain relative path
  // contained in the platform package's `bin/`, and its pinned mode must be a
  // mode this module can apply and re-check. Both are decided here — the old
  // order (mkdir/copy/rename, then "is this inside bin/?") left the stray file
  // behind for the next human to find.
  const modeBits = new Map()
  for (const rel of [...relPaths, pinned.launcher]) {
    if (!manifestAssetPathIsSafe(rel)) {
      throw new HostSandboxAssetError('MANIFEST_PATH_UNSAFE', `${baseline.manifestKey}: platform entry declares ${JSON.stringify(rel)}, which is not a relative path contained in the platform package's bin/ subtree — absolute paths, \`..\` and \`.\` segments are refused before any mkdir/copy/rename in ${layout.runtimeTree}`)
    }
    // The same containment re-checked against what the HOST resolved as bin/:
    // the string rule and the resolved layout must agree before we act on either.
    const abs = join(layout.platformDir, rel)
    if (!abs.startsWith(layout.binDir + sep)) {
      throw new HostSandboxAssetError('MANIFEST_PATH_UNSAFE', `${baseline.manifestKey}: ${JSON.stringify(rel)} resolves to ${abs}, outside the bin/ the host resolved (${layout.binDir}) — nothing was written to ${layout.runtimeTree}`)
    }
    if (Object.prototype.hasOwnProperty.call(pinned.files, rel)) {
      modeBits.set(rel, parseManifestMode(pinned.files[rel].mode, rel))
    }
  }

  // (1) Destination first: everything already matches ⇒ write nothing at all.
  const destination = relPaths.map((rel) => {
    const path = join(layout.platformDir, rel)
    const spec = pinned.files[rel]
    const present = existsSync(path)
    const sha256 = present ? sha256File(path) : null
    return { relPath: rel, role: rel === pinned.launcher ? 'launcher' : 'addon', path, present, sha256, expectedSha256: spec.sha256, bytes: spec.bytes, mode: spec.mode, modeBits: modeBits.get(rel) }
  })
  const missing = destination.filter((f) => !f.present)
  for (const f of destination) {
    if (!f.present) continue
    if (f.sha256 !== f.expectedSha256) {
      throw new HostSandboxAssetError('DESTINATION_DIGEST_MISMATCH', `${f.relPath} in ${layout.runtimeTree} hashes ${f.sha256}, the pinned manifest says ${f.expectedSha256} — the runner never overwrites bytes it did not create`)
    }
    // R-ASSET-MODE-1 (2026-10-29): the present path used to verify the digest
    // and RETURN without re-verifying the pinned mode bits, so a drifted mode
    // (e.g. a lost +x) was later misattributed to the host environment. The
    // pin covers the mode as well as the bytes (F7): re-check it on EVERY
    // present file — the fully-present return path and the mixed
    // present+missing provisioned path alike. R-MODEBITS (2026-10-29): the
    // comparison runs on the FULL mode (0o7777), so setuid/setgid/sticky are
    // drift too — a pin (3 octal digits) can never carry them.
    const actualMode = modeOf(f.path)
    if (actualMode !== f.modeBits) {
      throw new HostSandboxAssetError('ASSET_MODE_DRIFT', `${f.relPath} in ${layout.runtimeTree} is mode 0o${actualMode.toString(8)}, the manifest pins ${f.mode} — the bytes match the pin but the mode drifted; this is a provisioning-state finding, refused instead of reported present, and the file is left in place for a human`)
    }
  }
  const porcelainBefore = porcelainState(layout.runtimeTree)
  if (missing.length === 0) {
    return provenance({
      layout, pinned, baseline, libc, action: 'present', bytesWritten: 0, source: null, porcelainBefore,
      files: destination.map((f) => ({ ...f, state: 'present', mode: modeString(f.path), bytesWritten: 0 })),
    })
  }

  // (2) Only a copy is needed from here on: resolve and validate the SOURCE.
  const src = sourceTree === null || sourceTree === undefined
    ? defaultSourceTree({ repoRoot })
    : { tree: resolve(sourceTree), kind: 'explicit' }
  // (2a) The source is not only bytes: the next lines import its entry module to
  // learn the layout, so an unvalidated override would make this process execute
  // whatever JS that tree holds — digests cannot vouch for code. Trust is settled
  // before the first read (review round 1, F5).
  src.realTree = assertTrustedSourceTree(src.tree, { repoRoot }).realTree
  if (src.tree === layout.runtimeTree) {
    throw new HostSandboxAssetError('SOURCE_IS_DESTINATION', `the provisioning source resolves to the destination tree (${src.tree}) and the assets are not present there — name a source tree with \`--source-tree\` or ${SOURCE_TREE_ENV}`)
  }
  const sourceFiles = new Map()
  // The source is validated through the SAME host resolution as the destination
  // (so a source tree of another generation, or one whose platform package does
  // not resolve, is refused instead of silently mis-copied).
  const sourceLayout = await resolveHostSandboxLayout(src.tree)
  for (const f of destination.filter((d) => !d.present)) {
    const rel = f.relPath
    if (rel === pinned.launcher && sourceLayout.launcherPath !== join(sourceLayout.platformDir, rel)) {
      throw new HostSandboxAssetError('SOURCE_LAYOUT_MISMATCH', `${src.tree} resolves its launcher to ${sourceLayout.launcherPath}, not ${join(sourceLayout.platformDir, rel)}`)
    }
    const path = join(sourceLayout.platformDir, rel)
    if (!existsSync(path)) {
      throw new HostSandboxAssetError('SOURCE_ASSET_MISSING', `${rel} is absent from the source tree ${src.tree} (kind ${src.kind}) — provisioning copies LOCAL pinned bytes only, it never downloads them`)
    }
    const sha256 = sha256File(path)
    if (sha256 !== f.expectedSha256) {
      throw new HostSandboxAssetError('SOURCE_DIGEST_MISMATCH', `${rel} in ${src.tree} hashes ${sha256}, the pinned manifest (${baseline.manifestKey}) says ${f.expectedSha256} — the copy was refused and nothing was written to ${layout.runtimeTree}`)
    }
    sourceFiles.set(rel, { path, sha256, bytes: statSync(path).size })
  }

  // (3) Stage → verify → publish. Nothing reaches the published name until the
  // staged bytes have hashed correctly.
  let bytesWritten = 0
  const written = []
  try {
    for (const f of destination.filter((d) => !d.present)) {
      const srcFile = sourceFiles.get(f.relPath)
      const stage = `${f.path}.u7-sbx-staging`
      mkdirSync(dirname(f.path), { recursive: true })
      copyFileSync(srcFile.path, stage)
      const stagedSha = sha256File(stage)
      if (stagedSha !== f.expectedSha256) {
        throw new HostSandboxAssetError('STAGED_DIGEST_MISMATCH', `${f.relPath} hashed ${stagedSha} after the copy, expected ${f.expectedSha256}`)
      }
      chmodSync(stage, f.modeBits)
      renameSync(stage, f.path)
      const published = sha256File(f.path)
      if (published !== f.expectedSha256) {
        unlinkSync(f.path)
        throw new HostSandboxAssetError('PUBLISHED_DIGEST_MISMATCH', `${f.relPath} hashed ${published} after publish, expected ${f.expectedSha256} — the file was removed again`)
      }
      // The published MODE is part of the pin (F7): the launcher must be
      // executable the way the manifest says, and a file this module just wrote
      // is removed again if the mode on disk drifted from the pin.
      const publishedMode = modeOf(f.path)
      if (publishedMode !== f.modeBits) {
        unlinkSync(f.path)
        throw new HostSandboxAssetError('PUBLISHED_MODE_MISMATCH', `${f.relPath} is mode 0o${publishedMode.toString(8)} after publish, the manifest pins ${f.mode} — the file was removed again rather than left un-/over-executable`)
      }
      if (!f.path.startsWith(layout.binDir + sep)) {
        throw new HostSandboxAssetError('WRITES_OUTSIDE_PLATFORM_BIN', `refusing to keep ${f.path} outside ${layout.binDir}`)
      }
      bytesWritten += srcFile.bytes
      written.push({ ...f, state: 'copied', sha256: published, bytesWritten: srcFile.bytes, mode: modeString(f.path) })
    }
  } catch (error) {
    // No half-written asset survives a failure at any point of the loop.
    for (const f of destination.filter((d) => !d.present)) {
      const stage = `${f.path}.u7-sbx-staging`
      if (existsSync(stage)) rmSync(stage, { force: true })
      const publishedEarly = written.find((w) => w.relPath === f.relPath)
      if (publishedEarly !== undefined && existsSync(f.path)) rmSync(f.path, { force: true })
    }
    throw error
  }

  const sourceHead = gitText(['rev-parse', 'HEAD'], src.tree)
  const runtimeHead = sourceHead.status === 0 ? String(sourceHead.stdout ?? '').trim() : null
  const files = destination.map((f) => written.find((w) => w.relPath === f.relPath) ?? {
    ...f, state: 'present', mode: modeString(f.path), bytesWritten: 0,
  })
  return provenance({
    layout, pinned, baseline, libc, action: 'provisioned', files, bytesWritten, porcelainBefore,
    source: {
      kind: src.kind, tree: src.tree, realTree: src.realTree ?? null, runtimeHead,
      headEvidence: runtimeHead === null ? 'unavailable (source tree is not a git checkout)' : 'git rev-parse HEAD',
      headMatchesPinnedBaseline: runtimeHead === null ? 'unknown' : runtimeHead === TEST_USE_BASELINE_SHA,
    },
  })
}

function provenance({
  layout, pinned, baseline, libc, action, files, bytesWritten, source, porcelainBefore,
}) {
  const porcelainAfter = porcelainState(layout.runtimeTree)
  return {
    schema: HOST_SANDBOX_ASSETS_SCHEMA,
    at: new Date().toISOString(),
    action,
    runtimeTree: layout.runtimeTree,
    platformDir: layout.platformDir,
    launcherPath: layout.launcherPath,
    baseline,
    platform: `${process.platform}-${process.arch}`,
    libc,
    manifestLauncher: pinned.launcher,
    source,
    files: files.map((f) => ({
      relPath: f.relPath, role: f.role, state: f.state, sha256: f.sha256 ?? null,
      expectedSha256: f.expectedSha256, bytes: f.bytes ?? null, mode: f.mode ?? null,
    })),
    bytesWritten,
    porcelainBefore: { empty: porcelainBefore.empty, available: porcelainBefore.available },
    porcelainAfter: { empty: porcelainAfter.empty, available: porcelainAfter.available, lines: porcelainAfter.lines },
  }
}

/**
 * Run the HOST's own functional probe against one runtime tree. No verdict of
 * our own: `full` / `partial` / `unusable` is what `probe()` answered.
 */
export async function probeHostSandboxBackend(runtimeTree) {
  const layout = await resolveHostSandboxLayout(runtimeTree)
  const present = existsSync(layout.launcherPath)
  const verdict = layout.module.probe(layout.launcherPath)
  return {
    backend: verdict,
    launcherPath: layout.launcherPath,
    launcherPresent: present,
    launcherSha256: present ? sha256File(layout.launcherPath) : null,
    launcherMode: present ? modeString(layout.launcherPath) : null,
  }
}

/**
 * The C2 pre-flight, recorded BEFORE the first Host start.
 * Order is the point: probe FIRST (that is what the Host would have seen),
 * provision SECOND, re-probe THIRD. A missing backend is written down as a
 * verdict plus provenance; it never becomes a product verdict here.
 * @param {object} opts
 * @param {boolean} [opts.provision] copy pinned bytes when the launcher is absent
 * @param {boolean} [opts.throwOnProbeError] rethrow when the tree cannot even be probed
 */
export async function preflightHostSandbox({
  runtimeTree, sourceTree = null, repoRoot, manifest = null,
  provision = process.env[PROVISION_ENV] !== '0' && process.env[PROVISION_ENV] !== 'false',
  throwOnProbeError = false,
} = {}) {
  const baseline = { version: DSH_BASELINE_VERSION, sha: TEST_USE_BASELINE_SHA }
  const base = {
    schema: SANDBOX_PREFLIGHT_SCHEMA,
    at: new Date().toISOString(),
    probed: false,
    runtimeTree: resolve(runtimeTree),
    baseline,
    platform: `${process.platform}-${process.arch}`,
    libc: detectedLibcVariant(),
    backend: 'unknown',
    usable: false,
    launcherPath: null,
    launcherPresent: false,
    launcherSha256: null,
    verdicts: [],
    asset: null,
    provisionError: null,
    probeError: null,
    porcelainEmpty: null,
  }
  // Branded from the first moment it exists: every path this function returns
  // (probe error included) is an object this module produced.
  PREFLIGHT_RECORDS.add(base)
  let probe1
  try {
    probe1 = await probeHostSandboxBackend(runtimeTree)
  } catch (error) {
    base.probeError = { code: error?.code ?? 'PROBE_FAILED', message: String(error?.message ?? error) }
    if (throwOnProbeError) throw error
    return base
  }
  base.probed = true
  base.launcherPath = probe1.launcherPath
  base.verdicts.push({ phase: 'before-provision', backend: probe1.backend, launcherPresent: probe1.launcherPresent })
  base.backend = probe1.backend
  base.launcherPresent = probe1.launcherPresent
  base.launcherSha256 = probe1.launcherSha256

  if (probe1.backend === 'unusable' && provision) {
    try {
      base.asset = await provisionHostSandboxAssets({ runtimeTree, sourceTree, repoRoot, manifest })
    } catch (error) {
      const code = error instanceof HostSandboxAssetError ? error.code : 'PROVISION_FAILED'
      if (FATAL_PROVISION_CODES.includes(code)) throw error
      base.provisionError = { code, message: String(error?.message ?? error) }
    }
    const probe2 = await probeHostSandboxBackend(runtimeTree)
    base.verdicts.push({ phase: 'after-provision', backend: probe2.backend, launcherPresent: probe2.launcherPresent })
    base.backend = probe2.backend
    base.launcherPresent = probe2.launcherPresent
    base.launcherSha256 = probe2.launcherSha256
  }
  if (!base.verdicts.some((v) => v.phase === 'after-provision')) {
    base.verdicts.push({ phase: 'after-provision', backend: base.backend, launcherPresent: base.launcherPresent })
  }
  base.usable = base.backend === 'full' || base.backend === 'partial'
  const porcelain = porcelainState(base.runtimeTree)
  base.porcelainEmpty = porcelain.available ? porcelain.empty : null
  base.porcelain = porcelain
  return base
}

/**
 * Detect the host's TYPED "no sandbox backend is usable" signal in observed
 * lane output. Specific on purpose: a generic permission/namespace/timeout
 * failure must never read as an environment block.
 * @returns {{present: boolean, markers: string[], head: string|null}}
 */
export function sandboxUnavailableSignal(text) {
  const t = typeof text === 'string' ? text : ''
  const markers = SANDBOX_UNAVAILABLE_MARKERS.filter((m) => t.includes(m.needle)).map((m) => m.id)
  return { present: markers.length > 0, markers, head: markers.length > 0 ? t.slice(0, 200) : null }
}

/**
 * Is this an actual measurement? Identity FIRST, shape second: only an object
 * `preflightHostSandbox()` returned in this process carries the brand, and it
 * must still look like a completed probe. A hand-built object with the same
 * fields, a spread clone, and a JSON round-trip of a real record are all
 * refusals — see law 7 and T22.
 */
export function isSandboxPreflightRecord(value) {
  if (value === null || typeof value !== 'object') return false
  if (!PREFLIGHT_RECORDS.has(value)) return false
  return value.schema === SANDBOX_PREFLIGHT_SCHEMA
    && value.probed === true
    && typeof value.backend === 'string'
}

/**
 * THE gate for ENV_BLOCK on a native (non-governed) confinement control.
 * Both halves are required, and the caller applies it only on a leg that has
 * ALREADY failed its functional assertions:
 *   · a real pre-flight record whose probe answered `unusable`, AND
 *   · the host's typed unavailable signal in what the lane actually observed.
 * Everything else returns null (⇒ the leg stays FAIL).
 * @param {object} args
 * @param {string} [args.observedText] raw lane output (tool_result text)
 * @param {{present: boolean, markers?: string[], head?: string|null}} [args.observedSignal]
 *        a signal the runner already extracted through sandboxUnavailableSignal
 * @param {object} [args.preflight] the pre-flight record for this run
 */
export function nativeConfinementEnvBlock({ observedText = '', observedSignal = null, preflight = null } = {}) {
  const signal = observedSignal !== null && typeof observedSignal === 'object'
    ? { present: observedSignal.present === true, markers: observedSignal.markers ?? [], head: observedSignal.head ?? null }
    : sandboxUnavailableSignal(observedText)
  if (signal.present !== true) return null
  if (!isSandboxPreflightRecord(preflight)) return null
  if (preflight.backend !== 'unusable') return null
  return {
    typedSignal: signal,
    sandboxPreflight: {
      backend: preflight.backend,
      usable: preflight.usable === true,
      launcherPath: preflight.launcherPath ?? null,
      launcherPresent: preflight.launcherPresent === true,
      launcherSha256: preflight.launcherSha256 ?? null,
      verdicts: preflight.verdicts ?? null,
      provisionError: preflight.provisionError ?? null,
      at: preflight.at ?? null,
    },
    note: 'the native (non-governed) confinement control could not run because the host reports NO usable sandbox backend, and the lane observed exactly that typed refusal — an environment/provisioning gap, recorded as ENV_BLOCK (never PASS, never a product FAIL)',
  }
}
