/**
 * host-next-lib.mjs — the NEXT HOST (0.2.2-rc.5) test lane's shared plumbing.
 *
 * WHAT THIS IS: the second, independent pinned DSH host (tests/paths.mjs
 * `NEXT_HOST`) is a gitignored, shallow clone at a lightweight upstream tag.
 * This module is the ONE place the lane (a) fails loudly when that host or its
 * pinned native assets are absent, and (b) resolves the host's public package
 * entry modules — by package name, through the host tree's own resolver, never
 * by reaching into a `src/` private module.
 *
 * FAIL-LOUD LAW (repo precedent: "missing host -> skip" hid two real breaks):
 * every export here THROWS on a missing/mismatched host tree or asset. There is
 * no skip path, no `t.skip()`, no faked fallback. Since 2026-11-19 (Task B) the
 * lane RUNS IN CI: `ci-census` materializes the tree (`scripts/provision-next-host.mjs
 * --materialize`), provisions its published native assets (`--assets`), and runs
 * `node --test tests/next-host/*.test.mjs` as a declared, unskippable leg — so a
 * runner without the tree is a RED lane, not an absent one. The refusal codes are
 * pinned one arm each by `provisioning-controls.test.mjs` (host-free fixtures).
 *
 * CORE PATCH BUDGET = 0: nothing here writes to the host tree except the
 * provisioning CLI's own `bin/` write (via the shared, digest-verified
 * provisioner), and no host `src/` module is imported.
 */
