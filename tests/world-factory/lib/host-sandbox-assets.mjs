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
 *   2. **Two transports, one pin.** (a) LOCAL COPY (the default, no network):
 *      source is an explicit LOCAL tree (default: the main Team checkout's own
 *      runtime tree; override with `DSH_TEAM_SANDBOX_ASSET_SOURCE`); the source
 *      tree is never a write target. Because law 1 means resolving a source
 *      tree IMPORTS its entry module, the override is not free-form: it must be
 *      an existing directory whose REALPATH stays inside a Team tree or the one
 *      documented shared baseline (`SHARED_BASELINE_ROOTS`). A digest pins
 *      bytes; it cannot pin the code of the tree those bytes are read by.
 *      (b) PINNED PACKAGE (`provisionHostSandboxAssetsFromPackage`, 2026-11-16):
 *      the pinned bytes are fetched from the PINNED PUBLISHED npm package
 *      (exact name@version from the manifest's `packages` block), verified
 *      against the registry's `dist.integrity` (sha512) AND a committed
 *      tarball sha256, then per-file sha256+length+mode verified. This exists
 *      because a hosted runner's own host build produces DIFFERENT bytes
 *      (`bin/glibc/system.node` measured `dfa6d586…` on the runner vs the pin
 *      `54a9c25c…`), and THE FIXED PUBLISHED ASSET — not the runner's build —
 *      is the standard. The package transport may replace destination bytes it
 *      did not create; the local-copy transport never does (law 4 stays).
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
  chmodSync, copyFileSync, existsSync, lstatSync, mkdirSync, mkdtempSync, readFileSync,
  realpathSync, renameSync, rmSync, statSync, unlinkSync, writeFileSync,
} from 'node:fs'
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { gunzipSync } from 'node:zlib'
import { DSH_BASELINE_VERSION, findTestRepoRoot, NEXT_HOST, TEST_USE_BASELINE_SHA, testUseTree } from '../../paths.mjs'

/**
 * The Host baseline a provisioning run is FOR. `legacy` (the default) is the
 * pin in `tests/paths.mjs`'s legacy block; `next` is the second pinned Host
 * (`NEXT_HOST`). There is no free-form form: a caller names one of the pins this
 * repository commits, so a provisioning run can never invent a baseline.
 */
export const HOST_BASELINES = Object.freeze({
  legacy: Object.freeze({ host: 'legacy', version: DSH_BASELINE_VERSION, sha: TEST_USE_BASELINE_SHA }),
  next: Object.freeze({ host: 'next', version: NEXT_HOST.version, sha: NEXT_HOST.sha }),
})