import { createHash } from 'node:crypto'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, statSync } from 'node:fs'
import { createRequire } from 'node:module'
import { join, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

import { HOST_PORT_BANDS, NEXT_HOST, nextHostTree, portsOfBands } from '../paths.mjs'
import { detectedLibcVariant, manifestPlatformEntry, readHostSandboxAssetManifest } from '../world-factory/lib/host-sandbox-assets.mjs'

/**
 * RULING (UTE-Prep, 2026-11-16): host port bands are partitioned BY GENERATION.
 * Legacy leases 3181-3199; the second pinned host leases 13000-13049 ONLY. This
 * asserts the partition itself (not a lucky free-port probe) and is called by
 * the boot lane before it binds anything, so a future edit that reintroduces an
 * overlap is a RED lane rather than an intermittent collision in CI.
 * @returns {{legacy: number[], next: number[]}}
 */
export function assertGenerationBandsDisjoint() {
  const legacy = portsOfBands(HOST_PORT_BANDS)
  const next = portsOfBands(NEXT_HOST.portBands)
  const overlap = next.filter((p) => legacy.includes(p))
  if (overlap.length > 0) {
    throw new Error(`HOST PORT BANDS OVERLAP: next-generation ports ${overlap.join(',')} are also legacy-host ports; the 2026-11-16 generation partition is broken (tests/paths.mjs)`)
  }
  for (const [lo, hi] of NEXT_HOST.portBands) {
    if (lo < 13000 || hi > 13049) throw new Error(`next-generation band ${lo}-${hi} leaves 13000-13049: the next host must lease only the upper band`)
  }
  if (legacy.some((p) => p >= 13000 && p <= 13049)) throw new Error('a legacy host port landed in 13000-13049: the generations are no longer disjoint')
  return { legacy, next }
}

/** Repo root of the worktree this module lives in (tests/next-host -> ../..). */
export const NEXT_LANE_REPO_ROOT = resolve(new URL('.', import.meta.url).pathname, '..', '..')

/**
 * The named refusal of this lane. EVERY absence/drift path throws THIS type with
 * a machine-greppable `code`, so a red run names what is wrong instead of
 * surfacing as a generic assertion or (worse) a skip. The codes are the fixed
 * vocabulary the provisioning negative-control suite pins one arm each:
 *
 *   TREE_MISSING · NOT_A_GIT_CHECKOUT · NOT_BUILT · HEAD_DRIFT ·
 *   VERSION_UNREADABLE · VERSION_DRIFT ·
 *   ASSET_MISSING · ASSET_DIGEST_DRIFT · ASSET_BYTES_DRIFT · ASSET_MODE_DRIFT ·
 *   MODULE_UNRESOLVED
 */
export class NextHostMissingError extends Error {
  constructor(code, detail) {
    super(`next host lane: ${code}: ${detail}`)
    this.name = 'NextHostMissingError'
    this.code = code
  }
}

/** Absolute path of the pinned next-host tree. */
export function nextTree(repoRoot = NEXT_LANE_REPO_ROOT) {
  return nextHostTree(repoRoot)
}

const git = (args, cwd) => spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' })

/**
 * THE TREE VERIFIER (pure over a given path + expected pin).
 *
 * Split out of `assertNextHostTree` so the provisioning negative controls can
 * drive it against fixture trees (`tests/next-host/provisioning-controls.test.mjs`)
 * instead of only against the one machine-global tree — a refusal that cannot be
 * shown to fire is a comment, not a control. The real lane calls it through
 * `assertNextHostTree()`, which supplies the committed pin; there is exactly ONE
 * implementation of the law.
 *
 * @param {string} tree absolute path of the candidate next-host tree
 * @param {{version: string, sha: string, tag?: string, treeRel?: string}} pinned
 * @param {{requireBuilt?: boolean}} [opts] `requireBuilt: false` is for the provisioning
 *   step's PRE-build identity assertion only; the lane and `--verify` always require it.
 * @returns {{tree: string, head: string, version: string}}
 */
export function verifyNextHostTree(tree, pinned, { requireBuilt = true } = {}) {
  if (typeof pinned?.sha !== 'string' || !/^[0-9a-f]{40}$/.test(pinned.sha)) {
    throw new NextHostMissingError('PIN_INVALID', `the expected pin is not a 40-hex commit (${JSON.stringify(pinned?.sha ?? null)}) — the verifier refuses to grade against an unpinned expectation`)
  }
  if (!existsSync(tree) || !statSync(tree).isDirectory()) {
    throw new NextHostMissingError('TREE_MISSING', `no host tree at ${tree} — provision it with \`node scripts/provision-next-host.mjs --materialize\` (or the documented clone in docs/TEST_METHODS.md §11.2): git clone --branch ${pinned.tag ?? '<tag>'} --depth 1 ${NEXT_HOST.url} ${pinned.treeRel ?? NEXT_HOST.treeRel}`)
  }
  // NOT A CHECKOUT, precisely: `git -C <dir> rev-parse HEAD` WALKS UP and happily
  // answers with an enclosing repository's commit (measured: a plain directory
  // under this Team checkout reported the Team HEAD instead of refusing). The
  // tree's own toplevel must BE the tree, or there is no checkout here to pin.
  const toplevel = git(['rev-parse', '--show-toplevel'], tree)
  let top = ''
  try {
    top = realpathSync(String(toplevel.stdout ?? '').trim())
  } catch {
    top = ''
  }
  if (toplevel.status !== 0 || top === '') {
    throw new NextHostMissingError('NOT_A_GIT_CHECKOUT', `${tree} is not a git checkout: ${String(toplevel.stderr ?? '').trim()}`)
  }
  let self = tree
  try {
    self = realpathSync(tree)
  } catch {
    self = tree
  }
  if (top !== self) {
    throw new NextHostMissingError('NOT_A_GIT_CHECKOUT', `${tree} is not its own git checkout: git resolves its toplevel to ${top} — a directory nested in another repository is not a pinned host tree`)
  }
  const head = git(['rev-parse', 'HEAD'], tree)
  if (head.status !== 0) throw new NextHostMissingError('NOT_A_GIT_CHECKOUT', `${tree} is not a git checkout: ${String(head.stderr ?? '').trim()}`)
  const sha = String(head.stdout ?? '').trim()
  if (sha !== pinned.sha) {
    throw new NextHostMissingError('HEAD_DRIFT', `the host tree at ${tree} is at ${sha}, the pin is ${pinned.sha} (${pinned.tag ?? pinned.version}) — refusing to test a drifted tree`)
  }
  let version
  try {
    version = JSON.parse(readFileSync(join(tree, 'package.json'), 'utf8')).version
  } catch (error) {
    throw new NextHostMissingError('VERSION_UNREADABLE', `could not read ${join(tree, 'package.json')}: ${String(error?.message ?? error)}`)
  }
  if (version !== pinned.version) {
    throw new NextHostMissingError('VERSION_DRIFT', `the host tree at ${tree} declares version ${String(version)}, the pin is ${pinned.version}`)
  }
  // The BUILD check is last and optional: `--materialize` must be able to assert
  // identity (tag's commit + declared version) on a FRESH CLONE, before it has
  // built anything. Everything else always requires the build, because the lane
  // boots `apps/cli/lib/bin.js` and a pinned-but-unbuilt tree cannot serve.
  if (requireBuilt && !existsSync(join(tree, 'apps/cli/lib/bin.js'))) {
    throw new NextHostMissingError('NOT_BUILT', `the host tree at ${tree} is not BUILT (apps/cli/lib/bin.js missing) — run: node scripts/provision-next-host.mjs --materialize`)
  }
  return { tree, head: sha, version }
}

/**
 * THE ASSET VERIFIER (pure over a platform dir + the manifest's file pin).
 *
 * Bytes, LENGTH and MODE are all part of the pin (docs/TEST_METHODS.md §9/§11.3):
 * a sha256 match with the wrong length is not a match, and a 0o644 launcher is
 * not the pinned launcher even when its bytes are right. A locally built addon is
 * NOT accepted — measured on this tree: a plain `pnpm run build` produced
 * `bin/glibc/system.node` = 75450f92… (17352 B), not the pin 54a9c25c… (17360 B).
 *
 * @returns {{files: Array<{relPath: string, sha256: string, bytes: number, mode: string}>}}
 */
export function verifyNextHostAssets({ platformDir, files: pinnedFiles, launcher, tree = platformDir }) {
  if (pinnedFiles === null || typeof pinnedFiles !== 'object' || Object.keys(pinnedFiles).length === 0) {
    throw new NextHostMissingError('PIN_INVALID', `the asset pin is empty (no files) — an empty pin accepts every tree, which is never a pinned host`)
  }
  const out = []
  for (const [relPath, spec] of Object.entries(pinnedFiles)) {
    const path = join(platformDir, relPath)
    if (!existsSync(path)) {
      throw new NextHostMissingError('ASSET_MISSING', `pinned native asset ${relPath} is ABSENT from the next host tree at ${tree} — provision it: node scripts/provision-next-host.mjs --assets`)
    }
    const bytes = readFileSync(path)
    const sha256 = createHash('sha256').update(bytes).digest('hex')
    if (sha256 !== spec.sha256) {
      throw new NextHostMissingError('ASSET_DIGEST_DRIFT', `pinned native asset ${relPath} is DRIFTED: ${sha256} (${bytes.length} B), pin is ${spec.sha256} (${spec.bytes} B) — a locally built binary is not the pinned host; re-provision with node scripts/provision-next-host.mjs --assets`)
    }
    if (bytes.length !== spec.bytes) {
      throw new NextHostMissingError('ASSET_BYTES_DRIFT', `pinned native asset ${relPath} has the pinned sha256 but ${bytes.length} B, pin is ${spec.bytes} B — the manifest's own row is inconsistent, so the pin cannot be trusted`)
    }
    if (typeof spec.mode === 'string') {
      const mode = `0o${(statSync(path).mode & 0o777).toString(8)}`
      if (mode !== spec.mode) {
        throw new NextHostMissingError('ASSET_MODE_DRIFT', `pinned native asset ${relPath} has mode ${mode}, pin is ${spec.mode} — the published bytes arrive executable or they are not the published artifact`)
      }
    }
    out.push({ relPath, sha256, bytes: bytes.length, mode: spec.mode })
  }
  return { files: out, launcher }
}

/**
 * Assert the next-host tree exists, is a git checkout at EXACTLY the pinned
 * commit, and that its package version is the pinned version. Throws otherwise.
 * @returns {{tree: string, head: string, version: string}}
 */
export function assertNextHostTree(repoRoot = NEXT_LANE_REPO_ROOT, pinned = NEXT_HOST) {
  return verifyNextHostTree(nextTree(repoRoot), pinned)
}

/**
 * Assert the pinned native assets are the COMMITTED bytes (per-file length +
 * sha256 + mode from the manifest's `next` entry).
 * @returns {{files: Array<{relPath: string, sha256: string, bytes: number, mode: string}>}}
 */
export function assertNextHostAssets(repoRoot = NEXT_LANE_REPO_ROOT, pinned = NEXT_HOST) {
  const { tree } = assertNextHostTree(repoRoot, pinned)
  const manifest = readHostSandboxAssetManifest({ repoRoot })
  const entry = manifestPlatformEntry(manifest, {
    version: pinned.version,
    sha: pinned.sha,
    platform: `${process.platform}-${process.arch}`,
    libc: detectedLibcVariant(),
  })
  const platformDir = join(tree, 'native', 'system', 'packages', `${process.platform}-${process.arch}`)
  return verifyNextHostAssets({ platformDir, files: entry.files, launcher: entry.launcher, tree })
}

/**
 * The host tree's own package resolver, anchored at the packages this lane
 * imports (all of them are published packages with a public `exports` map; the
 * resolver is the host's, so a package rename shows up as a resolution error
 * here rather than as a silent private-path import).
 */
const PER_SPEC_ANCHORS = [
  'packages/fs/tool-fs/package.json',
  'packages/fs/tool-fs-search/package.json',
  'packages/fs/fs-local/package.json',
  'packages/fs/fs-observation-policy/package.json',
  'packages/fs/fs-patch/package.json',
  'packages/fs/fs-sandbox/package.json',
  'packages/shell/tool-bash-persistent/package.json',
  'packages/sandbox/sandbox/package.json',
  'packages/sandbox/sandbox-local/package.json',
  'packages/sandbox/sandbox-policy/package.json',
  'packages/web/tool-web/package.json',
  'packages/web/web/package.json',
  'packages/spill/spill-local/package.json',
  'packages/subprocess/subprocess-local/package.json',
  'packages/core/tools/package.json',
  'packages/core/scope/package.json',
  'packages/core/tool-executor-native/package.json',
  'packages/core/session/package.json',
  'packages/core/agent/package.json',
  'packages/llm/llm/package.json',
  'packages/attachment/attachment-local/package.json',
  'packages/test-support/agent-loop-testkit/package.json',
  'packages/test-support/tool-testkit/package.json',
  'packages/ptc-runtime/ptc-runtime/package.json',
  'apps/cli/package.json',
]

/**
 * Resolve one package specifier to a file INSIDE the pinned next tree.
 *
 * WHY CONTAINMENT IS PART OF RESOLUTION (measured 2026-11-22): Node's resolver
 * walks UP, so `createRequire(<tree>/packages/fs/fs-local/package.json)`
 * resolves `@deepseek-ai/dsh-tool-fs` — which fs-local does not depend on — by
 * climbing out of the host tree into the Team repo's own `node_modules` and
 * returning the 0.2.0-rc.2 copy. That is a FALSE GREEN of exactly the kind this
 * lane exists to prevent: the test would claim rc.5 while executing rc.2. An
 * out-of-tree hit is therefore not a resolution; the next anchor is tried, and
 * if every anchor escapes or misses, the lane refuses with the escape evidence.
 *
 * The tree may be a SYMLINK shared with other worktrees, so containment is
 * checked against its realpath: resolving through the symlink is not an escape.
 */
export function resolveInsideTree(spec, tree = nextTree(), anchors = PER_SPEC_ANCHORS) {
  const resolvedTree = realpathSync(tree)
  const escapes = []
  for (const rel of anchors) {
    let require
    try {
      require = createRequire(join(tree, rel))
    } catch {
      continue
    }
    let file
    try {
      file = realpathSync(require.resolve(spec))
    } catch (error) {
      if (error?.code !== 'MODULE_NOT_FOUND') throw error
      continue
    }
    if (file === resolvedTree || file.startsWith(`${resolvedTree}${sep}`)) return file
    escapes.push(`${rel} -> ${file}`)
  }
  throw new NextHostMissingError('MODULE_UNRESOLVED', `the next host tree at ${tree} does not resolve ${spec} inside itself`
    + `${escapes.length === 0 ? '' : `; ${String(escapes.length)} anchor(s) escaped into another tree (${escapes.slice(0, 3).join(' | ')})`}`
    + ' — an out-of-tree hit is the LEGACY host, not this one; is the tree installed (pnpm install --ignore-scripts --frozen-lockfile)?')
}

/** Resolve one host package entry to an absolute file path (contained in the tree). */
export function resolveHostModule(spec, tree = nextTree()) {
  return resolveInsideTree(spec, tree)
}

/** Dynamic-import one host public package entry by package name. */
export function hostImport(spec, tree = nextTree()) {
  return import(pathToFileURL(resolveHostModule(spec, tree)).href)
}

/** A workspace-internal scratch cwd for a harness context (never /tmp). */
export function nextLaneWorkdir(repoRoot = NEXT_LANE_REPO_ROOT) {
  const root = join(repoRoot, '.artifacts', 'tmp', 'next-host-lane')
  mkdirSync(root, { recursive: true })
  return mkdtempSync(join(root, 'cwd-'))
}

/**
 * One machine-greppable evidence line per assertion. The runner prints these
 * verbatim; the evidence file and the PR quote them as measured, not restated.
 */
export function proof(id, ok, detail) {
  const line = `NEXT-SMOKE ${id} ${ok ? 'ok' : 'FAIL'} ${detail}`
  console.log(line)
  return line
}