/** @throws {HostSandboxAssetError} HOST_BASELINE_UNKNOWN */
export function resolveHostBaseline(host = null) {
  if (host === null || host === undefined) return HOST_BASELINES.legacy
  const found = typeof host === 'string' ? HOST_BASELINES[host] : null
  if (found === undefined || found === null) {
    throw new HostSandboxAssetError('HOST_BASELINE_UNKNOWN', `unknown host baseline ${JSON.stringify(host)}; this repository pins only ${Object.keys(HOST_BASELINES).join(' / ')} (tests/paths.mjs) — a baseline is never typed in free-form`)
  }
  return found
}

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
  'DESTINATION_NOT_REGULAR_FILE',
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
export async function provisionHostSandboxAssets({ runtimeTree, sourceTree = null, repoRoot, manifest = null, host = null } = {}) {
  const layout = await resolveHostSandboxLayout(runtimeTree)
  const m = manifest ?? readHostSandboxAssetManifest({ repoRoot })
  const libc = detectedLibcVariant()
  const pin = resolveHostBaseline(host)
  const pinned = manifestPlatformEntry(m, {
    version: pin.version, sha: pin.sha, platform: `${process.platform}-${process.arch}`, libc,
  })
  const relPaths = Object.keys(pinned.files).sort()
  const baseline = { host: pin.host, version: pin.version, sha: pin.sha, manifestKey: `${pin.version}@${pin.sha}` }

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
    // Before ANY read: a FIFO/socket/device/hardlink/directory destination must
    // refuse, not block (this is the shape that cost a 41-minute cancelled job).
    assertRegularDestinationFile(layout.platformDir, rel, baseline.manifestKey)
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
      assertStagePathWritable(stage, f.relPath, baseline.manifestKey)
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
      headMatchesPinnedBaseline: runtimeHead === null ? 'unknown' : runtimeHead === baseline.sha,
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
  throwOnProbeError = false, host = null,
} = {}) {
  const pin = resolveHostBaseline(host)
  const baseline = { host: pin.host, version: pin.version, sha: pin.sha }
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
      base.asset = await provisionHostSandboxAssets({ runtimeTree, sourceTree, repoRoot, manifest, host })
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

// ─────────────────────── package transport (2026-11-16) ───────────────────────
/**
 * THE SECOND TRANSPORT: the pinned bytes from the PINNED PUBLISHED PACKAGE.
 *
 * WHY (measured 2026-11-16; see docs/plans/memo/host-assets-20261116/README.md).
 * The hosted `census-runtime` job CANNOT carry the pinned bytes from a local
 * tree, and it does not need to: its own host build produces `bin/` files with
 * DIFFERENT digests (measured `bin/glibc/system.node` = `dfa6d586…` on the
 * runner vs the pin `54a9c25c…`, hosted job 132898455498). The M7-A step used
 * to accept that as a named DISCLOSED_REFUSAL. The owner's decision is the
 * opposite: the FIXED PUBLISHED ASSET is the standard, the runner's build is
 * not, and the existing sha256 pin must not move to match a build.
 *
 * THE ORDER, AND WHY IT IS THE ORDER (fail closed at every step, nothing is
 * written before the last verification):
 *   1. the spec is `name@EXACT_VERSION` — no ranges, no tags, no `latest`;
 *   2. the version/name must equal the manifest's `packages` pin, and that
 *      pin's file table must EQUAL the host pin in `entries` (one standard,
 *      two spellings — divergence is refused, never reconciled);
 *   3. the registry metadata for that exact version must carry a `sha512-`
 *      `dist.integrity` equal to the pinned one (missing ⇒ refusal, a different
 *      one ⇒ refusal: "unknown integrity" is not a weaker pin);
 *   4. the tarball bytes must match BOTH that SRI (sha512) AND the committed
 *      `tarballSha256` (and its byte length when pinned);
 *   5. the extracted `bin/` subtree must be EXACTLY the pin's install set plus
 *      the pinned siblings (the real tarball also carries `bin/musl/system.node`;
 *      everything under `bin/` is pinned, so an unaccounted file is refused);
 *   6. every installed file is re-checked for sha256 AND byte length against the
 *      manifest before a byte is written, staged beside its destination,
 *      re-hashed, chmodded to the PINNED mode, renamed into place and re-read;
 *   7. a receipt binds package spec, version, tarball sha256, dist.integrity,
 *      per-file digests, host sha, UTC time and the manifest digest.
 *
 * A destination that is a symlink (a `node_modules`-style link is the realistic
 * case) is refused before anything is written: following it would install the
 * asset outside the tree the host resolves.
 */

/** Schema of the package-transport provisioning receipt. */
export const HOST_ASSET_RECEIPT_SCHEMA = 'u7-sbx-host-asset-receipt/1'
/** Receipt file override (explicit path) / directory override (file name fixed). */
export const RECEIPT_ENV = 'DSH_TEAM_SANDBOX_ASSET_RECEIPT'
export const RECEIPT_DIR_ENV = 'DSH_TEAM_SANDBOX_ASSET_RECEIPT_DIR'
/** Registry base override; the default is the public npm registry. */
export const REGISTRY_ENV = 'DSH_TEAM_SANDBOX_ASSET_REGISTRY'
export const DEFAULT_REGISTRY = 'https://registry.npmjs.org'

/**
 * The transport's typed refusal codes. They are NOT in `FATAL_PROVISION_CODES`:
 * that list describes the pre-flight's local-copy path, and the package
 * transport is never reached from `preflightHostSandbox()`. Every one of these
 * fails the caller (in CI: the step, hence the job) — none is an environment
 * state.
 */
export const PACKAGE_TRANSPORT_CODES = Object.freeze([
  'PACKAGE_SPEC_INVALID',
  'PACKAGE_SPEC_NOT_EXACT',
  'PACKAGE_PIN_MISSING',
  'PACKAGE_PIN_INVALID',
  'PACKAGE_PIN_DIVERGES_FROM_HOST_PIN',
  'PACKAGE_UNPINNED',
  'PACKAGE_VERSION_UNPINNED',
  'REGISTRY_METADATA_UNAVAILABLE',
  'REGISTRY_METADATA_UNREADABLE',
  'REGISTRY_NAME_MISMATCH',
  'REGISTRY_VERSION_MISMATCH',
  'REGISTRY_INTEGRITY_MISSING',
  'REGISTRY_INTEGRITY_UNKNOWN',
  'REGISTRY_TARBALL_URL_INVALID',
  'TARBALL_FETCH_FAILED',
  'TARBALL_INTEGRITY_MISMATCH',
  'TARBALL_DIGEST_MISMATCH',
  'TARBALL_LENGTH_MISMATCH',
  'PACKAGE_EXTRACT_FAILED',
  'PACKAGE_ARCHIVE_PATH_UNSAFE',
  'PACKAGE_ARCHIVE_ENTRY_UNSAFE',
  'PACKAGE_EXTRA_BIN_FILE',
  'PACKAGE_FILE_MISSING',
  'PACKAGE_FILE_LENGTH_MISMATCH',
  'PACKAGE_FILE_DIGEST_MISMATCH',
  'DESTINATION_IS_SYMLINK',
  'DESTINATION_NOT_REGULAR_FILE',
  'RECEIPT_WRITE_FAILED',
])

/** `1.2.3` or `1.2.3-rc.1` — an EXACT version, never a range/tag/wildcard. */
const EXACT_VERSION_RE = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/u
const SRI_SHA512_RE = /^sha512-[A-Za-z0-9+/]+={0,2}$/u
const SHA256_RE = /^[0-9a-f]{64}$/u

const sha256Hex = (buf) => createHash('sha256').update(buf).digest('hex')

/** Canonical JSON (sorted keys, recursively) — the digest's input. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

/** The digest of the pin table itself: what the receipt binds. */
export function manifestDigest(manifest) {
  return sha256Hex(Buffer.from(canonicalJson(manifest), 'utf8'))
}

/**
 * Parse `@scope/name@EXACT_VERSION`. A range, a dist-tag (`latest`), a partial
 * version or a missing version is refused BY NAME — the transport never asks
 * npm "what does this resolve to", because that answer is not a pin.
 * @throws {HostSandboxAssetError} PACKAGE_SPEC_INVALID | PACKAGE_SPEC_NOT_EXACT
 */
export function parsePackageSpec(spec) {
  if (typeof spec !== 'string' || spec.trim() === '') {
    throw new HostSandboxAssetError('PACKAGE_SPEC_INVALID', `expected \`name@EXACT_VERSION\`, got ${JSON.stringify(spec)}`)
  }
  const s = spec.trim()
  const at = s.lastIndexOf('@')
  if (at <= 0) {
    throw new HostSandboxAssetError('PACKAGE_SPEC_INVALID', `${JSON.stringify(s)} names no version — the package transport requires \`name@EXACT_VERSION\` (a range or a dist-tag is not a pin)`)
  }
  const name = s.slice(0, at)
  const version = s.slice(at + 1)
  if (!/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/u.test(name)) {
    throw new HostSandboxAssetError('PACKAGE_SPEC_INVALID', `${JSON.stringify(s)}: ${JSON.stringify(name)} is not a package name`)
  }
  if (!EXACT_VERSION_RE.test(version)) {
    throw new HostSandboxAssetError('PACKAGE_SPEC_NOT_EXACT', `${JSON.stringify(s)}: ${JSON.stringify(version)} is not an exact version (ranges, dist-tags such as \`latest\`, wildcards and partial versions are refused — only a version the manifest pins may be provisioned)`)
  }
  return { spec: s, name, version }
}

/**
 * The manifest's `packages` pin for one baseline + platform. It must AGREE with
 * the host pin in `entries` (same relative paths, same sha256, same bytes, same
 * mode): the package is a transport for that pin, never a second standard.
 * @throws {HostSandboxAssetError} PACKAGE_PIN_MISSING | PACKAGE_PIN_INVALID
 *         | PLATFORM_UNMANIFESTED | LIBC_VARIANT_UNMANIFESTED
 *         | MANIFEST_ENTRY_MISSING | PACKAGE_PIN_DIVERGES_FROM_HOST_PIN
 */
export function packagePlatformEntry(manifest, { version, sha, platform, libc }) {
  const key = `${version}@${sha}`
  const bundle = manifest?.packages?.[key]
  if (!bundle) {
    throw new HostSandboxAssetError('PACKAGE_PIN_MISSING', `the manifest pins no package transport for host baseline ${key} (carries: ${Object.keys(manifest?.packages ?? {}).join(', ') || 'none'}) — pin the published package before provisioning from it`)
  }
  const p = bundle.platforms?.[platform]
  if (!p) throw new HostSandboxAssetError('PLATFORM_UNMANIFESTED', `no pinned package transport for platform ${platform} at ${key}`)
  if (typeof p.libc === 'string' && libc !== null && p.libc !== libc) {
    throw new HostSandboxAssetError('LIBC_VARIANT_UNMANIFESTED', `the package pin is for ${p.libc} on ${platform}, this host is ${libc}`)
  }
  const invalid = (field) => new HostSandboxAssetError('PACKAGE_PIN_INVALID', `${key}/${platform}: packages pin field ${JSON.stringify(field)} is missing or malformed`)
  if (typeof p.package !== 'string' || p.package.trim() === '') throw invalid('package')
  if (typeof p.version !== 'string' || !EXACT_VERSION_RE.test(p.version)) throw invalid('version')
  if (typeof p.distIntegrity !== 'string' || !SRI_SHA512_RE.test(p.distIntegrity)) throw invalid('distIntegrity')
  if (typeof p.tarballSha256 !== 'string' || !SHA256_RE.test(p.tarballSha256)) throw invalid('tarballSha256')
  if (p.tarballBytes !== undefined && (!Number.isInteger(p.tarballBytes) || p.tarballBytes <= 0)) throw invalid('tarballBytes')
  if (p.files === null || typeof p.files !== 'object' || Array.isArray(p.files)) throw invalid('files')
  if (p.siblings !== undefined && (p.siblings === null || typeof p.siblings !== 'object' || Array.isArray(p.siblings))) throw invalid('siblings')
  if (typeof p.launcher !== 'string' || !Object.prototype.hasOwnProperty.call(p.files, p.launcher)) throw invalid('launcher')
  for (const [rel, spec] of Object.entries(p.files)) {
    if (spec === null || typeof spec !== 'object') throw invalid(`files[${rel}]`)
    if (typeof spec.sha256 !== 'string' || !SHA256_RE.test(spec.sha256)) throw invalid(`files[${rel}].sha256`)
    if (!Number.isInteger(spec.bytes) || spec.bytes <= 0) throw invalid(`files[${rel}].bytes`)
    parseManifestMode(spec.mode, rel)
  }
  for (const [rel, spec] of Object.entries(p.siblings ?? {})) {
    if (spec === null || typeof spec !== 'object') throw invalid(`siblings[${rel}]`)
    if (typeof spec.sha256 !== 'string' || !SHA256_RE.test(spec.sha256)) throw invalid(`siblings[${rel}].sha256`)
    if (!Number.isInteger(spec.bytes) || spec.bytes <= 0) throw invalid(`siblings[${rel}].bytes`)
    if (!manifestAssetPathIsSafe(rel)) throw invalid(`siblings[${rel}]`)
  }
  // ONE STANDARD: the package pin must be the host pin, path for path.
  const hostEntry = manifest?.entries?.[key]?.platforms?.[platform]
  if (!hostEntry) throw new HostSandboxAssetError('MANIFEST_ENTRY_MISSING', `no host pin for ${key}/${platform} — the package transport has nothing to agree with`)
  const sameFiles = canonicalJson(hostEntry.files) === canonicalJson(p.files)
  if (!sameFiles) {
    throw new HostSandboxAssetError('PACKAGE_PIN_DIVERGES_FROM_HOST_PIN', `${key}/${platform}: the packages pin's file table differs from the host pin in entries — the package transports the committed standard, it does not define a second one (host: ${Object.keys(hostEntry.files).sort().join(', ')}; package: ${Object.keys(p.files).sort().join(', ')})`)
  }
  if (hostEntry.launcher !== p.launcher) {
    throw new HostSandboxAssetError('PACKAGE_PIN_DIVERGES_FROM_HOST_PIN', `${key}/${platform}: the packages pin names launcher ${JSON.stringify(p.launcher)}, the host pin names ${JSON.stringify(hostEntry.launcher)}`)
  }
  return p
}

/** The default fetcher: Node's global `fetch`, bounded by a timeout. */
export const defaultPackageFetcher = Object.freeze({
  async get(url) {
    const response = await fetch(url, {
      redirect: 'follow',
      headers: { accept: 'application/json, application/octet-stream' },
      signal: AbortSignal.timeout(120_000),
    })
    const bytes = Buffer.from(await response.arrayBuffer())
    return { ok: response.ok === true, status: Number(response.status), bytes, url: response.url || url }
  },
})

const cstr = (buf, start, end) => {
  const s = buf.subarray(start, end).toString('utf8')
  const nul = s.indexOf('\u0000')
  return (nul === -1 ? s : s.slice(0, nul)).trim()
}
const octalAt = (buf, start, end) => {
  const s = cstr(buf, start, end)
  return s === '' ? 0 : Number.parseInt(s, 8)
}

/**
 * Is an ARCHIVE path safe to materialise? Plain relative, no empty/`.`/`..`
 * segment, no drive letter, no backslash. (The archive is untrusted input; a
 * `../` entry would write outside the extraction directory before any digest
 * check could look at it.)
 */
export function packageArchivePathIsSafe(name) {
  if (typeof name !== 'string' || name === '' || name.includes('\u0000')) return false
  if (name.includes('\\') || name.startsWith('/') || /^[a-zA-Z]:/u.test(name)) return false
  const segments = name.split('/')
  return segments.every((s) => s !== '' && s !== '.' && s !== '..')
}

/**
 * The default extractor: gunzip + a strict ustar reader. Only regular files and
 * directories are accepted; symlink/hardlink/PAX/GNU-longname entries are
 * REFUSED (an archive is data, not code). Files are materialised under
 * `destDir`, keeping their `package/…` archive names.
 * @returns {{files: string[]}} the archive-relative names that were written
 */
export function extractPackageTarball(tarballBytes, destDir) {
  let tar
  try {
    tar = gunzipSync(tarballBytes)
  } catch (error) {
    throw new HostSandboxAssetError('PACKAGE_EXTRACT_FAILED', `the tarball is not gzip: ${String(error?.message ?? error)}`)
  }
  const files = []
  let offset = 0
  while (offset + 512 <= tar.length) {
    const header = tar.subarray(offset, offset + 512)
    if (header.every((b) => b === 0)) break
    const name = cstr(header, 0, 100)
    const prefix = cstr(header, 345, 500)
    const full = prefix === '' ? name : `${prefix}/${name}`
    const size = octalAt(header, 124, 136)
    const type = header[156] === 0 ? '0' : String.fromCharCode(header[156])
    const dataStart = offset + 512
    if (dataStart + size > tar.length) {
      throw new HostSandboxAssetError('PACKAGE_EXTRACT_FAILED', `archive entry ${JSON.stringify(full)} claims ${String(size)} bytes past the end of the archive (truncated tarball)`)
    }
    if (type === '0' || type === '7') {
      if (!packageArchivePathIsSafe(full)) {
        throw new HostSandboxAssetError('PACKAGE_ARCHIVE_PATH_UNSAFE', `archive entry ${JSON.stringify(full)} is not a plain relative path — refusing to extract an archive that can write outside its directory`)
      }
      if (full.startsWith('package/')) {
        const rel = full.slice('package/'.length)
        const dest = join(destDir, ...full.split('/'))
        mkdirSync(dirname(dest), { recursive: true })
        writeFileSync(dest, tar.subarray(dataStart, dataStart + size))
        files.push(`package/${rel}`)
      }
    } else if (type === '5') {
      // directory: nothing to materialise
    } else {
      throw new HostSandboxAssetError('PACKAGE_ARCHIVE_ENTRY_UNSAFE', `archive entry ${JSON.stringify(full)} has type ${JSON.stringify(type)} — only regular files and directories are accepted (symlinks, hardlinks and PAX/GNU extensions are refused)`)
    }
    offset = dataStart + Math.ceil(size / 512) * 512
  }
  return { files }
}

/** Refuse to walk through a symlink on the destination path (a `node_modules`-style link is the realistic case). */
function assertNoSymlinkOnPath(root, rel, context) {
  let current = root
  const rootStat = (() => { try { return lstatSync(current) } catch { return null } })()
  if (rootStat !== null && rootStat.isSymbolicLink()) {
    throw new HostSandboxAssetError('DESTINATION_IS_SYMLINK', `${context}: ${root} is a symlink — installing through it would write outside the runtime tree`)
  }
  for (const segment of rel.split('/')) {
    current = join(current, segment)
    let st
    try {
      st = lstatSync(current)
    } catch {
      return // not present ⇒ no descendant can exist either
    }
    if (st.isSymbolicLink()) {
      throw new HostSandboxAssetError('DESTINATION_IS_SYMLINK', `${context}: ${current} is a symlink (destination path ${rel}) — refusing to install through a link the host did not resolve`)
    }
  }
}

/**
 * Name a destination that is NOT a regular file, in terms an operator can act on.
 * These are the shapes that make `readFileSync`/`copyFileSync` BLOCK (a FIFO
 * waits for a writer, a socket/device never answers) or mutate bytes that belong
 * to another path (a hardlink shares its inode). A test timeout is not a
 * refusal: the check must run BEFORE the first read.
 */
function destinationNotRegularDetail(st) {
  if (st.isFIFO()) return 'a FIFO (reading it blocks until a writer appears)'
  if (st.isDirectory()) return 'a directory'
  if (st.isSocket()) return 'a socket'
  if (st.isBlockDevice()) return 'a block device'
  if (st.isCharacterDevice()) return 'a character device'
  if (st.isFile()) return `a regular file with nlink=${String(st.nlink)} (a hardlink: an in-place overwrite would change another path's bytes)`
  return `not a regular file (mode 0o${(st.mode & 0o7777).toString(8)})`
}

/**
 * Refuse a destination path that exists as anything but a regular file with
 * nlink === 1. Absent is fine (the install creates it). Runs before hashing,
 * backing up or copying, so a FIFO can never hang the provisioner.
 * @throws {HostSandboxAssetError} DESTINATION_NOT_REGULAR_FILE
 */
function assertRegularDestinationFile(root, rel, context) {
  const path = join(root, ...rel.split('/'))
  let st
  try {
    st = lstatSync(path)
  } catch {
    return
  }
  if (st.isFile() && st.nlink === 1) return
  throw new HostSandboxAssetError('DESTINATION_NOT_REGULAR_FILE', `${context}: ${path} is ${destinationNotRegularDetail(st)} — the destination must be a regular file (nlink=1) or absent; reading, backing up or writing through anything else can block indefinitely or mutate another path's bytes, so nothing was read, backed up or written`)
}

/** The staging name is writable too: a FIFO/socket there would block `writeFileSync`. */
function assertStagePathWritable(stage, rel, context) {
  let st
  try {
    st = lstatSync(stage)
  } catch {
    return
  }
  if (st.isFile() && st.nlink === 1) return
  throw new HostSandboxAssetError('DESTINATION_NOT_REGULAR_FILE', `${context}: staging path ${stage} for ${rel} is ${destinationNotRegularDetail(st)} — refusing to write through it (nothing was installed)`)
}

/** Where the provisioning receipt is written (explicit file → directory → default). */
export function hostAssetReceiptPath(repoRoot, env = process.env) {
  const explicit = typeof env?.[RECEIPT_ENV] === 'string' ? env[RECEIPT_ENV].trim() : ''
  if (explicit !== '') return explicit
  const dir = typeof env?.[RECEIPT_DIR_ENV] === 'string' ? env[RECEIPT_DIR_ENV].trim() : ''
  return join(dir !== '' ? dir : join(resolve(repoRoot), '.artifacts', 'tmp', 'host-assets'), 'provision-receipt.json')
}

/**
 * Provision the pinned native sandbox assets from the PINNED PUBLISHED package.
 *
 * @param {object} opts
 * @param {string} opts.runtimeTree destination runtime checkout
 * @param {string} [opts.spec] `@scope/name@EXACT_VERSION` (default: the manifest's pinned package)
 * @param {string} [opts.repoRoot] Team repo root (manifest + default temp/receipt paths)
 * @param {object} [opts.manifest] manifest override (tests)
 * @param {{get: (url: string) => Promise<{ok: boolean, status: number, bytes: Buffer}>}} [opts.fetcher]
 * @param {(tarballBytes: Buffer, destDir: string) => {files: string[]}} [opts.extractor]
 * @param {string} [opts.registryBase]
 * @param {string} [opts.receiptPath]
 * @param {(env: object) => string} [opts.receiptEnv]
 * @returns {Promise<object>} the receipt (also written to disk)
 */
export async function provisionHostSandboxAssetsFromPackage({
  runtimeTree,
  spec,
  repoRoot,
  manifest = null,
  fetcher = defaultPackageFetcher,
  extractor = extractPackageTarball,
  registryBase = process.env[REGISTRY_ENV] ?? null,
  receiptPath = null,
  receiptEnv = process.env,
  now = () => new Date(),
  host = null,
} = {}) {
  const root = resolve(repoRoot ?? DEFAULT_REPO_ROOT)
  const layout = await resolveHostSandboxLayout(runtimeTree)
  const m = manifest ?? readHostSandboxAssetManifest({ repoRoot: root })
  const libc = detectedLibcVariant()
  const platform = `${process.platform}-${process.arch}`
  const pin = resolveHostBaseline(host)
  const baseline = { host: pin.host, version: pin.version, sha: pin.sha, manifestKey: `${pin.version}@${pin.sha}` }
  const pinned = packagePlatformEntry(m, { version: pin.version, sha: pin.sha, platform, libc })

  // (1) SPEC: exact version only, and it must be the pinned one.
  const parsed = parsePackageSpec(spec === undefined || spec === null || spec === '' ? `${pinned.package}@${pinned.version}` : spec)
  if (parsed.name !== pinned.package) {
    throw new HostSandboxAssetError('PACKAGE_UNPINNED', `${parsed.name} is not the pinned package ${pinned.package} — the manifest pins which package may be provisioned`)
  }
  if (parsed.version !== pinned.version) {
    throw new HostSandboxAssetError('PACKAGE_VERSION_UNPINNED', `${parsed.name}@${parsed.version} is not the pinned version ${pinned.package}@${pinned.version} — an unpinned version is not a weaker pin, it is a different artifact`)
  }

  // (2) WRITE SCOPE + MODE, before any network or filesystem mutation.
  const relPaths = Object.keys(pinned.files).sort()
  const modeBits = new Map()
  for (const rel of [...relPaths, pinned.launcher]) {
    if (!manifestAssetPathIsSafe(rel)) {
      throw new HostSandboxAssetError('MANIFEST_PATH_UNSAFE', `${baseline.manifestKey}: packages pin declares ${JSON.stringify(rel)}, which is not a relative path contained in the platform package's bin/ subtree`)
    }
    const abs = join(layout.platformDir, rel)
    if (!abs.startsWith(layout.binDir + sep)) {
      throw new HostSandboxAssetError('MANIFEST_PATH_UNSAFE', `${baseline.manifestKey}: ${JSON.stringify(rel)} resolves to ${abs}, outside the bin/ the host resolved (${layout.binDir}) — nothing was written`)
    }
    if (Object.prototype.hasOwnProperty.call(pinned.files, rel)) modeBits.set(rel, parseManifestMode(pinned.files[rel].mode, rel))
  }
  assertNoSymlinkOnPath(layout.platformDir, pinned.launcher, baseline.manifestKey)
  for (const rel of relPaths) assertNoSymlinkOnPath(layout.platformDir, rel, baseline.manifestKey)
  assertRegularDestinationFile(layout.platformDir, pinned.launcher, baseline.manifestKey)
  for (const rel of relPaths) assertRegularDestinationFile(layout.platformDir, rel, baseline.manifestKey)

  // (3) REGISTRY METADATA: the exact version, with an integrity we pinned.
  const base = String(registryBase ?? pinned.registry ?? DEFAULT_REGISTRY).replace(/\/+$/u, '')
  const metadataUrl = `${base}/${encodeURIComponent(parsed.name)}/${encodeURIComponent(parsed.version)}`
  let metadataResponse
  try {
    metadataResponse = await fetcher.get(metadataUrl)
  } catch (error) {
    throw new HostSandboxAssetError('REGISTRY_METADATA_UNAVAILABLE', `${metadataUrl}: ${String(error?.message ?? error)}`)
  }
  if (metadataResponse?.ok !== true) {
    throw new HostSandboxAssetError('REGISTRY_METADATA_UNAVAILABLE', `${metadataUrl}: HTTP ${String(metadataResponse?.status ?? 'no response')} — the pinned package must be published at the pinned version`)
  }
  let metadata
  try {
    metadata = JSON.parse(Buffer.from(metadataResponse.bytes).toString('utf8'))
  } catch (error) {
    throw new HostSandboxAssetError('REGISTRY_METADATA_UNREADABLE', `${metadataUrl}: ${String(error?.message ?? error)}`)
  }
  if (metadata?.name !== parsed.name) {
    throw new HostSandboxAssetError('REGISTRY_NAME_MISMATCH', `${metadataUrl}: the registry answered for ${JSON.stringify(metadata?.name)}, not ${JSON.stringify(parsed.name)}`)
  }
  if (metadata?.version !== parsed.version) {
    throw new HostSandboxAssetError('REGISTRY_VERSION_MISMATCH', `${metadataUrl}: the registry answered version ${JSON.stringify(metadata?.version)}, not the exact pinned ${JSON.stringify(parsed.version)}`)
  }
  const integrity = metadata?.dist?.integrity
  if (typeof integrity !== 'string' || integrity.trim() === '') {
    throw new HostSandboxAssetError('REGISTRY_INTEGRITY_MISSING', `${metadataUrl}: dist.integrity is absent — the tarball could only be trusted by its sha256 pin, and the registry's own published integrity is part of the evidence this transport requires`)
  }
  if (!SRI_SHA512_RE.test(integrity)) {
    throw new HostSandboxAssetError('REGISTRY_INTEGRITY_UNKNOWN', `${metadataUrl}: dist.integrity ${JSON.stringify(integrity)} is not an sha512 SRI — the pinned manifest only authors sha512 integrity, so this tarball's registry identity cannot be checked`)
  }
  if (integrity !== pinned.distIntegrity) {
    throw new HostSandboxAssetError('REGISTRY_INTEGRITY_UNKNOWN', `${metadataUrl}: the registry publishes ${integrity}, the manifest pins ${pinned.distIntegrity} — an integrity the manifest does not know is not a weaker pin`)
  }
  const tarballUrl = metadata?.dist?.tarball
  let parsedTarballUrl
  try {
    parsedTarballUrl = new URL(String(tarballUrl))
  } catch {
    throw new HostSandboxAssetError('REGISTRY_TARBALL_URL_INVALID', `${metadataUrl}: dist.tarball ${JSON.stringify(tarballUrl)} is not a URL`)
  }
  if (parsedTarballUrl.protocol !== 'https:') {
    throw new HostSandboxAssetError('REGISTRY_TARBALL_URL_INVALID', `${metadataUrl}: dist.tarball is ${parsedTarballUrl.protocol}// — the transport fetches https only`)
  }

  // (4) TARBALL: dist.integrity (sha512) AND the committed sha256 pin AND its length.
  let tarballResponse
  try {
    tarballResponse = await fetcher.get(parsedTarballUrl.href)
  } catch (error) {
    throw new HostSandboxAssetError('TARBALL_FETCH_FAILED', `${parsedTarballUrl.href}: ${String(error?.message ?? error)}`)
  }
  if (tarballResponse?.ok !== true) {
    throw new HostSandboxAssetError('TARBALL_FETCH_FAILED', `${parsedTarballUrl.href}: HTTP ${String(tarballResponse?.status ?? 'no response')}`)
  }
  const tarballBytes = Buffer.from(tarballResponse.bytes ?? [])
  if (tarballBytes.length === 0) throw new HostSandboxAssetError('TARBALL_FETCH_FAILED', `${parsedTarballUrl.href}: empty body`)
  const sri = `sha512-${createHash('sha512').update(tarballBytes).digest('base64')}`
  if (sri !== integrity) {
    throw new HostSandboxAssetError('TARBALL_INTEGRITY_MISMATCH', `${parsedTarballUrl.href}: sha512 ${sri} != the registry's published ${integrity} — the bytes are not the artifact the registry attests, nothing was extracted and nothing was installed`)
  }
  const tarballSha256 = sha256Hex(tarballBytes)
  if (tarballSha256 !== pinned.tarballSha256) {
    throw new HostSandboxAssetError('TARBALL_DIGEST_MISMATCH', `${parsedTarballUrl.href}: sha256 ${tarballSha256} != the pinned ${pinned.tarballSha256} — nothing was extracted and nothing was installed`)
  }
  if (Number.isInteger(pinned.tarballBytes) && tarballBytes.length !== pinned.tarballBytes) {
    throw new HostSandboxAssetError('TARBALL_LENGTH_MISMATCH', `${parsedTarballUrl.href}: ${String(tarballBytes.length)} bytes != the pinned ${String(pinned.tarballBytes)}`)
  }

  // (5) EXTRACT to a scratch directory inside the workspace (never /tmp), then
  // verify EVERY manifested file (length, then digest) before the first write.
  mkdirSync(join(root, '.artifacts', 'tmp'), { recursive: true })
  const tempDir = mkdtempSync(join(root, '.artifacts', 'tmp', 'host-assets-pkg-'))
  try {
    let extracted
    try {
      extracted = extractor(tarballBytes, tempDir)
    } catch (error) {
      if (error instanceof HostSandboxAssetError) throw error
      throw new HostSandboxAssetError('PACKAGE_EXTRACT_FAILED', String(error?.message ?? error))
    }
    const extractedNames = Array.isArray(extracted?.files) ? extracted.files.map(String) : []
    const extractedRel = new Set()
    for (const name of extractedNames) {
      const norm = name.replace(/^\.\//u, '')
      if (!norm.startsWith('package/')) continue
      extractedRel.add(norm.slice('package/'.length))
    }
    // A tarball is pinned whole; everything it carries under bin/ is either an
    // install-set file or a pinned sibling. An unaccounted file is a refusal.
    const allowedBin = new Set([...relPaths, ...Object.keys(pinned.siblings ?? {})])
    const extras = [...extractedRel].filter((rel) => rel.startsWith('bin/') && !allowedBin.has(rel)).sort()
    if (extras.length > 0) {
      throw new HostSandboxAssetError('PACKAGE_EXTRA_BIN_FILE', `${parsed.name}@${parsed.version}: the tarball carries unaccounted file(s) under bin/: ${extras.join(', ')} — the pin accounts for the whole bin/ subtree, so an extra file means the artifact is not the one the manifest describes; nothing was installed`)
    }
    const verified = new Map()
    for (const rel of relPaths) {
      const spec = pinned.files[rel]
      if (!extractedRel.has(rel)) {
        throw new HostSandboxAssetError('PACKAGE_FILE_MISSING', `${parsed.name}@${parsed.version}: ${rel} is not in the tarball (found: ${[...extractedRel].sort().join(', ') || 'no files'})`)
      }
      const abs = join(tempDir, 'package', ...rel.split('/'))
      const bytes = readFileSync(abs)
      if (bytes.length !== spec.bytes) {
        throw new HostSandboxAssetError('PACKAGE_FILE_LENGTH_MISMATCH', `${rel}: ${String(bytes.length)} bytes, the manifest pins ${String(spec.bytes)} — nothing was installed`)
      }
      const digest = sha256Hex(bytes)
      if (digest !== spec.sha256) {
        throw new HostSandboxAssetError('PACKAGE_FILE_DIGEST_MISMATCH', `${rel}: sha256 ${digest}, the pinned manifest says ${spec.sha256} — nothing was installed`)
      }
      verified.set(rel, { bytes, sha256: digest })
    }
    for (const [rel, spec] of Object.entries(pinned.siblings ?? {})) {
      if (!extractedRel.has(rel)) continue // not carried by this tarball; the install set is what must exist
      const bytes = readFileSync(join(tempDir, 'package', ...rel.split('/')))
      const digest = sha256Hex(bytes)
      if (bytes.length !== spec.bytes || digest !== spec.sha256) {
        throw new HostSandboxAssetError('PACKAGE_FILE_DIGEST_MISMATCH', `sibling ${rel}: sha256/bytes ${digest}/${String(bytes.length)} != the pinned ${spec.sha256}/${String(spec.bytes)} — the pin accounts for this file, so a mismatch means the artifact is not the pinned one`)
      }
    }

    // (6) INSTALL: stage → verify → chmod(pin) → rename → re-read. Existing
    // bytes (the runner's own build) are REPLACED — that is this transport's
    // purpose — but they are backed up first and restored on any failure, so a
    // refusal leaves the tree exactly as it was found.
    const porcelainBefore = porcelainState(layout.runtimeTree)
    const before = relPaths.map((rel) => {
      const path = join(layout.platformDir, rel)
      const present = existsSync(path)
      return {
        relPath: rel,
        role: rel === pinned.launcher ? 'launcher' : 'addon',
        path,
        present,
        preExistingSha256: present ? sha256File(path) : null,
        preExistingMode: present ? modeString(path) : null,
      }
    })
    const touched = new Set()
    const backups = new Map()
    const written = []
    let bytesWritten = 0
    try {
      for (const f of before) {
        const spec = pinned.files[f.relPath]
        const mode = modeBits.get(f.relPath)
        const stage = `${f.path}.u7-sbx-staging`
        // Re-check at install time (the pre-network check was earlier; a FIFO
        // swapped in since must not hang the hash/backup below).
        assertRegularDestinationFile(layout.platformDir, f.relPath, baseline.manifestKey)
        assertStagePathWritable(stage, f.relPath, baseline.manifestKey)
        mkdirSync(dirname(f.path), { recursive: true })
        if (f.present) {
          const backup = join(tempDir, `backup-${written.length}-${f.relPath.replace(/[\\/]/gu, '_')}`)
          copyFileSync(f.path, backup)
          backups.set(f.path, { backup, mode: statSync(f.path).mode & 0o7777 })
        }
        touched.add(f.path)
        writeFileSync(stage, verified.get(f.relPath).bytes)
        const stagedSha = sha256File(stage)
        if (stagedSha !== spec.sha256) {
          throw new HostSandboxAssetError('STAGED_DIGEST_MISMATCH', `${f.relPath} hashed ${stagedSha} in staging, expected ${spec.sha256}`)
        }
        chmodSync(stage, mode)
        renameSync(stage, f.path)
        const publishedSha = sha256File(f.path)
        if (publishedSha !== spec.sha256) {
          unlinkSync(f.path)
          throw new HostSandboxAssetError('PUBLISHED_DIGEST_MISMATCH', `${f.relPath} hashed ${publishedSha} after publish, expected ${spec.sha256} — the file was removed again`)
        }
        const publishedMode = modeOf(f.path)
        if (publishedMode !== mode) {
          unlinkSync(f.path)
          throw new HostSandboxAssetError('PUBLISHED_MODE_MISMATCH', `${f.relPath} is mode 0o${publishedMode.toString(8)} after publish, the manifest pins ${spec.mode} — the file was removed again`)
        }
        if (!f.path.startsWith(layout.binDir + sep)) {
          throw new HostSandboxAssetError('WRITES_OUTSIDE_PLATFORM_BIN', `refusing to keep ${f.path} outside ${layout.binDir}`)
        }
        bytesWritten += spec.bytes
        written.push({
          relPath: f.relPath,
          role: f.role,
          sha256: publishedSha,
          expectedSha256: spec.sha256,
          bytes: spec.bytes,
          mode: modeString(f.path),
          preExistingSha256: f.preExistingSha256,
          preExistingMode: f.preExistingMode,
        })
      }
    } catch (error) {
      // No combined state survives a failure: restore what was there (or remove
      // what this run published), and never leave a staging file behind.
      for (const path of touched) {
        const stage = `${path}.u7-sbx-staging`
        if (existsSync(stage)) rmSync(stage, { force: true })
        const backup = backups.get(path)
        if (backup !== undefined) {
          // A FIFO/socket swapped in during the run would make the restore
          // block. Remove a non-regular entry (bounded) before writing; if it
          // still isn't a regular file, fail closed instead of hanging.
          let st = null
          try { st = lstatSync(path) } catch { /* absent */ }
          if (st !== null && !st.isFile()) {
            try { rmSync(path, { force: true }) } catch { /* a directory cannot be unlinked */ }
            st = null
            try { st = lstatSync(path) } catch { /* gone */ }
            if (st !== null && !st.isFile()) {
              throw new HostSandboxAssetError('DESTINATION_NOT_REGULAR_FILE', `rollback cannot restore ${path}: it is ${destinationNotRegularDetail(st)} — the destination was left in place rather than blocking the rollback`)
            }
          }
          copyFileSync(backup.backup, path)
          chmodSync(path, backup.mode)
        } else if (existsSync(path)) {
          rmSync(path, { force: true })
        }
      }
      throw error
    }

    // (7) RECEIPT: the artifact, the pin and the host, in one JSON.
    const runtimeHead = (() => {
      const r = gitText(['rev-parse', 'HEAD'], layout.runtimeTree)
      return r.status === 0 ? String(r.stdout ?? '').trim() : null
    })()
    const receipt = {
      schema: HOST_ASSET_RECEIPT_SCHEMA,
      at: now().toISOString(),
      action: 'provisioned-from-package',
      transport: 'pinned-package',
      package: {
        spec: parsed.spec,
        name: parsed.name,
        version: parsed.version,
        registry: base,
        metadataUrl,
        tarballUrl: parsedTarballUrl.href,
        distIntegrity: integrity,
        tarballSha256,
        tarballBytes: tarballBytes.length,
      },
      host: {
        hostBaseline: pin.host,
        baselineVersion: pin.version,
        sha: pin.sha,
        runtimeTree: layout.runtimeTree,
        runtimeHead,
        platform,
        libc,
        platformDir: layout.platformDir,
        launcherPath: layout.launcherPath,
      },
      manifest: { path: MANIFEST_REL, schema: m.schema, digest: manifestDigest(m) },
      files: written.map((f) => ({
        relPath: f.relPath, role: f.role, sha256: f.sha256, expectedSha256: f.expectedSha256,
        bytes: f.bytes, mode: f.mode, preExistingSha256: f.preExistingSha256, preExistingMode: f.preExistingMode,
      })),
      siblings: Object.keys(pinned.siblings ?? {}).sort(),
      bytesWritten,
      porcelainBefore: { available: porcelainBefore.available, empty: porcelainBefore.empty },
      porcelainAfter: (() => { const p = porcelainState(layout.runtimeTree); return { available: p.available, empty: p.empty, lines: p.lines } })(),
    }
    const path = receiptPath ?? hostAssetReceiptPath(root, receiptEnv)
    try {
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, `${JSON.stringify(receipt, null, 2)}\n`)
    } catch (error) {
      throw new HostSandboxAssetError('RECEIPT_WRITE_FAILED', `${path}: ${String(error?.message ?? error)} — the assets are installed but the evidence of HOW cannot be written, so this is a refusal, not a silent success`)
    }
    return { ...receipt, receiptPath: path }
  } finally {
    rmSync(tempDir, { recursive: true, force: true })
  }
}
